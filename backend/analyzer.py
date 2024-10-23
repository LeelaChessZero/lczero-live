import db
from typing import List, Optional
from pgn_feed import PgnFeed
import asyncio
import chess.pgn
import chess


class Analyzer:
    config: dict
    game: Optional[db.Game]
    pgn_feed: Optional[PgnFeed]
    pgn_feed_queue: asyncio.Queue

    def __init__(self, uci_config: dict):
        self.config = uci_config
        self._game = None
        self.pgn_feed = None
        self.pgn_feed_queue = asyncio.Queue()

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
                fen=board.fen(),
                move_uci=move_uci,
                move_san=move_san,
                white_clock=white_clock,
                black_clock=black_clock,
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

    async def _feed_task(self):
        while True:
            game: Optional[chess.pgn.Game] = await self.pgn_feed_queue.get()
            if game is None:
                break
            last_pos: db.GamePosition = await self._update_game_db(game)

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
        self.pgn_feed_queue = asyncio.Queue()
        self.pgn_feed = await PgnFeed.create(
            queue=self.pgn_feed_queue, pgn_url=url, filters=filters
        )
        asyncio.create_task(self._feed_task())

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
        await self.pgn_feed_queue.put(None)
        self._game = None
        if self.pgn_feed:
            await self.pgn_feed.disconnect()
