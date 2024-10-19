from sanic import Sanic
from pgn_feed import PgnFeed
from rich import print


class App:
    pgn_feed: PgnFeed

    def __init__(self) -> None: ...

    async def setup(self, app: Sanic):
        self.config = app.config
        self.pgn_feed = PgnFeed(self.config.PGN_FEED["url"])

    async def run(self):
        async for game in self.pgn_feed.next_game():
            if any(
                attr not in game.headers
                or game.headers[attr] != self.config.PGN_FEED["filters"][attr]
                for attr in self.config.PGN_FEED["filters"]
            ):
                continue

            print(game)

    async def shutdown(self, app: Sanic):
        print("Shutting down")
        await self.pgn_feed.close()
