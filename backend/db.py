from tortoise.models import Model
from tortoise import fields, Tortoise

from config import DB_PATH, DB_MODULES


class Game(Model):
    game_name = fields.CharField(max_length=255)
    pgn_feed_url = fields.CharField(max_length=255)


class GameAttribute(Model):
    game = fields.ForeignKeyField("lc0live.Game", related_name="attributes")
    key = fields.CharField(max_length=255)
    value = fields.CharField(max_length=255)


async def init():
    await Tortoise.init(
        db_url=DB_PATH,
        modules=DB_MODULES,
    )
    await Tortoise.generate_schemas()
