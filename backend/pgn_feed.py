import aiohttp
import chess.pgn
from io import StringIO
from typing import Tuple
from sanic.log import logger
from anyio.streams.memory import MemoryObjectSendStream


class PgnFeed:
    queue: MemoryObjectSendStream[chess.pgn.Game]
    filters: list[Tuple[str, str]]

    def __init__(self, queue: MemoryObjectSendStream[chess.pgn.Game]):
        self.queue = queue
        self.filters = []

    @classmethod
    async def run(
        cls,
        queue: MemoryObjectSendStream[chess.pgn.Game],
        pgn_url: str,
        filters: list[Tuple[str, str]],
    ):
        self = cls(queue)
        self.filters = filters
        await self._worker(pgn_url)

    async def _maybe_send_game(self, buf: str) -> bool:
        game = chess.pgn.read_game(StringIO(buf))
        assert game is not None
        if all(game.headers.get(k) == v for k, v in self.filters):
            logger.debug(
                f"Got new PGN for {game.headers['Event']}: "
                f"{len(list(game.mainline_moves()))} ply"
            )
            await self.queue.send(game)
            if game.headers.get("Result") != "*":
                logger.info(f"Game {game.headers['Event']} finished, cloding queue.")
                await self.queue.aclose()
                return True
        return False

    async def _fetch_url(self, session: aiohttp.ClientSession, pgn_url: str):
        async with session.get(pgn_url) as response:
            buffer = ""
            async for data, _ in response.content.iter_chunks():
                buffer += data.decode("utf-8")
                while True:
                    pre, set, post = buffer.partition("\n\n\n")
                    if not set:
                        break
                    if await self._maybe_send_game(pre):
                        return
                    buffer = post

    async def _worker(self, pgn_url: str):
        with self.queue:
            timeout = aiohttp.ClientTimeout(total=0, sock_read=0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                await self._fetch_url(session, pgn_url)
            logger.info("Leaving the pgn fetch.")
