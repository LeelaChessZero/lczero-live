import db
from sanic import Blueprint, Request, Websocket
from sanic.helpers import json_dumps
from ws_notifier import (
    WebsocketNotifier,
    WebsocketRequest,
    WebsocketResponse,
    make_games_data,
)
import json

api = Blueprint("api", url_prefix="/api")


@api.websocket("/ws")
async def ws(req: Request, ws: Websocket):
    games = await db.Game.all()
    analyzed_games = set(g.id for g in req.app.ctx.app.get_games_being_analyzed())
    games = await db.Game.filter(
        is_hidden=False, tournament__is_hidden=False
    ).order_by("id").prefetch_related("tournament")

    resp = WebsocketResponse()
    ws_notifier: WebsocketNotifier = req.app.ctx.app.get_ws_notifier()
    try:
        ws_notifier.register(ws)
        resp["status"] = req.app.ctx.app.get_status()
        resp["games"] = make_games_data(games=games, analyzed_games=analyzed_games)
        await ws.send(json_dumps(resp))
        while True:
            data = await ws.recv()
            if not data:
                continue
            request: WebsocketRequest = json.loads(data)
            if "gameId" in request:
                await req.app.ctx.app.set_game_and_ply(
                    ws, request["gameId"], request.get("ply")
                )
    finally:
        ws_notifier.unregister(ws)
