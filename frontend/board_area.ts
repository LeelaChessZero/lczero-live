import {ArrowInfo, selectArrowsToRender} from './arrow_selector';
import {Board, moveToDirectionDeg} from './board';
import {VerticalWdlBar} from './vwdl';
import {isValidWdl} from './wdl';
import {WsEvaluationData, WsGameData, WsPlayerData, WsPositionData} from './ws_feed';

function formatTime(seconds?: number, alwaysShowHours: boolean = true): string {
  if (seconds == null) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours == 0 && !alwaysShowHours) {
    return `${minutes.toString().padStart(2, '0')}:${
        secs.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatClock(seconds?: number, thinkingTime?: number): string {
  if (seconds == null) return '';
  if (thinkingTime) {
    seconds -= thinkingTime / 1000;
    return `(${formatTime(thinkingTime / 1000, false)}) ${formatTime(seconds)}`;
  }
  return formatTime(seconds);
}

function renderPlayer(player: WsPlayerData, element: HTMLElement): void {
  element.innerText = `${player.name}`;
}
type Counts = {
  current: number,
  total: number
};

export type SideBoardVisualization = {
  className: string,
  lastMove: string|null,
  fen: string,
  moveArrows: string[],
  outlines: string[],
};

interface BoardAreaObserver {
  onSquareClicked(square: string): void;
}

export class BoardArea {
  private board: Board;
  private pvBoard: Board;
  private flipped: boolean = false;
  private currentPosition: WsPositionData;
  private positionIsOngoing: boolean = false;
  private lastUpdateTimestamp: number = 0;
  private sideBoardVisualization?: SideBoardVisualization;
  private observers: BoardAreaObserver[] = [];

  constructor() {
    const boardEl = document.getElementById('board') as HTMLElement;
    this.board = new Board(boardEl);
    this.pvBoard = new Board(boardEl);
    this.pvBoard.boardClass = 'pv-board';
    boardEl.addEventListener('click', this.onClick.bind(this));
    this.renderCorrectBoard();
    setInterval(() => {
      this.updateClocks();
    }, 400);
  }

  public addObserver(observer: BoardAreaObserver): void {
    this.observers.push(observer);
  }

  public removeObserver(observer: BoardAreaObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  private onClick(event: MouseEvent): void {
    const board = this.sideBoardVisualization ? this.pvBoard : this.board;
    const square = board.getSquareAtClientPoint(event.clientX, event.clientY);
    if (square) {
      event.stopPropagation();
      this.observers.forEach(o => o.onSquareClicked(square));
    }
  }

  public setSideBoardVisualization(sideBoardVisualization:
                                       SideBoardVisualization): void {
    this.sideBoardVisualization = sideBoardVisualization;
    this.pvBoard.boardClass = sideBoardVisualization.className;
    const fen = sideBoardVisualization.fen;
    this.pvBoard.fromFen(fen);
    if (sideBoardVisualization.lastMove) {
      this.pvBoard.addHighlight(sideBoardVisualization.lastMove.slice(0, 2));
      this.pvBoard.addHighlight(sideBoardVisualization.lastMove.slice(2, 4));
    }

    const ply0 =
        `arrow-variation-${fen.split(' ')[1] === 'w' ? 'white' : 'black'}`;
    const ply1 =
        `arrow-variation-${fen.split(' ')[1] === 'w' ? 'black' : 'white'}`;

    const moves = sideBoardVisualization.moveArrows;
    if (moves.length > 0) {
      this.pvBoard.addArrow({
        move: moves[0],
        classes: `${ply0} arrow arrow-variation-ply0`,
        width: 15,
        angle: 0,
        headLength: 20,
        headWidth: 30,
        dashLength: 1000,
        dashSpace: 0,
        renderAfterPieces: false,
        offset: 0,
        totalOffsets: 1,
        offsetDirection: 0,
      });
    }

    if (moves.length > 1) {
      this.pvBoard.addArrow({
        move: moves[1],
        classes: `${ply1} arrow arrow-variation-ply1`,
        width: 7,
        angle: Math.PI / 6,
        headLength: 10,
        headWidth: 15,
        dashLength: 10,
        dashSpace: 10,
        renderAfterPieces: true,
        offset: 0,
        totalOffsets: 1,
        offsetDirection: 0,
      });
    }

    const pushManeuver = (ply: number, drawMove: (move: string) => void) => {
      if (ply >= moves.length) return;
      const visitedSquares = new Set<string>();
      visitedSquares.add(moves[ply - 2].slice(2, 4));
      let prevMove = '';
      while (ply < moves.length) {
        const move = moves[ply];
        if (!visitedSquares.has(move.slice(0, 2))) break;
        if (visitedSquares.has(move.slice(2, 4))) break;
        prevMove = move;
        visitedSquares.add(move.slice(2, 4));
        drawMove(move);
        ply += 2;
      }
    };
    pushManeuver(2, move => {
      this.pvBoard.addArrow({
        move,
        classes: `${ply0} arrow arrow-variation-ply2`,
        width: 2,
        angle: Math.PI / 3,
        headLength: 10,
        headWidth: 15,
        dashLength: 8,
        dashSpace: 0,
        renderAfterPieces: true,
        offset: 0,
        totalOffsets: 1,
        offsetDirection: 0,
        onlyOuterStroke: true,
      });
    });

    pushManeuver(3, move => {
      this.pvBoard.addArrow({
        move,
        classes: `${ply1} arrow arrow-variation-ply3`,
        width: 2,
        angle: Math.PI / 3,
        headLength: 5,
        headWidth: 10,
        dashLength: 5,
        dashSpace: 5,
        renderAfterPieces: true,
        offset: 0,
        totalOffsets: 1,
        offsetDirection: 0,
      });
    });

    for (const outline of sideBoardVisualization.outlines) {
      this.pvBoard.addOutline(
          {square: outline, className: 'square-outline-dst', inset: 3});
    }
    this.renderCorrectBoard();
  }

  public resetSideBoardVisualization(): void {
    this.sideBoardVisualization = undefined;
    this.renderCorrectBoard();
  }

  private renderCorrectBoard(): void {
    if (this.sideBoardVisualization) {
      this.pvBoard.render();
    } else {
      this.board.render();
    }
  }

  public updatePlayers(game: WsGameData): void {
    const white = this.flipped ? 'top' : 'bottom';
    const black = this.flipped ? 'bottom' : 'top';
    renderPlayer(game.player1, document.getElementById(`player-${white}`)!);
    renderPlayer(game.player2, document.getElementById(`player-${black}`)!);
  }

  public changePosition(
      position: WsPositionData, isChanged: boolean, isOngoing: boolean,
      nextMoveUci?: string): void {
    this.currentPosition = position;
    this.positionIsOngoing = isOngoing;
    this.lastUpdateTimestamp = Date.now();
    if (isChanged) {
      this.board.fromFen(position.fen);
      if (nextMoveUci) this.renderMovePlayedOutline(nextMoveUci);
      this.board.clearHighlights();
      if (position.moveUci) {
        this.board.addHighlight(position.moveUci.slice(0, 2));
        this.board.addHighlight(position.moveUci.slice(2, 4));
      }
      const white = this.flipped ? 'top' : 'bottom';
      const black = this.flipped ? 'bottom' : 'top';
      this.renderCorrectBoard();
    }
    this.updateClocks();
  }

  private updateClocks(): void {
    if (!this.currentPosition) return;
    const whiteToMove: boolean = this.currentPosition.fen.split(' ')[1] === 'w';
    const white = this.flipped ? 'top' : 'bottom';
    const black = this.flipped ? 'bottom' : 'top';
    let thinkingTimeMs = this.currentPosition.time;
    if (thinkingTimeMs && this.positionIsOngoing) {
      thinkingTimeMs += Date.now() - this.lastUpdateTimestamp;
    }
    document.getElementById(`player-${white}-clock`)!.innerText = formatClock(
        this.currentPosition.whiteClock,
        whiteToMove ? thinkingTimeMs : undefined);
    document.getElementById(`player-${black}-clock`)!.innerText = formatClock(
        this.currentPosition.blackClock,
        whiteToMove ? undefined : thinkingTimeMs);
  }

  public updateEvaluation(update: WsEvaluationData, nextMoveUci?: string):
      void {
    this.updateBoardArrows(update, nextMoveUci);
  }

  private buildArrowOffsets(update: WsEvaluationData, arrowInfos: ArrowInfo[]):
      [Counts[], Counts[]] {
    const dirToCount = new Map<string, Counts>();

    const usVariations: Counts[] = [];
    const themVariations: Counts[] = [];

    for (let arrow of arrowInfos) {
      if (arrow.ply >= 2) continue;
      const variation = update.variations[arrow.variationIdx];
      const move = variation.pvUci.split(' ')[arrow.ply];
      const from = move.slice(0, 2);
      const key = `${from}:${moveToDirectionDeg(move)}`;
      if (!dirToCount.has(key)) dirToCount.set(key, {current: 0, total: 0});
      dirToCount.get(key)!.total++;
    }

    for (let arrow of arrowInfos) {
      if (arrow.ply >= 2) continue;
      const variation = update.variations[arrow.variationIdx];
      const move = variation.pvUci.split(' ')[arrow.ply];
      const from = move.slice(0, 2);
      const key = `${from}:${moveToDirectionDeg(move)}`;
      const value = dirToCount.get(key)!;
      const varIdx = arrow.variationIdx;
      if (arrow.ply == 0) {
        usVariations[varIdx] = {...value};
      } else {
        themVariations[varIdx] = {...value};
      }
      value.current++;
    }
    return [usVariations, themVariations];
  }

  private renderThinkingarrows(update: WsEvaluationData): void {
    const arrows = selectArrowsToRender(update);
    const [usVars, themVars] = this.buildArrowOffsets(update, arrows);

    for (let arrow of arrows) {
      const variation = update.variations[arrow.variationIdx];
      const ply = arrow.ply;
      const move = variation.pvUci.split(' ')[ply];
      const width = Math.pow(variation.nodes / update.nodes, 1 / 1.7) * 15;

      const classes = `arrow arrow-variation${arrow.variationIdx} arrow-ply${
          ply <= 2 ? ply : (ply % 2 + 2)}`;

      if (ply == 0) {
        this.board.addArrow({
          move,
          classes,
          width: width + 1,
          angle: 0,
          headLength: 20,
          headWidth: width + 14,
          dashLength: 1000,
          dashSpace: 0,
          renderAfterPieces: false,
          offset: usVars[arrow.variationIdx].current,
          totalOffsets: usVars[arrow.variationIdx].total,
          offsetDirection: moveToDirectionDeg(move),
        });
      } else if (ply == 1) {
        this.board.addArrow({
          move,
          classes,
          width: width / 2.2 + 1,
          angle: Math.PI / 6,
          headLength: 10,
          headWidth: width / 2 + 8,
          dashLength: 10,
          dashSpace: 10,
          renderAfterPieces: true,
          offset: themVars[arrow.variationIdx].current,
          totalOffsets: themVars[arrow.variationIdx].total,
          offsetDirection: moveToDirectionDeg(move),
        });
      } else if (ply % 2 == 0) {
        this.board.addArrow({
          move,
          classes,
          width: 2,
          angle: -Math.PI / 2,
          headLength: 10,
          headWidth: 15,
          dashLength: 8,
          dashSpace: 0,
          renderAfterPieces: true,
          offset: usVars[arrow.variationIdx].current,
          totalOffsets: usVars[arrow.variationIdx].total,
          offsetDirection: moveToDirectionDeg(variation.pvUci.split(' ')[0]),
          onlyOuterStroke: true,
        });
      } else {  //  ply % 2 == 1
        this.board.addArrow({
          move,
          classes,
          width: 2,
          angle: Math.PI / 3,
          headLength: 5,
          headWidth: 10,
          dashLength: 5,
          dashSpace: 5,
          renderAfterPieces: true,
          offset: themVars[arrow.variationIdx].current,
          totalOffsets: themVars[arrow.variationIdx].total,
          offsetDirection: moveToDirectionDeg(variation.pvUci.split(' ')[1]),
        });
      }
    }
  }

  private renderMovePlayedOutline(move: string): void {
    this.board.clearOutlines();
    this.board.addOutline(
        {square: move.slice(0, 2), className: 'square-outline', inset: 2});
    this.board.addOutline(
        {square: move.slice(2, 4), className: 'square-outline-dst', inset: 4});
  }

  private updateBoardArrows(update?: WsEvaluationData, nextMoveUci?: string):
      void {
    this.board.clearArrows();
    if (nextMoveUci) this.renderMovePlayedOutline(nextMoveUci);
    if (update) this.renderThinkingarrows(update);
    this.renderCorrectBoard();
  }

  public updatePosition(position: WsPositionData): void {
    if (isValidWdl(position.scoreW, position.scoreD, position.scoreB)) {
      const vbar = new VerticalWdlBar(
          position.scoreW!, position.scoreD!, position.scoreB!);
      vbar.render(document.getElementById('board-score')!);
    } else {
      document.getElementById('board-score')!.innerText = '';
    }
  }
}