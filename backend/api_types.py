from typing import TypedDict, Optional


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


class GamePositionUpdateFrame(TypedDict, total=False):
    positions: list[GamePositionUpdate]
