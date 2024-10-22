from sanic import Sanic
from sanic.log import logger
import dataclasses
import sanic.config
import asyncio
from typing import Optional
from analyzer import Analyzer
from db import Game
from game_selector import get_best_game, get_game_candidates, make_game
from rich import print


@dataclasses.dataclass
class Analysis:
    game: Optional[Game]
    analyzer: Analyzer


class App:
    app: Sanic
    config: sanic.config.Config
    analysises: list[Analysis]
    game_assignment_lock: asyncio.Lock

    def get_games_being_analyzed(self) -> list[Game]:
        return [a.game for a in self.analysises if a.game is not None]

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

        async def get_game() -> Optional[Game]:
            # Check whether there are any active games that are not covered.
            games = await Game.filter(is_finished=False)
            for game in games:
                if game.id not in [
                    a.game.id for a in self.analysises if a.game is not None
                ]:
                    logger.info(f"Found ongoing game {game.game_name}")
                    return game
            candidates = await get_game_candidates()
            if candidates:
                best_candidate = get_best_game(candidates)
                print(f"Will follow game: {best_candidate.game['name']}")
                return await make_game(best_candidate)

        async with self.game_assignment_lock:
            while True:
                game = await get_game()
                if game is not None:
                    break
                logger.debug("No games found, waiting for a while.")
                await asyncio.sleep(10)
            analysis.game = game

    async def _run_single_analyzer(self, analysis: Analysis):
        # while True:
        await self._assign_next_game(analysis)

    async def run(self):
        await asyncio.gather(*[self._run_single_analyzer(a) for a in self.analysises])

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        await asyncio.gather(*[a.analyzer.shutdown() for a in self.analysises])
