import dataclasses
from typing import Optional

import math


@dataclasses.dataclass
class MovetimeSection:
    base_time_sec: int = 0
    increment_sec: int = 0
    begin_move: int = 1
    end_move: int = 5000


class MovetimeEstimator:
    sections: list[MovetimeSection]
    min_total_moves: int = 60
    min_moves_left: int = 20

    def __init__(self, tc_spec: str):
        self.sections = []
        cur_move = 1
        for spec in tc_spec.split(":"):
            moves, has_moves, rest = spec.partition("/")
            if not has_moves:
                rest = spec
            base_time, has_increment, increment = rest.partition("+")
            end_move = cur_move + int(moves) if has_moves else 5000
            section = MovetimeSection(
                base_time_sec=int(base_time),
                increment_sec=int(increment) if has_increment else 0,
                begin_move=cur_move,
                end_move=end_move,
            )
            cur_move = end_move
            self.sections.append(section)

    def estimate(self, curr_move: int, cur_clock: Optional[int]):
        if cur_clock is None:
            cur_clock = self.sections[0].base_time_sec
        total_time = cur_clock
        end_move = max(curr_move + self.min_moves_left, self.min_total_moves)
        for section in self.sections:
            if curr_move >= section.end_move:
                continue
            if end_move <= section.begin_move:
                break
            if curr_move < section.begin_move:
                total_time += section.base_time_sec
            total_time += section.increment_sec * (
                min(end_move, section.end_move) - max(curr_move, section.begin_move)
            )
        return total_time / (end_move - curr_move)

    def estimate_elo_adustment(self, curr_move: int, cur_clock: Optional[int]) -> float:
        return 50 * math.log2(
            self.estimate(curr_move=curr_move, cur_clock=cur_clock) / 10
        )


if __name__ == "__main__":
    est = MovetimeEstimator(tc_spec="40/7200:1800+30")
    for move in range(1, 100):
        print(
            move,
            est.estimate(move, 0),
        )
        print(move, est.estimate_elo_adustment(move, 7200 + 1800))
