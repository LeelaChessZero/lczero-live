import {GameSelection} from './game_selection';
import {GamePositionResponse, MoveList} from './movelist';



interface PlayerResponse {
  name: string;
  rating: number;
  fideId?: number;
  fed?: string;
}

interface GameResponse {
  gameId: number;
  player1: PlayerResponse;
  player2: PlayerResponse;
  feedUrl: string;
  positions: GamePositionResponse[];
}

export class App {
  private gameSelection: GameSelection;
  private moveList: MoveList;

  constructor() {
    this.gameSelection = new GameSelection(
        document.getElementById('game-selection') as HTMLSelectElement);
    this.gameSelection.addObserver(this);
    this.gameSelection.fetchGamesFromServer();
    this.moveList =
        new MoveList(document.getElementById('movelist') as HTMLElement);
  }

  public onGameSelected(gameId: number): void {
    fetch(`/api/game/${gameId}`)
        .then(response => response.json() as Promise<GameResponse>)
        .then(data => {
          console.log('Game data:', data);
          this.moveList.setPositions(data.positions);
        })
        .catch(error => console.error('Error fetching game:', error));
  }

  public initialize(): void {}
};