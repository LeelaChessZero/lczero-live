from sanic import Blueprint
import dataclasses
from dataclasses import asdict
from sanic.response import json
# from db import Game

api = Blueprint("api", url_prefix="/api")


@dataclasses.dataclass
class GameData:
    id: int
    name: str


@dataclasses.dataclass
class GamesResponse:
    games: list[GameData]
    curGameId: int


@api.get("/games")
async def games(request):
    games = GameData(1, "Chess")
    return json(asdict(GamesResponse([games], 1)))
