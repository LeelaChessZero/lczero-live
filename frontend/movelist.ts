
export interface GamePositionResponse {
  ply: number;  // 0 for startpos
  thinkingId?: number;
  moveUci?: string;
  moveSan?: string;
  fen: string;
  whiteClock?: number;
  blackClock?: number;
  scoreQ?: number;
  scoreW?: number;
  scoreD?: number;
  scoreL?: number;
}

export class MoveList {
  private element: HTMLElement;
  private positions: GamePositionResponse[] = [];

  constructor(element: HTMLElement) {
    this.element = element;
  }

  public setPositions(positions: GamePositionResponse[]): void {
    this.positions = positions;
    this.element.innerHTML = '';
    positions.forEach(position => {
      if (position.ply === 0) return;
      const move_idx = Math.floor((position.ply + 1) / 2);
      const is_black = (position.ply % 2) === 0;

      const rowEl = document.createElement('div');
      rowEl.innerHTML =
          `${is_black ? '&nbsp;&nbsp;&nbsp;…' : `${move_idx}. `} ${
              position.moveSan}`;
      this.element.appendChild(rowEl);
    });
  }
};