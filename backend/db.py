from tortoise.models import Model
from tortoise import fields, Tortoise

from config import DB_PATH, DB_MODULES


class Tournament(Model):
    id = fields.IntField(primary_key=True)
    name = fields.CharField(max_length=255)
    lichess_id = fields.CharField(max_length=16, unique=True)
    is_finished = fields.BooleanField(default=False, index=True)


class Game(Model):
    id = fields.IntField(primary_key=True)
    tournament = fields.ForeignKeyField(
        model_name="lc0live.Tournament", related_name="games"
    )
    game_name = fields.CharField(max_length=255)
    lichess_round_id = fields.CharField(max_length=16)
    lichess_id = fields.CharField(max_length=16)
    round_name = fields.CharField(max_length=255)
    player1_name = fields.CharField(max_length=255)
    player1_fide_id = fields.IntField(null=True)
    player1_rating = fields.IntField(null=True)
    player1_fed = fields.CharField(max_length=3, null=True)
    player2_name = fields.CharField(max_length=255)
    player2_fide_id = fields.IntField(null=True)
    player2_rating = fields.IntField(null=True)
    player2_fed = fields.CharField(max_length=3, null=True)
    status = fields.CharField(max_length=4)
    is_finished = fields.BooleanField(default=False, index=True)


class GameFilter(Model):
    game = fields.ForeignKeyField(model_name="lc0live.Game", related_name="filters")
    key = fields.CharField(max_length=255)
    value = fields.CharField(max_length=255)


async def init():
    await Tortoise.init(
        db_url=DB_PATH,
        modules=DB_MODULES,
    )
    await Tortoise.generate_schemas()
