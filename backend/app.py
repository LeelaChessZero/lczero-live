from sanic import Sanic
from pgn_feed import PgnFeed
from rich import print
from uci import UciInteractor
import sanic.config
import asyncio


class App:
    app: Sanic
    config: sanic.config.Config
    pgn_feed: PgnFeed
    uci: UciInteractor
    uci_queue: asyncio.Queue

    def __init__(self, app: Sanic):
        self.app = app
        self.config = app.config
        self.pgn_feed = None
        self.pgn_queue = asyncio.Queue()
        self.uci = None
        self.uci_queue = asyncio.Queue()

    async def run(self):
        self.pgn_feed = await PgnFeed.create(self.pgn_queue)
        await self.pgn_feed.connect(self.app.config.PGN_FEED["url"])
        self.uci = await UciInteractor.create(self.uci_queue)
        await self.uci.run(self.app.config.UCI_COMMAND_LINE)
        return self

    async def shutdown(self, app: Sanic):
        print("Shutting down")
        await asyncio.gather(self.pgn_feed.close(), self.uci.close())
