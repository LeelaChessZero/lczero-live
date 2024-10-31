import {Board} from './board';
import {WsGameData, WsPlayerData, WsPositionData} from './ws_feed';

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
};