
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
  scoreB?: number;
}

export interface MovesFeedResponse {
  positions?: GamePositionResponse[];
}

export interface MovesFeedObserver {
  onMovesReceived(moves: MovesFeedResponse): void;
}

export class MovesFeed {
  private websocket: WebSocket;
  private observers: MovesFeedObserver[] = [];

  constructor(gameId: number) {
    this.websocket = new WebSocket(
        `ws://${window.location.host}/api/ws/game/${gameId}/moves`);
    this.websocket.onopen = this.onOpen.bind(this);
  }

  public close(): void {
    this.websocket.close();
  }

  public addObserver(observer: MovesFeedObserver): void {
    this.observers.push(observer);
  }

  public removeObserver(observer: MovesFeedObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  private notifyObservers(response: MovesFeedResponse): void {
    this.observers.forEach(observer => observer.onMovesReceived(response));
  }

  private onOpen(): void {
    this.websocket.onmessage = this.onMessage.bind(this);
  }

  private onMessage(event: MessageEvent): void {
    const response = JSON.parse(event.data) as MovesFeedResponse;
    this.notifyObservers(response);
  }
};