import anyio
import db
import sanic.config
from analyzer import Analyzer
from game_selector import get_best_game, get_game_candidates, make_game
from rich import print
from sanic import Sanic
from sanic.log import logger
from ws_notifier import WebsocketNotifier


class App:
    app: Sanic
    config: sanic.config.Config
    _analysises: list[Analyzer]
    _game_assignment_lock: anyio.Lock
    _ws_notifier: WebsocketNotifier

    def __init__(self, app: Sanic):
        self.app = app
        self.config = app.config
        self._ws_notifier = WebsocketNotifier()
        self._analysises = [
            Analyzer(
                uci_config=cfg,
                next_task_callback=self._get_next_game,
                ws_notifier=self._ws_notifier,
            )
            for cfg in self.config.UCI_ANALYZERS
        ]
        self._game_assignment_lock = anyio.Lock()

    def get_games_being_analyzed(self) -> list[db.Game]:
        return [g for a in self._analysises if (g := a.get_game()) is not None]

    async def _get_next_game(self) -> db.Game:
        async with self._game_assignment_lock:
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
            for a in self._analysises:
                tg.start_soon(a.run)

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        # await asyncio.gather(*[a.disconnect() for a in self.analysises])
