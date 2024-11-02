import {Board} from './board';
import {numArrowsToRender} from './multipv_view';
import {WsEvaluationData, WsGameData, WsPlayerData, WsPositionData} from './ws_feed';

function formatClock(seconds?: number): string {
  if (seconds == null) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${
      minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderPlayer(player: WsPlayerData, element: HTMLElement): void {
  element.innerText = `${player.name} (${player.rating})`;
}

export class BoardArea {
  private board: Board;
  private flipped: boolean = false;

  constructor() {
    this.board = new Board(document.getElementById('board') as HTMLElement);
    this.board.render();
  }

  public updatePlayers(game: WsGameData): void {
    const white = this.flipped ? 'bottom' : 'top';
    const black = this.flipped ? 'top' : 'bottom';
    renderPlayer(game.player1, document.getElementById(`player-${white}`)!);
    renderPlayer(game.player2, document.getElementById(`player-${black}`)!);
  }

  public updatePosition(position: WsPositionData): void {
    this.board.fromFen(position.fen);
    this.board.clearHighlights();
    if (position.moveUci) {
      this.board.addHighlight(position.moveUci.slice(0, 2));
      this.board.addHighlight(position.moveUci.slice(2, 4));
    }
    const white = this.flipped ? 'bottom' : 'top';
    const black = this.flipped ? 'top' : 'bottom';

    document.getElementById(`player-${white}-clock`)!.innerText =
        formatClock(position.whiteClock);
    document.getElementById(`player-${black}-clock`)!.innerText =
        formatClock(position.blackClock);
    this.board.render();
  }

  public updateEvaluation(update: WsEvaluationData): void {
    this.board.clearArrows();
    const numArrows = numArrowsToRender(update);
    for (let [ply, row] of update.variations.entries()) {
      if (ply >= numArrows) break;
      const pv = row.pvUci.split(' ');
      const width =
          Math.pow(row.nodes / update.variations[0].nodes, 1 / 1.3) * 12;
      if (pv.length >= 1) {
        this.board.addArrow({
          move: pv[0],
          classes: `arrow arrow-pv0 arrow-ply${ply} arrow-ply${ply}-pv0`,
          width: width,
          angle: 0,
          headLength: 20,
          headWidth: width+10,
          dashLength: 1000,
          dashSpace: 0
        });
      }
      if (pv.length >= 2) {
        this.board.addArrow({
          move: pv[1],
          classes: `arrow arrow-pv1 arrow-ply${ply} arrow-ply${ply}-pv1`,
          width: 5,
          angle: Math.PI / 3,
          headLength: 10,
          headWidth: 10,
          dashLength: 10,
          dashSpace: 10
        });
      }
      if (pv.length >= 3 && pv[0].slice(2, 4) == pv[2].slice(0, 2)) {
        this.board.addArrow({
          move: pv[2],
          classes: `arrow arrow-pv2 arrow-ply${ply} arrow-ply${ply}-pv2`,
          width: 2,
          angle: -Math.PI / 2,
          headLength: 5,
          headWidth: 10,
          dashLength: 3,
          dashSpace: 3
        });
      }
    }
    this.board.render();
  }
}