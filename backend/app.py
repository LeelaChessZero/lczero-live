from sanic import Sanic
from sanic.log import logger
import sanic.config
import asyncio
from typing import Optional
from analyzer import Analyzer
from db import Game
from game_selector import get_best_game, get_game_candidates, make_game
from rich import print


class App:
    app: Sanic
    config: sanic.config.Config
    analysises: list[Analyzer]
    game_assignment_lock: asyncio.Lock

    def get_games_being_analyzed(self) -> list[Game]:
        return [g for a in self.analysises if (g := a.get_game()) is not None]

    def __init__(self, app: Sanic):
        self.app = app
        self.config = app.config
        self.analysises = [Analyzer(cfg) for cfg in self.config.UCI_ANALYZERS]
        self.game_assignment_lock = asyncio.Lock()

    async def _assign_next_game(self, analyzer: Analyzer):
        assert analyzer.get_game() is None

        async def get_game() -> Optional[Game]:
            # Check whether there are any active games that are not covered.
            games = await Game.filter(is_finished=False)
            active_games = [a.id for a in self.get_games_being_analyzed()]
            for game in games:
                if game.id not in active_games:
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
            await analyzer.set_game(game)

    async def _run_single_analyzer(self, analyzer: Analyzer):
        while True:
            await self._assign_next_game(analyzer)
            await analyzer.run()
            logger.info("Analyzer finished, freeing the worker.")

    async def run(self):
        await asyncio.gather(*[self._run_single_analyzer(a) for a in self.analysises])

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        await asyncio.gather(*[a.disconnect() for a in self.analysises])
