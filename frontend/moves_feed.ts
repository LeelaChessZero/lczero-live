
export interface GamePositionUpdate {
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
  movesLeft?: number;
}

export interface GamePositionUpdateFrame {
  positions?: GamePositionUpdate[];
}

export interface MovesFeedObserver {
  onMovesReceived(moves: GamePositionUpdateFrame): void;
}

export class MovesFeed {
  private websocket: WebSocket;
  private observers: MovesFeedObserver[] = [];

  constructor(gameId: number) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.websocket = new WebSocket(
        `${protocol}//${window.location.host}/api/ws/moves/${gameId}`);
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

  private notifyObservers(response: GamePositionUpdateFrame): void {
    this.observers.forEach(observer => observer.onMovesReceived(response));
  }

  private onOpen(): void {
    this.websocket.onmessage = this.onMessage.bind(this);
  }

  private onMessage(event: MessageEvent): void {
    const response = JSON.parse(event.data) as GamePositionUpdateFrame;
    this.notifyObservers(response);
  }
};