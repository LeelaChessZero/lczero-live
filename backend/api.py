from typing import Optional, TypedDict

import db
from api_types import GamePositionUpdate, GamePositionUpdateFrame
from sanic import Blueprint, Request, Websocket
from sanic.helpers import json_dumps
from sanic.response import json

api = Blueprint("api", url_prefix="/api")


class GameData(TypedDict):
    id: int
    name: str
    isFinished: bool
    isBeingAnalyzed: bool


class GamesResponse(TypedDict):
    games: list[GameData]


@api.get("/games")
async def games(request):
    games = await db.Game.all()
    analyzed_games = set(g.id for g in request.app.ctx.app.get_games_being_analyzed())
    games = await db.Game.filter(
        is_hidden=False, tournament__is_hidden=False
    ).prefetch_related("tournament")
    return json(
        GamesResponse(
            games=[
                GameData(
                    id=game.id,
                    name=f"{game.game_name} ({game.round_name}) --- "
                    f"{game.tournament.name}",
                    isFinished=game.is_finished,
                    isBeingAnalyzed=game.id in analyzed_games,
                )
                for game in games
            ]
        )
    )


class PlayerResponse(TypedDict):
    name: str
    rating: int
    fideId: Optional[int]
    fed: Optional[str]


class GameResponse(TypedDict):
    gameId: int
    player1: PlayerResponse
    player2: PlayerResponse
    feedUrl: str


@api.get("/game/<game_id:int>")
async def game(request, game_id):
    game = await db.Game.get(id=game_id)

    return json(
        GameResponse(
            gameId=game.id,
            player1=PlayerResponse(
                name=game.player1_name,
                rating=game.player1_rating,
                fideId=game.player1_fide_id,
                fed=game.player1_fed,
            ),
            player2=PlayerResponse(
                name=game.player2_name,
                rating=game.player2_rating,
                fideId=game.player2_fide_id,
                fed=game.player2_fed,
            ),
            feedUrl="https://lichess.org/broadcast/-/-/"
            f"{game.lichess_round_id}/{game.lichess_id}",
        )
    )


@api.websocket("/ws/game/<game_id:int>/moves")
async def game_moves(request: Request, ws: Websocket, game_id):
    game = await db.Game.get(id=game_id)
    updates_stream = request.app.ctx.app.add_moves_observer(game_id)

    positions: list[db.GamePosition] = (
        await db.GamePosition.filter(game=game).order_by("ply_number").all()
    )
    positions = (
        await db.GamePosition.filter(game=game)
        .order_by("ply_number")
        .prefetch_related("thinkings")
        .all()
    )

    positions_with_thinking = []
    for pos in positions:
        best_thinking = max(pos.thinkings, key=lambda t: t.nodes, default=None)
        positions_with_thinking.append((pos, best_thinking))

    await ws.send(
        json_dumps(
            GamePositionUpdateFrame(
                positions=[
                    GamePositionUpdate(
                        ply=pos.ply_number,
                        thinkingId=None,
                        moveUci=pos.move_uci,
                        moveSan=pos.move_san,
                        fen=pos.fen,
                        whiteClock=pos.white_clock,
                        blackClock=pos.black_clock,
                        scoreQ=None,
                        scoreW=None,
                        scoreD=None,
                        scoreB=None,
                    )
                    for pos in positions
                ],
            )
        )
    )

    if updates_stream:
        with updates_stream:
            async for message in updates_stream:
                await ws.send(json_dumps(message))
