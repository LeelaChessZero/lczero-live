import ndjson
import json
import requests


def get_tournaments() -> list[dict]:
    response = requests.get("https://lichess.org/api/broadcast")
    response.raise_for_status()
    return ndjson.loads(response.text)


def get_boards(round_id: str) -> dict:
    response = requests.get(f"https://lichess.org/api/broadcast/-/-/{round_id}")
    response.raise_for_status()
    return json.loads(response.text)
