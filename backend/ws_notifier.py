import dataclasses
from typing import Optional, TypedDict

import anyio
import db
from sanic import Websocket
from sanic.helpers import json_dumps
from sanic.log import logger
from websockets.exceptions import ConnectionClosed
from sanic.exceptions import WebsocketClosed

# Global data


class WsGlobalData(TypedDict, total=False):
    message: str
    numViewers: int
    jsHash: str


# Per game data


class WsPlayerData(TypedDict):
    name: str
    rating: int
    fideId: Optional[int]
    fed: Optional[str]


class WsGameData(TypedDict):
    gameId: int
    name: str
    isFinished: bool
    isBeingAnalyzed: bool
    player1: WsPlayerData
    player2: WsPlayerData
    feedUrl: str


# Per position data


class WsPositionData(TypedDict):
    gameId: int
    ply: int  # 0 for startpos
    moveUci: Optional[str]
    moveSan: Optional[str]
    fen: str
    whiteClock: Optional[int]
    blackClock: Optional[int]
    scoreQ: Optional[int]
    scoreW: Optional[int]
    scoreD: Optional[int]
    scoreB: Optional[int]
    movesLeft: Optional[int]
    nodes: Optional[int]
    time: Optional[int]
    depth: Optional[int]
    seldepth: Optional[int]


# Per evaluation data


class WsVariationData(TypedDict, total=False):
    nodes: int
    pvSan: str
    pvUci: str
    scoreQ: int
    scoreW: int
    scoreD: int
    scoreB: int
    mateScore: Optional[int]


class WsEvaluationData(TypedDict):
    gameId: int
    ply: int
    evalId: int
    nodes: int
    time: int
    depth: int
    seldepth: int
    movesLeft: Optional[int]
    variations: list[WsVariationData]


# Websocket frame


class WebsocketRequest(TypedDict, total=False):
    gameId: int
    ply: int


class WebsocketResponse(TypedDict, total=False):
    status: WsGlobalData
    games: list[WsGameData]
    positions: list[WsPositionData]
    evaluations: list[WsEvaluationData]


def make_game_data(game: db.Game, is_being_analyzed: bool) -> WsGameData:
    return WsGameData(
        gameId=game.id,
        name=f"{game.game_name} ({game.round_name}) --- " f"{game.tournament.name}",
        isFinished=game.is_finished,
        isBeingAnalyzed=is_being_analyzed,
        player1=WsPlayerData(
            name=game.player1_name,
            rating=game.player1_rating,
            fideId=game.player1_fide_id,
            fed=game.player1_fed,
        ),
        player2=WsPlayerData(
            name=game.player2_name,
            rating=game.player2_rating,
            fideId=game.player2_fide_id,
            fed=game.player2_fed,
        ),
        feedUrl="https://lichess.org/broadcast/-/-/"
        f"{game.lichess_round_id}/{game.lichess_id}",
    )


def make_games_data(games: list[db.Game], analyzed_games: set[int]) -> list[WsGameData]:
    return [make_game_data(game, game.id in analyzed_games) for game in games]


def make_evaluations_update(
    game_id: int,
    ply: int,
    evaluations: list[db.GamePositionEvaluation],
    moves: list[list[db.GamePositionEvaluationMove]],
) -> list[WsEvaluationData]:
    return [
        WsEvaluationData(
            gameId=game_id,
            ply=ply,
            evalId=eval_.id,
            nodes=eval_.nodes,
            time=eval_.time,
            depth=eval_.depth,
            seldepth=eval_.seldepth,
            movesLeft=eval_.moves_left,
            variations=[
                (
                    WsVariationData(
                        nodes=move.nodes,
                        pvSan=move.pv_san,
                        pvUci=move.pv_uci,
                        scoreQ=move.q_score,
                        scoreW=move.white_score,
                        scoreD=move.draw_score,
                        scoreB=move.black_score,
                        mateScore=move.mate_score,
                    )
                    if i == len(evaluations) - 1
                    else WsVariationData(
                        nodes=move.nodes,
                    )
                )
                for move in moves
            ],
        )
        for i, (eval_, moves) in enumerate(zip(evaluations, moves))
    ]


def make_positions_update(
    game_id: int,
    positions: list[db.GamePosition],
) -> list[WsPositionData]:
    return [
        WsPositionData(
            gameId=game_id,
            ply=pos.ply_number,
            moveUci=pos.move_uci,
            moveSan=pos.move_san,
            fen=pos.fen,
            whiteClock=pos.white_clock,
            blackClock=pos.black_clock,
            scoreQ=pos.q_score,
            scoreW=pos.white_score,
            scoreD=pos.draw_score,
            scoreB=pos.black_score,
            movesLeft=pos.moves_left,
            nodes=pos.nodes,
            time=pos.time,
            depth=pos.depth,
            seldepth=pos.seldepth,
        )
        for pos in positions
    ]


@dataclasses.dataclass
class WebsocketSubscription:
    ws: Websocket
    game_id: Optional[int] = None
    ply: Optional[int] = None


class WebsocketNotifier:
    _subscriptions: dict[Websocket, WebsocketSubscription]

    def __init__(self):
        self._subscriptions = dict()

    def register(self, ws: Websocket) -> None:
        self._subscriptions[ws] = WebsocketSubscription(ws=ws)

    def unregister(self, ws: Websocket) -> None:
        self._subscriptions.pop(ws)

    def num_subscribers(self) -> int:
        return len(self._subscriptions)

    def set_game_and_ply(
        self, ws: Websocket, game_id: int, ply: Optional[int] = None
    ) -> bool:
        entry = self._subscriptions[ws]
        game_changed = entry.game_id != game_id
        entry.game_id = game_id
        entry.ply = ply
        return game_changed

    async def send_game_entry_update(self, game: db.Game, is_being_analyzed: bool):
        response = WebsocketResponse()
        response.update(games=[make_game_data(game, is_being_analyzed)])
        await self.notify_observers(response)

    async def send_game_update(
        self,
        game_id: int,
        positions: Optional[list[db.GamePosition]] = None,
        ply: Optional[int] = None,
        evaluations: Optional[list[db.GamePositionEvaluation]] = None,
        moves: Optional[list[list[db.GamePositionEvaluationMove]]] = None,
    ):
        response = WebsocketResponse()
        if positions is not None:
            response.update(
                positions=make_positions_update(game_id=game_id, positions=positions)
            )
        if evaluations is not None:
            assert moves is not None
            assert ply is not None
            response.update(
                evaluations=make_evaluations_update(
                    game_id=game_id, ply=ply, evaluations=evaluations, moves=moves
                )
            )
        await self.notify_observers(response, game_id=game_id)

    async def send_text(self, ws: Websocket, response: str):
        try:
            await ws.send(response)
        except ConnectionClosed as e:
            logger.info(f"Connection closed, {e}")
            pass
        except WebsocketClosed as e:
            logger.info(f"Websocket closed, {e}")
            pass

    async def send_response(self, ws: Websocket, response: WebsocketResponse):
        await self.send_text(ws, json_dumps(response))

    async def notify_observers(
        self,
        response: WebsocketResponse,
        game_id: Optional[int] = None,
        ply: Optional[int] = None,
    ) -> None:
        subs = list(self._subscriptions.values())

        raw_response = json_dumps(response)
        async with anyio.create_task_group() as tg:
            for sub in subs:
                if game_id is not None and sub.game_id != game_id:
                    continue
                if ply is not None and sub.ply != ply:
                    continue
                tg.start_soon(self.send_text, sub.ws, raw_response)
