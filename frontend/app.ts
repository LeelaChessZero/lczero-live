import {GameSelection} from './game_selection';

export class App {
  private gameSelection: GameSelection;

  constructor() {
    this.gameSelection = new GameSelection(
        document.getElementById('game-selection') as HTMLSelectElement);
    // add observer
    this.gameSelection.fetchGamesFromServer();
  }

  public initialize(): void {}
};