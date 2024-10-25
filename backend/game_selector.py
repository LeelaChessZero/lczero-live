import asyncio
import dataclasses
from typing import Any, Optional

import chess.pgn
import lichess
from db import Game, GameFilter, Tournament
from sanic.log import logger
from tortoise.transactions import in_transaction


@dataclasses.dataclass
class GameInfo:
    game: dict
    round: dict
    tour: dict
    tour_id: int


async def get_game_candidates() -> list[GameInfo]:
    # Gather ongoing games from unfinished tournaments.
    ongoing_tournaments = await Tournament.filter(is_finished=False)
    tournaments = [
        await lichess.get_tournament(t.lichess_id) for t in ongoing_tournaments
    ]
    # Check for finished tournaments.
    for db_t, tournament in zip(ongoing_tournaments, tournaments):
        if all(r.get("finished", False) for r in tournament["rounds"]):
            logger.info(f"Tournament {db_t.id} [{db_t.name}] " "is now finished.")
            db_t.is_finished = True
            await db_t.save()
    # Check for cadidate games.
    candidate_round_ids: list[str] = []
    candidate_round_tour_ids: list[int] = []
    for t, db_t in zip(tournaments, ongoing_tournaments):
        for r in t["rounds"]:
            if not r.get("ongoing", False):
                continue
            candidate_round_ids.append(r["id"])
            candidate_round_tour_ids.append(db_t.id)
    candidate_rounds = await asyncio.gather(
        *[lichess.get_boards(rid) for rid in candidate_round_ids]
    )
    candidates: list[GameInfo] = []
    for r, tid in zip(candidate_rounds, candidate_round_tour_ids):
        for g in r["games"]:
            if g.get("status") != "*":
                continue
            candidates.append(GameInfo(g, r["round"], r["tour"], tid))
    return candidates


def get_best_game(game_infos: list[GameInfo]) -> GameInfo:
    logger.info(f"Selecting best game from {len(game_infos)} games")
    return min(
        game_infos,
        #        key=lambda gi: max([p.get("rating", 9999) for p in gi.game["players"]]),
        key=lambda gi: max([p.get("clock", 999999) for p in gi.game["players"]]),
    )


async def make_game(info: GameInfo) -> Game:
    pgns = await lichess.fetch_round_pgns(info.round["id"])

    def matches_gameinfo(pgn: chess.pgn.Game) -> bool:
        hdrs = pgn.headers

        def cmp(a: Optional[str], b: Any):
            if a is None or b is None:
                return True
            return a == str(b)

        return all(
            cmp(a, b)
            for a, b in [
                (hdrs.get("White"), info.game["players"][0]["name"]),
                (hdrs.get("Black"), info.game["players"][1]["name"]),
                (hdrs.get("WhiteElo"), info.game["players"][0].get("rating")),
                (hdrs.get("BlackElo"), info.game["players"][1].get("rating")),
                (hdrs.get("WhiteFideId"), info.game["players"][0].get("fideId")),
                (hdrs.get("BlackFideId"), info.game["players"][1].get("fideId")),
                (hdrs.get("Result"), "*"),
            ]
        )

    pgn = list(filter(matches_gameinfo, pgns))

    if len(pgn) != 1:
        logger.error(f"Found {len(pgn)} pgns for game {info.game['id']}")
        raise ValueError(f"{len(pgn)} pgns found for game {info.game['id']}")

    async with in_transaction():
        game = await Game.create(
            tournament_id=info.tour_id,
            game_name=info.game["name"],
            lichess_round_id=info.round["id"],
            lichess_id=info.game["id"],
            round_name=info.round["name"],
            player1_name=info.game["players"][0]["name"],
            player1_fide_id=info.game["players"][0].get("fideId"),
            player1_rating=info.game["players"][0].get("rating"),
            player1_fed=info.game["players"][0].get("fed"),
            player2_name=info.game["players"][1]["name"],
            player2_fide_id=info.game["players"][1].get("fideId"),
            player2_rating=info.game["players"][1].get("rating"),
            player2_fed=info.game["players"][1].get("fed"),
            status=info.game["status"],
            is_finished=False,
        )
        await GameFilter.bulk_create(
            [
                GameFilter(game=game, key=attr, value=pgn[0].headers[attr])
                for attr in [
                    "Event",
                    "Date",
                    "Round",
                    "White",
                    "Black",
                    "WhiteElo",
                    "BlackElo",
                    "WhiteFideId",
                    "BlackFideId",
                    "WhiteFed",
                    "BlackFed",
                    "TimeControl",
                ]
                if attr in pgn[0].headers
            ],
        )
    return game
