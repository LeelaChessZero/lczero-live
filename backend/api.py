from sanic import Blueprint
import dataclasses
from dataclasses import asdict
from sanic.response import json

from db import Game

api = Blueprint("api", url_prefix="/api")


@dataclasses.dataclass
class GameData:
    id: int
    name: str
    isFinished: bool
    isBeingAnalyzed: bool


@dataclasses.dataclass
class GamesResponse:
    games: list[GameData]


@api.get("/games")
async def games(request):
    games = await Game.all()
    analyzed_games = set(g.id for g in request.app.ctx.app.get_games_being_analyzed())
    games = await Game.all().prefetch_related("tournament")
    return json(
        asdict(
            GamesResponse(
                [
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
    )
