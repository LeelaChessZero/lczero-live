import dataclasses
from typing import Any, Awaitable, Callable, List, Optional, Tuple, cast

import anyio
import asyncssh
import chess
import chess.engine
import chess.pgn
import db
from anyio.streams.memory import MemoryObjectReceiveStream
from pgn_feed import PgnFeed
from sanic.log import logger
from ws_notifier import WebsocketNotifier


@dataclasses.dataclass
class Totals:
    nodes: int
    score_q: int
    score_white: int
    score_draw: int
    score_black: int
    moves_left: Optional[int] = None


def get_totals(info_bundle: list[chess.engine.InfoDict]) -> Totals:
    totals = Totals(
        nodes=0,
        score_q=0,
        score_white=0,
        score_draw=0,
        score_black=0,
        moves_left=info_bundle[0].get("movesleft"),
    )
    for info in info_bundle:
        nodes = info.get("nodes", 0)
        totals.nodes += nodes
        score: chess.engine.Score = info.get(
            "score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE)
        ).white()
        wdl: chess.engine.Wdl = info.get(
            "wdl", chess.engine.PovWdl(chess.engine.Wdl(0, 1000, 0), chess.WHITE)
        ).white()
        totals.score_q += nodes * score.score(mate_score=20000)
        totals.score_white += nodes * wdl.wins
        totals.score_draw += nodes * wdl.draws
        totals.score_black += nodes * wdl.losses
    totals.score_q = round(totals.score_q / totals.nodes)
    totals.score_white = round(totals.score_white / totals.nodes)
    totals.score_black = round(totals.score_black / totals.nodes)
    totals.score_draw = 1000 - totals.score_white - totals.score_black
    return totals


def get_leaf_board(pgn: chess.pgn.Game) -> chess.Board:
    board = pgn.board()
    for move in pgn.mainline_moves():
        board.push(move)
    return board


def make_pv_san_string(board: chess.Board, pv: List[chess.Move]) -> str:
    board = board.copy()
    res: str = ""
    if board.turn == chess.BLACK:
        res = f"{board.fullmove_number}…"
    for move in pv:
        if board.turn == chess.WHITE:
            if res:
                res += " "
            res += f"{board.fullmove_number}."
        res += " " + board.san(move)
        board.push(move)
    return res


def make_pv_uci_string(board: chess.Board, pv: List[chess.Move]) -> str:
    board = board.copy()
    moves = []
    for move in pv:
        moves.append(move.uci())
        board.push(move)
    return " ".join(moves)


class Analyzer:
    _config: dict
    _game: Optional[db.Game]
    _current_position: Optional[db.GamePosition]
    _engine: chess.engine.Protocol
    _get_next_task_callback: Callable[[], Awaitable[db.Game]]
    _ws_notifier: WebsocketNotifier
    _uci_lock: anyio.Lock
    _uci_cancelation_lock: anyio.Lock
    _connection: asyncssh.SSHClientConnection

    def __init__(
        self,
        uci_config: dict,
        next_task_callback: Callable[[], Awaitable[db.Game]],
        ws_notifier: WebsocketNotifier,
    ):
        self._config = uci_config
        self._game = None
        self._get_next_task_callback = next_task_callback
        self._current_position = None
        self._ws_notifier = ws_notifier
        self._uci_lock = anyio.Lock()
        self._uci_cancelation_lock = anyio.Lock()

    # returns the last ply number.
    async def _update_game_db(
        self, pgn: chess.pgn.Game, game: db.Game
    ) -> db.GamePosition:
        board = pgn.board()
        white_clock: Optional[int] = None
        black_clock: Optional[int] = None

        added_game_positions: list[db.GamePosition] = []

        async def create_pos(
            ply: int,
            move_uci: Optional[str],
            move_san: Optional[str],
        ) -> db.GamePosition:
            res, created = await db.GamePosition.get_or_create(
                game=game,
                ply_number=ply,
                defaults={
                    "fen": board.fen(),
                    "move_uci": move_uci,
                    "move_san": move_san,
                    "white_clock": white_clock,
                    "black_clock": black_clock,
                    "nodes": 0,
                    "q_score": 0,
                    "white_score": 0,
                    "draw_score": 0,
                    "black_score": 0,
                },
            )
            if created:
                added_game_positions.append(res)

            return res

        last_pos: db.GamePosition = await create_pos(
            ply=0,
            move_uci=None,
            move_san=None,
        )

        for ply, node in enumerate(pgn.mainline(), start=1):
            clock = node.clock()
            if clock:
                if board.turn == chess.WHITE:
                    white_clock = int(clock)
                else:
                    black_clock = int(clock)
            san = board.san(node.move)
            board.push(move=node.move)
            last_pos = await create_pos(
                ply=ply,
                move_uci=node.move.uci(),
                move_san=san,
            )
        await self._ws_notifier.send_game_update(
            game_id=game.id, positions=added_game_positions
        )
        return last_pos

    def get_game(self) -> Optional[db.Game]:
        return self._game

    async def run(self):
        async with self._uci_lock:
            if "ssh" in self._config:
                self._connection = await asyncssh.connect(
                    self._config["ssh"]["host"],
                    username=self._config["ssh"]["username"],
                )
                _, self._engine = cast(
                    Tuple[Any, chess.engine.Protocol],
                    await self._connection.create_subprocess(
                        protocol_factory=cast(
                            asyncssh.subprocess.SubprocessFactory,
                            chess.engine.UciProtocol,
                        ),
                        command=" ".join(self._config["command"]),
                    ),
                )
            else:
                _, self._engine = await chess.engine.popen_uci(
                    command=self._config["command"]
                )
            await self._engine.initialize()
        while True:
            self._game = await self._get_next_task_callback()
            await self._run_single_game(self._game)

    async def _run_single_game(self, game: db.Game):
        await game.fetch_related("tournament")
        await self._ws_notifier.send_game_entry_update(game, is_being_analyzed=True)
        pgn_send_queue, pgn_recv_queue = anyio.create_memory_object_stream[
            chess.pgn.Game
        ]()
        filters: List[tuple[str, str]] = [
            (f.key, f.value) for f in await db.GameFilter.filter(game=game)
        ]
        url = (
            "https://lichess.org/api/stream/broadcast/round/"
            f"{game.lichess_round_id}.pgn"
        )
        try:
            async with anyio.create_task_group() as game_tg:
                logger.info(f"Starting tasks for pgn feed game_id={game.id}, {url}")
                game_tg.start_soon(PgnFeed.run, pgn_send_queue, url, filters)
                game_tg.start_soon(self._uci_worker, pgn_recv_queue, game)
        except Exception as e:
            logger.warning(f"Leaving the _run_single_game with exception: {e}")
            raise e
        logger.info(f"Leaving the _run_single_game normally for game {game.id}")

    async def _uci_worker(
        self,
        pgn_recv_stream: MemoryObjectReceiveStream[chess.pgn.Game],
        game: db.Game,
    ):
        with pgn_recv_stream:
            try:
                pgn: Optional[chess.pgn.Game] = None
                while True:
                    async with anyio.create_task_group() as tg:
                        if pgn is not None:
                            assert self._current_position is not None
                            logger.info(
                                f"Processing position {self._current_position.fen}"
                            )
                            tg.start_soon(
                                self._uci_worker_think,
                                get_leaf_board(pgn),
                                self._current_position,
                                game,
                            )
                        while True:
                            pgn = await pgn_recv_stream.receive()
                            last_pos: db.GamePosition = await self._update_game_db(
                                pgn, game
                            )
                            if self._current_position == last_pos:
                                logger.warning(
                                    "New position is the same as the last one, skip."
                                )
                            else:
                                self._current_position = last_pos
                                break
                        logger.debug("Got new pgn, cancelling the old task.")
                        async with self._uci_cancelation_lock:
                            tg.cancel_scope.cancel()
                    logger.debug("Cancelled the old task.")
            except* anyio.EndOfStream:
                logger.info("The PGN feed queue is closed, likely game is finished.")
                await db.Game.filter(id=game.id).update(is_finished=True)
                assert self._game is not None
                self._game.is_finished = True
                await self._ws_notifier.send_game_entry_update(
                    game, is_being_analyzed=False
                )
                self._game = None

    async def _uci_worker_think(
        self, board: chess.Board, pos: db.GamePosition, game: db.Game
    ):
        try:
            async with self._uci_lock:
                logger.info(f"Starting thinking: {board.fen()}, ply {pos.ply_number}")
                await self._uci_cancelation_lock.acquire()
                options: dict[str, str] = self._config.get(
                    "uci_options", lambda *_: {}
                )(game, pos)
                if game.player1_rating is not None and game.player2_rating is not None:
                    options["ClearTree"] = "true"
                    options["WDLCalibrationElo"] = str(game.player1_rating)
                    options["Contempt"] = str(game.player1_rating - game.player2_rating)
                    options["ContemptMode"] = "white_side_analysis"
                    options["WDLDrawRateReference"] = "0.64"
                    options["WDLEvalObjectivity"] = "0.0"
                logger.debug(f"Options: {options}")
                with await self._engine.analysis(
                    board=board,
                    multipv=self._config["max_multipv"],
                    options=options,
                ) as analysis:
                    self._uci_cancelation_lock.release()
                    logger.info(
                        f"Started thinking: {board.fen()}, ply {pos.ply_number}"
                    )
                    assert game is not None
                    await self._ws_notifier.send_game_update(game.id, positions=[pos])
                    multipv = min(
                        self._config["max_multipv"], board.legal_moves.count()
                    )
                    info_bundle: list[chess.engine.InfoDict] = []
                    async for info in analysis:
                        if "multipv" not in info:
                            logger.warning(f"Got info without multipv: {info}")
                            continue
                        if info["multipv"] != len(info_bundle) + 1:
                            logger.error(f"Got info for wrong multipv: {info}")
                            info_bundle = []
                            continue
                        info_bundle.append(info)
                        if len(info_bundle) == multipv:
                            await self._process_info_bundle(
                                info_bundle=info_bundle,
                                board=board,
                                pos=pos,
                            )
                            info_bundle = []
        except AssertionError as e:
            logger.error(f"Assertion error: {e}")
        finally:
            try:
                self._uci_cancelation_lock.release()
            except RuntimeError:
                pass

    async def _process_info_bundle(
        self,
        info_bundle: list[chess.engine.InfoDict],
        board: chess.Board,
        pos: db.GamePosition,
    ):
        totals: Totals = get_totals(info_bundle)
        logger.debug(f"Total nodes: {totals.nodes}")
        # logger.debug(info_bundle[0])
        evaluation: db.GamePositionEvaluation = await db.GamePositionEvaluation.create(
            position=pos,
            nodes=totals.nodes,
            time=int(info_bundle[0].get("time", 0) * 1000),
            depth=info_bundle[0].get("depth", 0),
            seldepth=info_bundle[0].get("seldepth", 0),
        )

        def make_eval_move(info: chess.engine.InfoDict):
            pv: List[chess.Move] = info.get("pv", [])
            assert len(pv) > 0
            move: chess.Move = pv[0]
            score: chess.engine.Score = info.get(
                "score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE)
            ).white()
            wdl: chess.engine.Wdl = info.get(
                "wdl", chess.engine.PovWdl(chess.engine.Wdl(0, 1000, 0), chess.WHITE)
            ).white()
            return db.GamePositionEvaluationMove(
                evaluation=evaluation,
                nodes=info.get("nodes", 0),
                move_uci=move.uci(),
                move_san=board.san(move),
                q_score=score.score(mate_score=20000),
                pv_san=make_pv_san_string(board, pv),
                pv_uci=make_pv_uci_string(board, pv),
                mate_score=score.mate() if score.is_mate() else None,
                white_score=wdl.wins,
                draw_score=wdl.draws,
                black_score=wdl.losses,
                moves_left=info.get("movesleft", None),
            )

        moves: List[db.GamePositionEvaluationMove] = [
            make_eval_move(info)
            for info in info_bundle[: self._config.get("show_pv", 2)]
        ]
        await db.GamePositionEvaluationMove.bulk_create(moves)
        pos.nodes = totals.nodes
        pos.q_score = totals.score_q
        pos.white_score = totals.score_white
        pos.draw_score = totals.score_draw
        pos.black_score = totals.score_black
        pos.moves_left = totals.score_black
        fmove = info_bundle[0]
        if "time" in fmove:
            pos.time = int(fmove.get("time", 0) * 1000)
        if "depth" in fmove:
            pos.depth = fmove.get("depth", 0)
        if "seldepth" in fmove:
            pos.seldepth = fmove.get("seldepth", 0)
        await pos.save()
        game = self._game
        assert game is not None
        await self._ws_notifier.send_game_update(
            game_id=game.id,
            positions=[pos],
            ply=pos.ply_number,
            evaluations=[evaluation],
            moves=[moves],
        )
