import {WsGameData} from './ws_feed';

export interface GameSelectionObserver {
  onGameSelected(game: WsGameData): void;
}

export class GameSelection {
  private element: HTMLSelectElement;
  private games: WsGameData[] = [];
  private observers: GameSelectionObserver[] = [];
  private followLiveGames: boolean = true;

  constructor(element: HTMLSelectElement) {
    this.element = element;
    this.element.addEventListener('change', this.onChange.bind(this));
  }

  public addObserver(observer: GameSelectionObserver): void {
    this.observers.push(observer);
  }

  public removeObserver(observer: GameSelectionObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }


  public getGames(): WsGameData[] {
    return [...this.games];
  }

  public getSelectedGameId(): number {
    return parseInt(this.element.value);
  }

  public updateGames(games: WsGameData[]): void {
    if (!games) return;
    const wasEmpty = this.games.length === 0;
    games.forEach(game => this.updateSingleGame(game));
    if (wasEmpty ||
        this.followLiveGames &&
            !this.games[this.getSelectedGameId()].isBeingAnalyzed) {
      let newSel = this.games.find(g => g.isBeingAnalyzed);
      if (!newSel) newSel = this.games.find(g => !g.isFinished);
      if (!newSel) newSel = this.games[0];
      this.element.value = newSel.gameId.toString();
      this.notifyObservers(newSel);
    }
  }

  private onChange() {
    const gameId = parseInt(this.element.value);
    const game = this.games.find(g => g.gameId === gameId)!;
    this.followLiveGames = this.games.every(x => !x.isBeingAnalyzed) ||
        game.isBeingAnalyzed;
    this.notifyObservers(game);
  }

  private notifyObservers(game: WsGameData): void {
    this.observers.forEach(observer => observer.onGameSelected(game));
  }

  private updateSingleGame(game: WsGameData): void {
    const existingGame = this.games.findIndex(g => g.gameId === game.gameId);
    const option = this.makeOption(game);
    if (existingGame === -1) {
      this.games.push(game);
      this.element.appendChild(option);
    } else {
      this.games[existingGame] = game;
      this.element.replaceChild(option, this.element.childNodes[existingGame]);
    }
  }

  private makeOption(game: WsGameData): HTMLOptionElement {
    const option = document.createElement('option');
    option.value = game.gameId.toString();
    const prefix = game.isBeingAnalyzed ? '🔴 ' :
        (!game.isFinished)              ? '⏸️ ' :
                                          '';
    option.textContent = prefix + game.name;
    return option;
  }
};