


export interface WsGlobalData {
  message: string;
  numViewers: number;
}

export interface WsPlayerData {
  name: string;
  rating: number;
  fideId?: number;
  fed?: string;
}

export interface WsGameData {
  gameId: number;
  name: string;
  isFinished: boolean;
  isBeingAnalyzed: boolean;
  player1: WsPlayerData;
  player2: WsPlayerData;
  feedUrl: string;
}

export interface WsPositionData {
  gameId: number;
  ply: number;  // 0 for startpos
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
  nodes?: number;
  time?: number;
  depth?: number;
  seldepth?: number;
}

export interface WsVariationData {
  moveUci: string;
  nodes: number;
  moveOppUci?: string;
  moveSan: string;
  pvSan: string;
  pvUci: string;
  scoreQ: number;
  scoreW: number;
  scoreD: number;
  scoreB: number;
  mateScore?: number;
}

export interface WsEvaluationData {
  gameId: number;
  ply: number;
  evalId: number;
  nodes: number;
  time: number;
  depth: number;
  seldepth: number;
  movesLeft?: number;
  variations: WsVariationData[];
}

export interface WebsocketRequest {
  gameId?: number;
  ply?: number;
}

export interface WebsocketResponse {
  status: WsGlobalData;
  games: WsGameData[];
  positions: WsPositionData[];
  evaluations: WsVariationData[];
}

export interface WebsocketObserver {
  onConnect(): void;
  onDisconnect(): void;
  onStatusReceived(status: WsGlobalData): void;
  onGamesReceived(games: WsGameData[]): void;
  onPositionReceived(position: WsPositionData[]): void;
  onEvaluationReceived(evaluation: WsVariationData[]): void;
}


export class WebSocketFeed {
  private websocket: WebSocket;
  private observers: WebsocketObserver[] = [];
  private gameId?: number;
  private ply?: number;

  constructor() {
    this.connect();
  }

  public close(): void {
    this.websocket.close();
  }

  public addObserver(observer: WebsocketObserver): void {
    this.observers.push(observer);
  }

  public removeObserver(observer: WebsocketObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  public setGameId(gameId: number): void {
    if (this.gameId === gameId) {
      return;
    }
    this.gameId = gameId;
    this.ply = undefined;
    this.sendRequest({gameId});
  }

  public setPosition(ply: number): void {
    if (this.ply === ply) {
      return;
    }
    this.ply = ply;
    this.sendRequest({gameId: this.gameId, ply});
  }

  private sendRequest(request: WebsocketRequest): void {
    this.websocket.send(JSON.stringify(request));
  }

  private onOpen(): void {
    this.websocket.onmessage = this.onMessage.bind(this);
    this.websocket.onclose = this.onClose.bind(this);
    if (this.gameId != null || this.ply != null) {
      this.sendRequest({gameId: this.gameId, ply: this.ply});
    }
    this.notifyObservers(observer => observer.onConnect());
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.websocket =
        new WebSocket(`${protocol}//${window.location.host}/api/ws`);
    this.websocket.onopen = this.onOpen.bind(this);
  }

  private onClose(): void {
    this.notifyObservers(observer => observer.onDisconnect());
    setTimeout(() => {
      this.connect();
    }, 5000);
  }

  private notifyObservers(callback: (WebsocketObserver) => void): void {
    this.observers.forEach(callback);
  }

  private onMessage(event: MessageEvent): void {
    const response = JSON.parse(event.data) as WebsocketResponse;
    if (response.status) {
      this.notifyObservers(
          observer => observer.onStatusReceived(response.status));
    }
    if (response.games) {
      this.notifyObservers(observer => observer.onGamesReceived(response.games));
    }
    if (response.positions) {
      this.notifyObservers(
          observer => observer.onPositionReceived(response.positions));
    }
    if (response.evaluations) {
      this.notifyObservers(
          observer => observer.onEvaluationReceived(response.evaluations));
    }
  }
}