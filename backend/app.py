from sanic import Sanic
from rich import print
from sanic.log import logger
import dataclasses
import sanic.config
import asyncio
import lichess
from typing import Optional
from analyzer import Analyzer
from db import Game, Tournament


@dataclasses.dataclass
class Analysis:
    game: Optional[Game]
    analyzer: Analyzer


class App:
    app: Sanic
    config: sanic.config.Config
    analysises: list[Analysis]
    game_assignment_lock: asyncio.Lock

    def __init__(self, app: Sanic):
        self.app = app
        self.config = app.config
        self.analysises = [
            Analysis(None, Analyzer(cfg)) for cfg in self.config.UCI_ANALYZERS
        ]
        self.game_assignment_lock = asyncio.Lock()
        self.idle_worker_counter = asyncio.Semaphore(len(self.analysises))

    async def _assign_next_game(self, analysis: Analysis):
        assert analysis.game is None
        async with self.game_assignment_lock:
            while True:
                # Check whether there are any active games that are not covered.
                games = await Game.filter(is_finished=False)
                for game in games:
                    if game.id not in [
                        a.game.id for a in self.analysises if a.game is not None
                    ]:
                        logger.info(f"Found ongoing game {game.game_name}")
                        analysis.game = game
                        return
                # Gather ongoing games from unfinished tournaments.
                ongoing_tournaments = await Tournament.filter(is_finished=False)
                tournaments = await asyncio.gather(
                    *[lichess.get_tournament(t.lichess_id) for t in ongoing_tournaments]
                )
                print(tournaments)
                await asyncio.sleep(10)

    async def _run_single_analyzer(self, analysis: Analysis):
        while True:
            await self._assign_next_game(analysis)

    async def run(self):
        await asyncio.gather(*[self._run_single_analyzer(a) for a in self.analysises])

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        await asyncio.gather(*[a.analyzer.shutdown() for a in self.analysises])
