class Analyzer:
    config: dict

    def __init__(self, uci_config: dict):
        self.config = uci_config

        # self.pgn_feed = None
        # self.pgn_queue = asyncio.Queue()
        # self.uci = None
        # self.uci_queue = asyncio.Queue()
        # self.cur_game_id = None
        # self.pgn_feed = await PgnFeed.create(self.pgn_queue)
        # await self.pgn_feed.connect(self.app.config.PGN_FEED["url"])
        # self.uci = await UciInteractor.create(self.uci_queue)
        # await self.uci.run(self.app.config.UCI_COMMAND_LINE)

    async def shutdown(self):
        # await self.pgn_feed.close()
        ...
