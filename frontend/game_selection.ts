export interface GameSelectionObserver {
    onGameSelected(game: number): void;
}

interface GameData {
    id: number;
    name: string;
};

interface GamesResponse {
    games: GameData[];
    curGameId: number;
};

export class GameSelection {
    private games: GameData[] = [];
    private curGameId: number = 0;
    private observers: GameSelectionObserver[] = [];

    constructor() {
        this.fetchGamesFromServer();
    }

    private notifyObservers(): void {
        this.observers.forEach(observer => {
            observer.onGameSelected(this.games[0].id);
        });
    }

    private fetchGamesFromServer(): void {
        fetch('/api/games')
            .then(response => response.json() as Promise<GamesResponse>)
            .then(data => {
                this.games = data.games;
                this.curGameId = data.curGameId;
                console.log(data);
                this.notifyObservers();
            })
            .catch(error => console.error('Error fetching games:', error));
    }
};