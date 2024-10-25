from sanic import Sanic
from sanic.log import logger
import sanic.config
import anyio
from analyzer import Analyzer
import db
from game_selector import get_best_game, get_game_candidates, make_game
from rich import print
from anyio.streams.memory import MemoryObjectReceiveStream
from api_types import GamePositionUpdateFrame
from typing import Optional


class App:
    app: Sanic
    config: sanic.config.Config
    analysises: list[Analyzer]
    game_assignment_lock: anyio.Lock

    def get_games_being_analyzed(self) -> list[db.Game]:
        return [g for a in self.analysises if (g := a.get_game()) is not None]

    def add_moves_observer(
        self, game_id: int
    ) -> Optional[MemoryObjectReceiveStream[GamePositionUpdateFrame]]:
        for a in self.analysises:
            game = a.get_game()
            if game and game.id == game_id:
                return a.add_moves_observer()

    def __init__(self, app: Sanic):
        self.app = app
        self.config = app.config
        self.analysises = [
            Analyzer(uci_config=cfg, next_task_callback=self._get_next_game)
            for cfg in self.config.UCI_ANALYZERS
        ]
        self.game_assignment_lock = anyio.Lock()

    async def _get_next_game(self) -> db.Game:
        async with self.game_assignment_lock:
            while True:
                # Check whether there are any active games that are not covered.
                games = await db.Game.filter(is_finished=False)
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
                logger.debug("No games found, waiting for a while.")
                await anyio.sleep(10)

    async def run(self):
        async with anyio.create_task_group() as tg:
            for a in self.analysises:
                tg.start_soon(a.run)

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        # await asyncio.gather(*[a.disconnect() for a in self.analysises])
