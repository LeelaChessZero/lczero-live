export interface GameSelectionObserver {
  onGameSelected(game: number): void;
}

interface GameData {
  id: number;
  name: string;
  isFinished: boolean;
  isBeingAnalyzed: boolean;
}

interface GamesResponse {
  games: GameData[];
}

export class GameSelection {
  private element: HTMLSelectElement;
  private games: GameData[] = [];
  private observers: GameSelectionObserver[] = [];

  constructor(element: HTMLSelectElement) {
    this.element = element;
    this.element.addEventListener('change', () => {
      const selectedGameId = parseInt(this.element.value);
      this.observers.forEach(
          observer => observer.onGameSelected(selectedGameId));
    });
  }


  public addObserver(observer: GameSelectionObserver): void {
    this.observers.push(observer);
  }

  public removeObserver(observer: GameSelectionObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  public getGames(): GameData[] {
    return [...this.games];
  }

  public fetchGamesFromServer(): void {
    fetch('/api/games')
        .then(response => response.json() as Promise<GamesResponse>)
        .then(data => {
          this.games = data.games;
          this.renderGames();
        })
        .catch(error => console.error('Error fetching games:', error));
  }

  public getSelectedGameId(): number {
    return parseInt(this.element.value);
  }

  private renderGames(): void {
    this.element.innerHTML = '';
    let selectedGame: GameData|undefined;

    this.games.forEach(game => {
      const option = document.createElement('option');
      option.value = game.id.toString();
      const prefix = game.isBeingAnalyzed ? '🔴 ' :
          (!game.isFinished)              ? '⏸️ ' :
                                            '';
      option.textContent = prefix + game.name;
      this.element.appendChild(option);

      if (!selectedGame ||
          (game.isBeingAnalyzed && !selectedGame.isBeingAnalyzed) ||
          (!game.isFinished && selectedGame.isFinished)) {
        selectedGame = game;
      }
    });

    if (selectedGame) {
      this.element.value = selectedGame.id.toString();
    }

    this.notifyObservers();
  }

  private notifyObservers(): void {
    this.observers.forEach(observer => {
      observer.onGameSelected(parseInt(this.element.value));
    });
  }
};