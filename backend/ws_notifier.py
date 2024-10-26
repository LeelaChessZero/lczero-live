from typing import Optional, TypedDict

import anyio
import db
from anyio.streams.memory import MemoryObjectReceiveStream, MemoryObjectSendStream


class GamePositionUpdate(TypedDict):
    ply: int  # 0 for startpos
    thinkingId: Optional[int]
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


class GamePositionUpdateFrame(TypedDict, total=False):
    positions: list[GamePositionUpdate]


class GameThinkingMoveUpdate(TypedDict):
    moveUci: str
    moveOppUci: Optional[str]
    moveSan: str
    pvSan: str
    scoreQ: int
    scoreW: int
    scoreD: int
    scoreB: int
    mateScore: Optional[int]
    movesLeft: Optional[int]


class GameThinkingUpdate(TypedDict):
    updateId: int
    nodes: int
    scoreQ: Optional[int]
    scoreW: Optional[int]
    scoreD: Optional[int]
    scoreB: Optional[int]
    moves: list[GameThinkingMoveUpdate]


class GameThinkingUpdateFrame(TypedDict):
    thinkings: list[GameThinkingUpdate]


def make_moves_update_frame(
    updated_positions: list[db.GamePosition],
    thinkings: Optional[list[Optional[db.GamePositionThinking]]] = None,
) -> GamePositionUpdateFrame:
    if thinkings is None:
        thinkings = [None for x in range(len(updated_positions))]
    moves_websocket_frame = GamePositionUpdateFrame(positions=[])

    for pos, thinking in zip(updated_positions, thinkings):
        moves_websocket_frame.setdefault("positions", []).append(
            GamePositionUpdate(
                ply=pos.ply_number,
                thinkingId=thinking.id if thinking else None,
                moveUci=pos.move_uci,
                moveSan=pos.move_san,
                fen=pos.fen,
                whiteClock=pos.white_clock,
                blackClock=pos.black_clock,
                scoreQ=thinking.q_score if thinking else None,
                scoreW=thinking.white_score if thinking else None,
                scoreD=thinking.draw_score if thinking else None,
                scoreB=thinking.black_score if thinking else None,
                movesLeft=thinking.moves_left if thinking else None,
            )
        )

    return moves_websocket_frame


class WebsocketNotifier:
    _move_observers: set[MemoryObjectSendStream[GamePositionUpdateFrame]]
    _thinking_observers: set[MemoryObjectSendStream[GameThinkingUpdateFrame]]

    def __init__(self):
        self._move_observers = set()
        self._thinking_observers = set()

    def add_moves_observer(
        self,
    ) -> MemoryObjectReceiveStream[GamePositionUpdateFrame]:
        send_stream, recv_stream = anyio.create_memory_object_stream[
            GamePositionUpdateFrame
        ]()
        self._move_observers.add(send_stream)
        return recv_stream

    async def notify_move_observers(
        self,
        updated_positions: list[db.GamePosition],
        thinkings: Optional[list[Optional[db.GamePositionThinking]]] = None,
    ):
        if not updated_positions:
            return

        moves_websocket_frame = make_moves_update_frame(
            updated_positions=updated_positions, thinkings=thinkings
        )

        new_observers = set()
        for observer in self._move_observers:
            try:
                await observer.send(moves_websocket_frame)
                new_observers.add(observer)
            except anyio.EndOfStream:
                await observer.aclose()
            except anyio.BrokenResourceError:
                await observer.aclose()
        self._move_observers = new_observers
