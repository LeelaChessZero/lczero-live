import aiohttp
import asyncio
import chess.pgn
from io import StringIO
from typing import Optional


class PgnFeed:
    queue: asyncio.Queue
    worker_task: Optional[asyncio.Task]

    def __init__(self, queue: asyncio.Queue):
        self.queue = queue
        self.worker_task = None

    @classmethod
    async def create(cls, queue: asyncio.Queue):
        self = cls(queue)
        return self

    async def connect(self, pgn_url: str):
        if self.worker_task:
            self.worker_task.cancel()
        self.worker_task = asyncio.create_task(self._worker(pgn_url))

    async def _send_game(self, buf: str):
        game = chess.pgn.read_game(StringIO(buf))
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
                        await self._send_game(pre)
                        buffer = post
        except asyncio.CancelledError:
            print("Cancelling the pgn feed task.")
            pass

    async def _worker(self, pgn_url: str):
        timeout = aiohttp.ClientTimeout(total=0, sock_read=0)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            await self._fetch_url(session, pgn_url)

    async def close(self):
        if self.worker_task:
            self.worker_task.cancel()
            await self.worker_task
            self.worker_task = None
