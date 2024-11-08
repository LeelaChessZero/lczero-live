import {BoardArea} from './board_area';
import {GameSelection} from './game_selection';
import {MoveList} from './movelist';
import {MultiPvView} from './multipv_view';
import {WebSocketFeed, WebsocketObserver, WsEvaluationData, WsGameData, WsGlobalData, WsPositionData} from './ws_feed';

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
}

export class App implements WebsocketObserver {
  private gameSelection: GameSelection;
  private moveList: MoveList;
  private multiPvView: MultiPvView;
  private websocketFeed: WebSocketFeed;
  private curGameId?: number;
  private curPly?: number;
  private boardArea: BoardArea;
  private jsHash?: string;

  constructor() {
    this.gameSelection = new GameSelection(
        document.getElementById('game-selection') as HTMLSelectElement);
    this.gameSelection.addObserver(this);
    this.moveList =
        new MoveList(document.getElementById('movelist') as HTMLElement);
    this.moveList.addObserver(this);
    this.boardArea = new BoardArea();
    this.multiPvView =
        new MultiPvView(document.getElementById('multipv-view') as HTMLElement);
    this.websocketFeed = new WebSocketFeed();
    this.websocketFeed.addObserver(this);
  }

  public onConnect(): void {
    document.getElementById('connection-status')!.innerText = '';
  }
  public onDisconnect(): void {
    document.getElementById('connection-status')!.innerText =
        '🔄 Reconnecting...';
  }
  public onStatusReceived(status: WsGlobalData): void {
    if (status.numViewers) {
      document.getElementById('connection-status')!.innerText =
          `${status.numViewers} watching`;
    }
    if (status.jsHash) {
      if (this.jsHash && this.jsHash !== status.jsHash) {
        location.reload();
      }
      this.jsHash = status.jsHash;
    }
  }
  public onGamesReceived(games: WsGameData[]): void {
    this.gameSelection.updateGames(games);
  }
  public onPositionReceived(position: WsPositionData[]): void {
    this.moveList.updatePositions(
        position.filter(p => p.gameId == this.curGameId));
  }
  public onEvaluationReceived(evaluation: WsEvaluationData[]): void {
    let evals = evaluation.filter(
        e => e.gameId == this.curGameId && e.ply == this.curPly);
    if (evals.length == 0) return;
    this.multiPvView.updateMultiPv(evals.at(-1)!);
    this.boardArea.updateEvaluation(evals.at(-1)!);
  }

  public onGameSelected(game: WsGameData): void {
    this.curGameId = game.gameId;
    this.boardArea.updatePlayers(game);
    this.moveList.clearPositions();
    this.websocketFeed.setGameId(game.gameId);
    this.updatePgnFeedUrl(game.feedUrl);
  }

  private updatePgnFeedUrl(feedUrl: string): void {
    const pgnFeed = document.getElementById('pgn-feed') as HTMLAnchorElement;
    pgnFeed.href = feedUrl;
    pgnFeed.innerText = feedUrl;
  }

  public onMoveSelected(
      position: WsPositionData,
      pos_changed: boolean,
      ): void {
    if (pos_changed) {
      this.curPly = position.ply;
      this.boardArea.changePosition(position);
      this.multiPvView.clear();
      this.websocketFeed.setPosition(position.ply);
    }
    this.boardArea.updatePosition(position);
  }
};