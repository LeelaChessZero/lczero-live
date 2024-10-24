import db
from typing import List, Optional
from pgn_feed import PgnFeed
import asyncio
import chess.pgn
import chess
from uci import UciInteractor
from rich import print
from sanic.log import logger


class Analyzer:
    _config: dict
    _game: Optional[db.Game]
    _pgn_feed: Optional[PgnFeed]
    _pgn_feed_queue: asyncio.Queue
    _current_position: Optional[db.GamePosition]
    _uci: Optional[UciInteractor]
    _position_task: Optional[asyncio.Task]

    def __init__(self, uci_config: dict):
        self._config = uci_config
        self._game = None
        self._pgn_feed = None
        self._pgn_feed_queue = asyncio.Queue()
        self._current_position = None
        self._uci = None
        self._position_task = None

    # returns the last ply number.
    async def _update_game_db(self, game: chess.pgn.Game) -> db.GamePosition:
        board = game.board()
        white_clock: Optional[int] = None
        black_clock: Optional[int] = None

        async def create_pos(
            ply: int,
            move_uci: Optional[str],
            move_san: Optional[str],
        ) -> db.GamePosition:
            assert self._game
            res, _ = await db.GamePosition.get_or_create(
                game=self._game,
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

        for ply, node in enumerate(game.mainline(), start=1):
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

    async def _process_update(self, game: chess.pgn.Game):
        last_pos: db.GamePosition = await self._update_game_db(game)
        logger.info(f"Processing position {last_pos.fen}")
        if self._current_position != last_pos:
            self._current_position = last_pos
            logger.debug("Position changed.")
            await self._process_position(last_pos)
        if game.headers["Result"] != "*":
            logger.debug("Game is finished.")
            assert self._game
            await db.Game.filter(id=self._game.id).update(is_finished=True)
            await self.disconnect()
            return

    async def _process_position(self, position: db.GamePosition):
        if not self._uci:
            self._uci = await UciInteractor.create(self._config)
        uci_queue = asyncio.Queue()

        async def run():
            logger.debug("Running new UCI task.")
            try:
                while True:
                    info = await uci_queue.get()
                    if info is None:
                        break
                    # print(info)
            except asyncio.CancelledError:
                logger.debug("Cancelled UCI task.")
            logger.debug("Exiting from UCI task.")

        await self._uci.think(uci_queue, chess.Board(position.fen))
        if self._position_task:
            logger.debug("Cancelling old UCI task.")
            self._position_task.cancel()
            logger.debug("Awaiting old UCI task.")
            await self._position_task
            logger.debug("Awaited old UCI task.")
        self._position_task = asyncio.create_task(run())

    def get_game(self) -> Optional[db.Game]:
        return self._game

    async def set_game(self, game: db.Game):
        await self.disconnect()
        self._game = game
        filters: List[tuple[str, str]] = [
            (f.key, f.value) for f in await db.GameFilter.filter(game=game)
        ]
        url = (
            "https://lichess.org/api/stream/broadcast/round/"
            f"{game.lichess_round_id}.pgn"
        )
        self._pgn_feed_queue = asyncio.Queue()
        self._pgn_feed = await PgnFeed.create(
            queue=self._pgn_feed_queue, pgn_url=url, filters=filters
        )

    async def run(self):
        while True:
            game: Optional[chess.pgn.Game] = await self._pgn_feed_queue.get()
            if game is None:
                logger.info("PGN feed closed.")
                break
            logger.debug(f"Got new game: {game.headers['Event']}")
            await self._process_update(game)

        # self.pgn_feed = None
        # self.pgn_queue = asyncio.Queue()
        # self.uci = None
        # self.uci_queue = asyncio.Queue()
        # self.cur_game_id = None
        # self.pgn_feed = await PgnFeed.create(self.pgn_queue)
        # await self.pgn_feed.connect(self.app.config.PGN_FEED["url"])
        # self.uci = await UciInteractor.create(self.uci_queue)
        # await self.uci.run(self.app.config.UCI_COMMAND_LINE)

    async def disconnect(self):
        await self._pgn_feed_queue.put(None)
        self._game = None
        if self._pgn_feed:
            await self._pgn_feed.disconnect()
