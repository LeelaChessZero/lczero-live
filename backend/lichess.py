import io
import json

import aiohttp
import chess.pgn
import ndjson


async def get_tournaments() -> list[dict]:
    async with aiohttp.ClientSession() as session:
        async with session.get("https://lichess.org/api/broadcast") as response:
            response.raise_for_status()
            text = await response.text()
            return ndjson.loads(text)


async def get_tournament(tournament_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://lichess.org/api/broadcast/{tournament_id}"
        ) as response:
            response.raise_for_status()
            text = await response.text()
            return json.loads(text)


async def get_boards(round_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://lichess.org/api/broadcast/-/-/{round_id}"
        ) as response:
            response.raise_for_status()
            text = await response.text()
            res = json.loads(text)
            return res


async def fetch_round_pgns(round_id: str) -> list[chess.pgn.Game]:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"https://lichess.org/api/broadcast/round/{round_id}.pgn"
        ) as response:
            response.raise_for_status()
            text = io.StringIO(await response.text())
            res = []
            while pgn := chess.pgn.read_game(text):
                res.append(pgn)
            return res
