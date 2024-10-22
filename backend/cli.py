#!/usr/bin/env python3

import click
from tortoise import run_async
import lichess
from rich.table import Table
from rich.console import Console
import datetime
import db
import asyncio


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

    for tournament in asyncio.run(lichess.get_tournaments()):
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

    for board in asyncio.run(lichess.get_boards(round_id))["games"]:
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
@click.option("--tour-id", type=str, required=True)
def add_tournament(tour_id):
    async def run():
        tournament = await lichess.get_tournament(tour_id)
        new_tournament = db.Tournament(
            name=tournament["tour"]["name"],
            lichess_id=tournament["tour"]["id"],
            is_finished=False,
        )
        await new_tournament.save()

    run_async(run())


if __name__ == "__main__":
    run_async(db.init())
    cli()
