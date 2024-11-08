import anyio
import db
import sanic.config
from analyzer import Analyzer
from game_selector import get_best_game, get_game_candidates, make_game
from rich import print
from sanic import Sanic
from sanic import Websocket
from typing import Optional
from sanic.log import logger
from ws_notifier import (
    WebsocketNotifier,
    make_positions_update,
    WebsocketResponse,
    WsGlobalData,
    make_evaluations_update,
)
import hashlib


def _get_js_hash() -> str:
    with open("../static/dist/main.js", "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


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

    def get_ws_notifier(self) -> WebsocketNotifier:
        return self._ws_notifier

    async def dump_moves(self, ws, game_id: int):
        positions: list[db.GamePosition] = (
            await db.GamePosition.filter(game=game_id).order_by("ply_number").all()
        )
        response = WebsocketResponse(
            positions=make_positions_update(game_id=game_id, positions=positions)
        )
        await self._ws_notifier.send_response(ws, response)

    async def dump_eval(self, ws, game_id: int, ply: int):
        pos: db.GamePosition | None = await db.GamePosition.get_or_none(
            game=game_id, ply_number=ply
        )
        if pos is None:
            return
        evaluations: list[db.GamePositionEvaluation] = (
            await db.GamePositionEvaluation.filter(position=pos).order_by("id")
        )
        moveses_flat: list[db.GamePositionEvaluationMove] = (
            await db.GamePositionEvaluationMove.filter(
                evaluation__position=pos
            ).order_by("-nodes")
        )
        moveses: list[list[db.GamePositionEvaluationMove]] = [[] for _ in evaluations]
        eval_id_to_idx = {e.id: idx for idx, e in enumerate(evaluations)}
        for move in moveses_flat:
            moveses[eval_id_to_idx[move.evaluation_id]].append(move)

        response = WebsocketResponse(
            evaluations=make_evaluations_update(
                game_id=game_id,
                ply=ply,
                evaluations=evaluations,
                moves=moveses,
            )
        )
        await self._ws_notifier.send_response(ws, response)

    async def set_game_and_ply(
        self, ws: Websocket, game_id: int, ply: Optional[int] = None
    ):
        game_changed = self._ws_notifier.set_game_and_ply(ws, game_id, ply)
        if game_changed:
            await self.dump_moves(ws, game_id)
        if ply is not None:
            await self.dump_eval(ws, game_id, ply)

    def get_games_being_analyzed(self) -> list[db.Game]:
        return [g for a in self._analysises if (g := a.get_game()) is not None]

    def get_status(self) -> WsGlobalData:
        return WsGlobalData(
            numViewers=self._ws_notifier.num_subscribers(),
            jsHash=_get_js_hash(),
        )

    async def send_status_periodically(self):
        while True:
            await anyio.sleep(delay=33)
            await self._ws_notifier.notify_observers(
                WebsocketResponse(status=self.get_status())
            )

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
            tg.start_soon(self.send_status_periodically)
            for a in self._analysises:
                tg.start_soon(a.run)

    async def shutdown(self, app: Sanic):
        logger.info("Shutting down app.")
        # await asyncio.gather(*[a.disconnect() for a in self.analysises])
