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


# pyright: reportIncompatibleVariableOverride=false
class GamePosition(Model):
    id = fields.IntField(primary_key=True)
    game = fields.ForeignKeyField(model_name="lc0live.Game", related_name="positions")
    # Zero for startpos, 2×move-1 after white move, 2×move after black move.
    ply_number = fields.IntField()
    fen = fields.CharField(max_length=128)
    move_uci = fields.CharField(max_length=5, null=True)
    move_san = fields.CharField(max_length=10, null=True)
    # Zero-based ply number
    white_clock = fields.IntField(null=True)
    black_clock = fields.IntField(null=True)

    thinkings: fields.ReverseRelation["GamePositionThinking"]

    class Meta:
        unique_together = (("game_id", "ply_number"),)


class GamePositionThinking(Model):
    id = fields.IntField(primary_key=True)
    position = fields.ForeignKeyField(
        model_name="lc0live.GamePosition", related_name="thinkings"
    )
    nodes = fields.IntField()
    q_score = fields.IntField()
    win_score = fields.IntField()
    draw_score = fields.IntField()
    loss_score = fields.IntField()


class GamePositionEvaluation(Model):
    id = fields.IntField(primary_key=True)
    thinking = fields.ForeignKeyField(
        model_name="lc0live.GamePositionThinking", related_name="evaluations"
    )
    nodes = fields.IntField()
    time = fields.IntField()
    depth = fields.IntField()
    seldepth = fields.IntField()


class GamePositionEvaluationMove(Model):
    id = fields.IntField(primary_key=True)
    evaluation = fields.ForeignKeyField(
        model_name="lc0live.GamePositionEvaluation", related_name="pv"
    )
    move_san = fields.CharField(max_length=10)
    q_score = fields.IntField()
    pv = fields.TextField()
    mate_score = fields.IntField(null=True)
    win_score = fields.IntField()
    draw_score = fields.IntField()
    loss_score = fields.IntField()


async def init():
    await Tortoise.init(
        db_url=DB_PATH,
        modules=DB_MODULES,
    )
    await Tortoise.generate_schemas()
