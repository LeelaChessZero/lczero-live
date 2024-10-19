#!/usr/bin/env python3

import click
from tortoise import run_async
import lichess
from rich.table import Table
from rich.console import Console
from rich import print
import datetime
import db


@click.group()
def cli(): ...


def ts_to_datetime(ts: int) -> datetime.datetime:
    return datetime.datetime.fromtimestamp(ts / 1000)


def ts_to_str(ts: int) -> str:
    return ts_to_datetime(ts).strftime("%Y-%m-%d %H:%M:%S")


@cli.command()
@click.option("--min-tier", type=int, default=5)
@click.option("--only-active", is_flag=True)
def list_tournaments(min_tier, only_active):
    table = Table(title="Tournaments")
    table.add_column("Id")
    table.add_column("Name")
    table.add_column("Tier")
    table.add_column("Round ID")
    table.add_column("Round")
    table.add_column("Created")
    table.add_column("Active?")
    table.add_column("Starts")
    table.add_column("Finished")
    table.add_column("URL")

    for tournament in lichess.get_tournaments():
        tour = tournament["tour"]
        tier = tour["tier"]
        if tier < min_tier:
            continue
        if only_active and all(
            not round.get("ongoing", False) for round in tournament["rounds"]
        ):
            continue
        table.add_row(tour["id"], tour["name"], str(tier))
        for round in tournament["rounds"]:
            table.add_row(
                "",
                "",
                "",
                round["id"],
                round["name"],
                ts_to_str(round["createdAt"]),
                str(round.get("ongoing", False)),
                (
                    "after"
                    if round.get("startsAfterPrevious")
                    else ts_to_str(round["startsAt"])
                ),
                str(round.get("finished", False)),
                round["url"],
            )
    console = Console()
    console.print(table)


@cli.command()
@click.option("--round-id", type=str, required=True)
def list_boards(round_id):
    table = Table(title="Boards")
    table.add_column("Id")
    table.add_column("Name")
    table.add_column("Player1")
    table.add_column("Player2")
    table.add_column("Status")

    for board in lichess.get_boards(round_id)["games"]:
        table.add_row(
            board["id"],
            board["name"],
            board["players"][0]["name"],
            board["players"][1]["name"],
            board["status"],
        )
    console = Console()
    console.print(table)


@cli.command()
@click.option("--round-id", type=str, required=True)
@click.option("--board-id", type=str, required=True)
@click.option("--include-round", is_flag=True)
def add_board(round_id, board_id, include_round):
    round = lichess.get_boards(round_id)
    board = next((board for board in round["games"] if board["id"] == board_id), None)
    print(round)
    print(board)
    run_async(db.init())
    new_game = db.Game(
        tour_name=round["tour"]["name"],
        round_name=round["round"]["name"],
        board_name=board["name"],
        player1name=board["players"][0]["name"],
        player2name=board["players"][1]["name"],
        player1id=board["players"][0]["fideId"],
        player2id=board["players"][1]["fideId"],
        round_pgn_name=round["round"]["name"] if include_round else None,
        createdAt=datetime.datetime.now(),
        startsAt=datetime.datetime.fromtimestamp(round["round"]["startsAt"] / 1000),
        finished=round["round"]["finished"],
        game_result=board["status"],
        pgn_feed_url=f"https://lichess.org/api/stream/broadcast/round/{
            round['round']['id']}.pgn",
    )
    print(new_game)
    run_async(new_game.save())


if __name__ == "__main__":
    cli()
