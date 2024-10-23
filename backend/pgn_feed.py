import aiohttp
import asyncio
import chess.pgn
from io import StringIO
from typing import Optional, Tuple
from rich import print


class PgnFeed:
    queue: asyncio.Queue
    worker_task: Optional[asyncio.Task]
    filters: list[Tuple[str, str]]

    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.worker_task = None
        self.filters = []

    @classmethod
    async def create(
        cls, queue: asyncio.Queue, pgn_url: str, filters: list[Tuple[str, str]]
    ):
        self = cls(queue)
        self.filters = filters
        if self.worker_task:
            self.worker_task.cancel()
        self.worker_task = asyncio.create_task(self._worker(pgn_url))
        return self

    async def _maybe_send_game(self, buf: str):
        game = chess.pgn.read_game(StringIO(buf))
        assert game is not None
        if all(game.headers.get(k) == v for k, v in self.filters):
            await self.queue.put(game)

    async def _fetch_url(self, session: aiohttp.ClientSession, pgn_url: str):
        try:
            async with session.get(pgn_url) as response:
                buffer = ""
                async for data, _ in response.content.iter_chunks():
                    buffer += data.decode("utf-8")
                    while True:
                        pre, set, post = buffer.partition("\n\n\n")
                        if not set:
                            break
                        await self._maybe_send_game(pre)
                        buffer = post
        except asyncio.CancelledError:
            print("Cancelling the pgn feed task.")
            pass

    async def _worker(self, pgn_url: str):
        timeout = aiohttp.ClientTimeout(total=0, sock_read=0)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            await self._fetch_url(session, pgn_url)

    async def disconnect(self):
        self.filters.clear()
        if self.worker_task:
            self.worker_task.cancel()
            await self.worker_task
            self.worker_task = None
