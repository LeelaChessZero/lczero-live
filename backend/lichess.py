import ndjson
import json
import aiohttp


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
            return json.loads(text)
