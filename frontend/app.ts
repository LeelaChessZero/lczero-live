import {BoardArea} from './board_area';
import {AudioPlayer} from './audio';
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
  private gameIsLive: boolean = false;
  private audioPlayer: AudioPlayer;

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
    this.multiPvView.addObserver(this);
    this.websocketFeed = new WebSocketFeed();
    this.websocketFeed.addObserver(this);
    this.audioPlayer = new AudioPlayer();
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.moveList.unselectVariation();
    });
    document.addEventListener('click', event => {
      if (!event.defaultPrevented) this.moveList.unselectVariation();
    });

    document.getElementById('dark-mode-toggle')!.addEventListener(
        'click', () => {
          document.body.classList.toggle('dark');
        });
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
    const filteredPositions = position.filter(p => p.gameId == this.curGameId);
    this.moveList.updatePositions(filteredPositions);
  }
  public onEvaluationReceived(evaluation: WsEvaluationData[]): void {
    let evals = evaluation.filter(
        e => e.gameId == this.curGameId && e.ply == this.curPly);
    if (evals.length == 0) return;
    const eval_ = evals.at(-1)!;
    const nextMove = this.moveList.getMoveAtPly(eval_.ply + 1)?.moveUci;
    this.multiPvView.updateMultiPv(eval_, nextMove);
    this.boardArea.updateEvaluation(eval_, nextMove);
  }

  public onGameSelected(game: WsGameData): void {
    if (this.curGameId != game.gameId) {
      this.moveList.clearPositions();
    }
    this.curGameId = game.gameId;
    this.gameIsLive = game.isBeingAnalyzed;
    this.boardArea.updatePlayers(game);
    this.websocketFeed.setGameId(game.gameId);
    this.updatePgnFeedUrl(game.feedUrl);
  }

  private updatePgnFeedUrl(feedUrl: string): void {
    const pgnFeed = document.getElementById('pgn-feed') as HTMLAnchorElement;
    pgnFeed.href = feedUrl;
    pgnFeed.innerText = feedUrl;
  }

  public onMoveSelected(
      position: WsPositionData, pos_changed: boolean,
      isOngoling: boolean): void {
    const currentPly = this.curPly ?? -1;
    this.curPly = position.ply;
    const nextMove = this.moveList.getMoveAtPly(position.ply + 1)?.moveUci;
    this.boardArea.changePosition(
        position, pos_changed, isOngoling && this.gameIsLive, nextMove);
    if (pos_changed) {
      this.multiPvView.setPosition(position);
      this.websocketFeed.setPosition(position.ply);
      this.boardArea.resetPvVisualization();

      // Only play move sound when the next move is 1 ply ahead of the current position
      if (position.ply === currentPly + 1) {
        this.audioPlayer.playMoveAudio();
      }
    }
    this.boardArea.updatePosition(position);
  }

  public onVariationSelected(
      baseFen: string, startPly: number, selectedPly: number, pvUci: string,
      pvSan: string): void {
    this.moveList.selectVariation(baseFen, startPly, selectedPly, pvUci, pvSan);
  }
  public onVariationUnselected(): void {
    this.moveList.unselectVariation();
  }

  public onPvPlySelected(
      lastMove: string|null, baseFen: string, moves: string[]): void {
    this.boardArea.setPvVisualization(lastMove, baseFen, moves);
  }
  public onPvPlyUnselected(): void {
    this.boardArea.resetPvVisualization();
  }
};