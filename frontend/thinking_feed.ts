export interface GameThinkingMoveUpdate {
  moveUci: string;
  moveOppUci?: string;
  moveSan: string;
  pvSan: string;
  scoreQ: number;
  scoreW: number;
  scoreD: number;
  scoreB: number;
  mateScore?: number;
  movesLeft?: number;
}

export interface GameThinkingUpdate {
  updateId: number;
  nodes: number;
  time: number;
  depth: number;
  seldepth: number;
  moves: GameThinkingMoveUpdate[];
}

export interface GameThinkingUpdateFrame {
  thinkings: GameThinkingUpdate[];
}

export interface MovesFeedObserver {
  onMovesReceived(moves: GameThinkingUpdateFrame): void;
}


export class ThinkingFeed {
  private websocket: WebSocket;
  private observers: MovesFeedObserver[] = [];

  constructor(gameId: number, thinkingId: number) {
    this.websocket = new WebSocket(`ws://${window.location.host}/api/ws/game/${
        gameId}/thinking/${thinkingId}`);
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

  private notifyObservers(response: GameThinkingUpdateFrame): void {
    this.observers.forEach(observer => observer.onMovesReceived(response));
  }

  private onOpen(): void {
    this.websocket.onmessage = this.onMessage.bind(this);
  }

  private onMessage(event: MessageEvent): void {
    const response = JSON.parse(event.data) as GameThinkingUpdateFrame;
    this.notifyObservers(response);
  }
}