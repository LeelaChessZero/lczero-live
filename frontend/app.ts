import {Board} from './board';
import {GameSelection, GameSelectionObserver} from './game_selection';
import {MoveList, MoveSelectionObserver} from './movelist';
import {GamePositionUpdate, GamePositionUpdateFrame, MovesFeed} from './moves_feed';
import {MultiPvView} from './multipv_view';
import {GameThinkingUpdateFrame, ThinkingFeed} from './thinking_feed';

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

export class App implements GameSelectionObserver, MoveSelectionObserver {
  private gameSelection: GameSelection;
  private moveList: MoveList;
  private currentThinkingId?: number;
  private multiPvView: MultiPvView;
  private board: Board;
  private movesFeed?: MovesFeed = undefined;
  private thinkingFeed?: ThinkingFeed = undefined;

  constructor() {
    this.gameSelection = new GameSelection(
        document.getElementById('game-selection') as HTMLSelectElement);
    this.gameSelection.addObserver(this);
    this.gameSelection.fetchGamesFromServer();
    this.moveList =
        new MoveList(document.getElementById('movelist') as HTMLElement);
    this.moveList.addObserver(this);
    this.board = new Board(document.getElementById('board') as HTMLElement);
    this.board.render();
    this.multiPvView =
        new MultiPvView(document.getElementById('multipv-view') as HTMLElement);
    this.currentThinkingId = undefined;
  }

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

  public onGameSelected(gameId: number): void {
    fetch(`/api/game/${gameId}`)
        .then(response => response.json() as Promise<GameResponse>)
        .then(data => {
          this.startMovesFeed(data.gameId);
          this.updatePgnFeedUrl(data.feedUrl);
        })
        .catch(error => console.error('Error fetching game:', error));
  }

  private updatePgnFeedUrl(feedUrl: string): void {
    const pgnFeed = document.getElementById('pgn-feed') as HTMLAnchorElement;
    pgnFeed.href = feedUrl;
    pgnFeed.innerText = feedUrl;
  }

  public onMoveSelected(
      position: GamePositionUpdate,
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
    if (position.thinkingId) {
      this.startThinking(position.thinkingId);
    }
  }

  private startMovesFeed(gameId: number): void {
    if (this.movesFeed) {
      this.movesFeed.close();
    }
    this.moveList.clearPositions();
    this.movesFeed = new MovesFeed(gameId);
    this.movesFeed.addObserver(this);
  }

  public onMovesReceived(moves: GamePositionUpdateFrame): void {
    if (moves.positions) {
      this.moveList.updatePositions(moves.positions);
    }
  }
};