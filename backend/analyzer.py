import db
from typing import List, Optional
from pgn_feed import PgnFeed
import anyio
import chess.pgn
import chess.engine
import chess
from uci import UciInteractor
from sanic.log import logger
from typing import Awaitable, Callable
from anyio.streams.memory import MemoryObjectReceiveStream
from anyio.abc import TaskGroup


class Analyzer:
    _config: dict
    _game: Optional[db.Game]
    _current_position: Optional[db.GamePosition]
    _uci: UciInteractor
    _get_next_task_callback: Callable[[], Awaitable[db.Game]]

    def __init__(
        self, uci_config: dict, next_task_callback: Callable[[], Awaitable[db.Game]]
    ):
        self._config = uci_config
        self._game = None
        self._get_next_task_callback = next_task_callback
        self._current_position = None

    # returns the last ply number.
    async def _update_game_db(
        self, pgn: chess.pgn.Game, game: db.Game
    ) -> db.GamePosition:
        board = pgn.board()
        white_clock: Optional[int] = None
        black_clock: Optional[int] = None

        async def create_pos(
            ply: int,
            move_uci: Optional[str],
            move_san: Optional[str],
        ) -> db.GamePosition:
            res, _ = await db.GamePosition.get_or_create(
                game=game,
                ply_number=ply,
                defaults={
                    "fen": board.fen(),
                    "move_uci": move_uci,
                    "move_san": move_san,
                    "white_clock": white_clock,
                    "black_clock": black_clock,
                },
            )
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
        return last_pos

    async def _process_position(self, board: chess.Board):
        uci_send_queue, uci_recv_queue = anyio.create_memory_object_stream[
            chess.engine.InfoDict
        ]()

        async with anyio.create_task_group() as uci_tg:
            uci_tg.start_soon(self._uci.think, uci_send_queue, board)
            uci_tg.start_soon(self._process_ucis, uci_recv_queue, uci_tg)

    async def _process_ucis(
        self,
        uci_recv_queue: MemoryObjectReceiveStream[chess.engine.InfoDict],
        tg: TaskGroup,
    ):
        async for info in uci_recv_queue:
            if info.get("multipv", 1) == 1:
                logger.debug(f"Got info: d:{info.get('depth')} n:{info.get('nodes')}")
        tg.cancel_scope.cancel()

    def get_game(self) -> Optional[db.Game]:
        return self._game

    async def run(self):
        self._uci = await UciInteractor.create(self._config)
        while True:
            self._game = await self._get_next_task_callback()
            await self._run_single_game(self._game)

    async def _run_single_game(self, game: db.Game):
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
        async with anyio.create_task_group() as game_tg:
            game_tg.start_soon(PgnFeed.run, pgn_send_queue, url, filters)
            game_tg.start_soon(self._uci_worker, pgn_recv_queue, game)

    async def _uci_worker(
        self,
        pgn_recv_stream: MemoryObjectReceiveStream[chess.pgn.Game],
        game: db.Game,
    ):
        async for pgn in pgn_recv_stream:
            last_pos: db.GamePosition = await self._update_game_db(pgn, game)
            logger.info(f"Processing position {last_pos.fen}")
            if self._current_position != last_pos:
                self._current_position = last_pos
                logger.debug("Position changed.")
                await self._process_position(pgn.board())
        logger.debug("Game is finished.")
        await db.Game.filter(id=game.id).update(is_finished=True)
