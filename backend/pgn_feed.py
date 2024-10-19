import aiohttp
import asyncio
import chess.pgn
from io import StringIO


class PgnFeed:
    def __init__(self, pgn_url):
        self.pgn_url = pgn_url
        self.session = aiohttp.ClientSession()

    async def _connect(self):
        while True:
            try:
                async with self.session.get(self.pgn_url) as response:
                    buffer = ""
                    async for data, _ in response.content.iter_chunks():
                        buffer += data.decode("utf-8")
                        while "\n\n\n" in buffer:
                            message, buffer = buffer.split("\n\n\n", 1)
                            yield message
            except aiohttp.ClientError:
                await asyncio.sleep(1)  # Reconnect delay

    async def next_game(self):
        async for message in self._connect():
            yield chess.pgn.read_game(StringIO(message))

    async def close(self):
        await self.session.close()
