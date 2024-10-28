import {Board} from './board';
import {GameSelection, GameSelectionObserver} from './game_selection';
import {MoveList, MoveSelectionObserver} from './movelist';
import {MultiPvView} from './multipv_view';
import {WebSocketFeed, WebsocketObserver, WsGameData, WsGlobalData, WsPositionData, WsVariationData} from './ws_feed';

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
  private board: Board;
  private websocketFeed: WebSocketFeed;
  private curGameId?: number;
  private curPly?: number;

  constructor() {
    this.gameSelection = new GameSelection(
        document.getElementById('game-selection') as HTMLSelectElement);
    this.gameSelection.addObserver(this);
    this.moveList =
        new MoveList(document.getElementById('movelist') as HTMLElement);
    this.moveList.addObserver(this);
    this.board = new Board(document.getElementById('board') as HTMLElement);
    this.board.render();
    this.multiPvView =
        new MultiPvView(document.getElementById('multipv-view') as HTMLElement);
    this.websocketFeed = new WebSocketFeed();
    this.websocketFeed.addObserver(this);
  }

  public onConnect(): void {}
  public onDisconnect(): void {}
  public onStatusReceived(status: WsGlobalData): void {}
  public onGamesReceived(games: WsGameData[]): void {
    this.gameSelection.updateGames(games);
  }
  public onPositionReceived(position: WsPositionData[]): void {
    this.moveList.updatePositions(position);
  }
  public onEvaluationReceived(evaluation: WsVariationData[]): void {}

  public startThinking(thinkingId?: number): void {
    if (this.currentThinkingId == thinkingId) return;
    if (this.thinkingFeed) this.thinkingFeed.close();
    this.multiPvView.clear();
    this.currentThinkingId = thinkingId;

    if (thinkingId != undefined) {
      this.thinkingFeed = new ThinkingFeed(thinkingId);
      this.thinkingFeed.addObserver(this);
    }
  }

  public onThinkingReceived(moves: GameThinkingUpdateFrame): void {
    if (moves.thinkings) {
      this.multiPvView.updateMultiPv(moves.thinkings.at(-1)!);
    }
  }

  public onGameSelected(game: WsGameData): void {
    this.curGameId = game.gameId;
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
      this.board.fromFen(position.fen);
      this.board.clearHighlights();
      if (position.moveUci) {
        this.board.addHighlight(position.moveUci.slice(0, 2));
        this.board.addHighlight(position.moveUci.slice(2, 4));
      }
      this.board.render();
    }
    this.websocketFeed.setPosition(position.ply);
  }
};