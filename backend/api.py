import db
from sanic import Blueprint, Request, Websocket
from sanic.helpers import json_dumps
from ws_notifier import (
    WebsocketNotifier,
    WebsocketRequest,
    WebsocketResponse,
    make_game_data,
)
import json

api = Blueprint("api", url_prefix="/api")


@api.websocket("/ws")
async def ws(req: Request, ws: Websocket):
    games = await db.Game.all()
    analyzed_games = set(g.id for g in req.app.ctx.app.get_games_being_analyzed())
    games = await db.Game.filter(
        is_hidden=False, tournament__is_hidden=False
    ).prefetch_related("tournament")

    resp = WebsocketResponse()
    ws_notifier: WebsocketNotifier = req.app.ctx.app.get_ws_notifier()
    try:
        ws_notifier.register(ws)
        resp["games"] = make_game_data(games=games, analyzed_games=analyzed_games)
        await ws.send(json_dumps(resp))
        while True:
            data = await ws.recv()
            if not data:
                continue
            request: WebsocketRequest = json.loads(data)
            if "gameId" in request:
                await req.app.ctx.app.set_game_id(ws, request["gameId"])
    finally:
        ws_notifier.unregister(ws)


#     return json(


# class GameData(TypedDict):
#     id: int
#     name: str
#     isFinished: bool
#     isBeingAnalyzed: bool


# class GamesResponse(TypedDict):
#     games: list[GameData]


# @api.get("/games")
# async def games(request):
#     games = await db.Game.all()
#     analyzed_games = set(g.id for g in request.app.ctx.app.get_games_being_analyzed())
#     games = await db.Game.filter(
#         is_hidden=False, tournament__is_hidden=False
#     ).prefetch_related("tournament")
#     return json(
#         GamesResponse(
#             games=[
#                 GameData(
#                     id=game.id,
#                     name=f"{game.game_name} ({game.round_name}) --- "
#                     f"{game.tournament.name}",
#                     isFinished=game.is_finished,
#                     isBeingAnalyzed=game.id in analyzed_games,
#                 )
#                 for game in games
#             ]
#         )
#     )


# class PlayerResponse(TypedDict):
#     name: str
#     rating: int
#     fideId: Optional[int]
#     fed: Optional[str]


# class GameResponse(TypedDict):
#     gameId: int
#     player1: PlayerResponse
#     player2: PlayerResponse
#     feedUrl: str


# @api.get("/game/<game_id:int>")
# async def game(request, game_id):
#     game = await db.Game.get(id=game_id)

#     return json(
#         GameResponse(
#             gameId=game.id,
#             player1=PlayerResponse(
#                 name=game.player1_name,
#                 rating=game.player1_rating,
#                 fideId=game.player1_fide_id,
#                 fed=game.player1_fed,
#             ),
#             player2=PlayerResponse(
#                 name=game.player2_name,
#                 rating=game.player2_rating,
#                 fideId=game.player2_fide_id,
#                 fed=game.player2_fed,
#             ),
#             feedUrl="https://lichess.org/broadcast/-/-/"
#             f"{game.lichess_round_id}/{game.lichess_id}",
#         )
#     )


# @api.websocket("/ws/moves/<game_id:int>")
# async def game_moves(request: Request, ws: Websocket, game_id):
#     game = await db.Game.get(id=game_id)
#     updates_stream: Optional[MemoryObjectReceiveStream[GamePositionUpdateFrame]] = (
#         request.app.ctx.app.add_moves_observer(game_id)
#     )

#     positions: list[db.GamePosition] = (
#         await db.GamePosition.filter(game=game).order_by("ply_number").all()
#     )
#     positions = (
#         await db.GamePosition.filter(game=game)
#         .order_by("ply_number")
#         .prefetch_related("thinkings")
#         .all()
#     )

#     thinkings: list[Optional[db.GamePositionThinking]] = []
#     for pos in positions:
#         thinkings.append(max(pos.thinkings, key=lambda t: t.nodes, default=None))

#     await ws.send(
#         json_dumps(
#             make_moves_update_frame(
#                 positions=positions,
#                 thinkings=thinkings,
#             )
#         )
#     )

#     if updates_stream:
#         with updates_stream:
#             async for message in updates_stream:
#                 await ws.send(json_dumps(message))


# @api.websocket("/ws/thinking/<thinking_id:int>")
# async def game_thinking(request: Request, ws: Websocket, thinking_id):
#     updates_stream: Optional[MemoryObjectReceiveStream[GameThinkingUpdateFrame]] = (
#         request.app.ctx.app.add_thinking_observer(thinking_id)
#     )

#     evaluations: list[db.GamePositionEvaluation] = (
#         await db.GamePositionEvaluation.filter(thinking_id=thinking_id).order_by("id")
#     )

#     moves: list[list[db.GamePositionEvaluationMove]] = await asyncio.gather(
#         *[
#             db.GamePositionEvaluationMove.filter(evaluation=evaluation).order_by(
#                 "-nodes"
#             )
#             for evaluation in evaluations
#         ]
#     )

#     if evaluations:
#         await ws.send(
#             json_dumps(
#                 make_thinking_update_frame(
#                     thinkings=evaluations,
#                     moves=moves,
#                 )
#             )
#         )

#     if updates_stream:
#         with updates_stream:
#             async for message in updates_stream:
#                 await ws.send(json_dumps(message))
