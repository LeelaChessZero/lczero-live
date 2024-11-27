import {applyMoveToFen} from './chess';
import {isValidWdl, WdlBar} from './wdl';
import {WsPositionData} from './ws_feed';

export interface MoveSelectionObserver {
  onMoveSelected(
      position: WsPositionData, pos_changed: boolean,
      isOngoling: boolean): void;
  onPvPlyUnselected(): void;
  onPvPlySelected(lastMove: string|null, baseFen: string, moves: string[]):
      void;
}

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours == 0) return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  return `${hours}:${String(minutes % 60).padStart(2, '0')}:${
      String(seconds % 60).padStart(2, '0')}`;
}

function formatNodes(nodes: number): string {
  if (nodes == 0) return '';
  if (nodes < 1e3) return nodes.toString();
  if (nodes < 1e6) return `${(nodes / 1e3).toFixed(1)}k`;
  if (nodes < 1e9) return `${(nodes / 1e6).toFixed(1)}m`;
  return `${(nodes / 1e9).toFixed(1)}b`;
}

type VariationView = {
  baseFen: string,
  startPly: number,
  selectedPly: number,
  pvUci: string,
  pvSan: string,
};

export class MoveList {
  private parent: HTMLElement;
  private element: HTMLTableElement;
  private positions: WsPositionData[] = [];
  private positionIdx: number = -1;
  private observers: MoveSelectionObserver[] = [];
  private variationView?: VariationView;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.element = document.createElement('table');
    this.element.setAttribute('tabindex', '0');
    this.element.addEventListener('click', this.onClick.bind(this));
    this.element.addEventListener('keydown', this.onKeydown.bind(this));
    this.element.addEventListener('wheel', this.onWheel.bind(this));
    document.getElementById('pv-view-close')!.addEventListener(
        'click', () => this.unselectVariation());
    document.getElementById('pv-view')!.addEventListener(
        'click', this.onClickPv.bind(this));
    document.getElementById('pv-view')!.addEventListener(
        'wheel', this.onWheelPv.bind(this));
    document.getElementById('pv-view')!.setAttribute('tabindex', '0');
    document.getElementById('pv-view')!.addEventListener(
        'keydown', this.onKeydownPv.bind(this));

    this.parent.appendChild(this.element);
  }

  public selectVariation(
      baseFen: string, startPly: number, selectedPly: number, pvUci: string,
      pvSan: string): void {
    this.variationView = {baseFen, startPly, selectedPly, pvUci, pvSan};
    this.updateVariationView();
    document.getElementById('pv-view')!.classList.add('pv-view-active');
    document.getElementById('pv-view')!.focus();
    this.scrollToView();
  }

  public unselectVariation(): void {
    if (this.variationView) {
      this.variationView = undefined;
      this.observers.forEach(observer => observer.onPvPlyUnselected());
      document.getElementById('pv-view')!.classList.remove('pv-view-active');
    }
  }

  private updateVariationView(): void {
    const variationEl = document.getElementById('pv-view-content')!;
    variationEl.innerHTML = '';
    if (!this.variationView) return;

    const is_white = (p: number) => p % 2 == 0;

    const addSpan = (parent: Element, className: string, text?: string) => {
      const span = document.createElement('span');
      if (text) span.textContent = text;
      span.classList.add(className);
      parent.appendChild(span);
      return span;
    };
    let startPly = this.variationView.startPly;
    if (!is_white(startPly)) {
      addSpan(variationEl, 'move-number', `${Math.floor(startPly / 2) + 1}…`);
    }
    for (let [ply, san] of this.variationView.pvSan.split(' ').entries()) {
      const selectable = addSpan(variationEl, 'pv-selectable-move');
      selectable.setAttribute('data-ply', ply.toString());
      if (is_white(startPly)) {
        addSpan(selectable, 'move-number', `${Math.floor(startPly / 2) + 1}.`);
      }
      const move = addSpan(selectable, 'pv-move', `${san}\u200B`);
      if (ply === this.variationView.selectedPly) {
        move.classList.add('pv-move-selected');
      }
      startPly++;
    }

    let fen = this.variationView.baseFen;
    let moves = this.variationView.pvUci.split(' ');
    for (let i = 0; i <= this.variationView.selectedPly; i++) {
      fen = applyMoveToFen(fen, moves[i]);
    }
    this.observers.forEach(
        observer => observer.onPvPlySelected(
            moves[this.variationView!.selectedPly], fen,
            moves.slice(this.variationView!.selectedPly + 1)));
  }


  public getMoveAtPly(ply: number): WsPositionData|undefined {
    return this.positions[ply];
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.selectPly(this.positionIdx - 1);
    } else {
      this.selectPly(this.positionIdx + 1);
    }
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const plyIdx = target.closest('[ply-idx]')?.getAttribute('ply-idx');
    if (plyIdx) {
      this.selectPly(parseInt(plyIdx, 10));
      this.unselectVariation();
      event.stopPropagation();
    }
  }

  private onWheelPv(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.variationView!.selectedPly =
          Math.max(0, this.variationView!.selectedPly - 1);
    } else {
      this.variationView!.selectedPly = Math.min(
          this.variationView!.pvSan.split(' ').length - 1,
          this.variationView!.selectedPly + 1);
    }
    this.updateVariationView();
  }

  private onKeydownPv(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.variationView!.selectedPly =
          Math.max(0, this.variationView!.selectedPly - 1);
      this.updateVariationView();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.variationView!.selectedPly = Math.min(
          this.variationView!.pvSan.split(' ').length - 1,
          this.variationView!.selectedPly + 1);
      this.updateVariationView();
    }
  }

  private onClickPv(event: Event): void {
    const target = event.target as HTMLElement;
    const plyIdx = target.closest('[data-ply]')?.getAttribute('data-ply');
    if (plyIdx) {
      this.variationView!.selectedPly = parseInt(plyIdx, 10);
      this.updateVariationView();
    }
    event.stopPropagation();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectPly(this.positionIdx - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.selectPly(this.positionIdx + 1);
    }
  }

  public addObserver(observer: MoveSelectionObserver): void {
    this.observers.push(observer);
  }
  public removeObserver(observer: MoveSelectionObserver): void {
    this.observers = this.observers.filter(o => o !== observer);
  }

  private notifyMoveSelected(move_changed: boolean, isOngoling: boolean): void {
    this.observers.forEach(
        observer => observer.onMoveSelected(
            this.positions[this.positionIdx], move_changed, isOngoling));
  }

  private scrollToView(): void {
    const targetRow = Array.from(this.element.children)
                          .find(
                              row => row.getAttribute('ply-idx') ===
                                  this.positionIdx.toString());
    if (this.positionIdx == this.positions.length - 1) {
      this.parent.scrollTo({top: this.element.scrollHeight});
    } else {
      targetRow?.scrollIntoView({block: 'nearest'});
    }
  }

  private selectPly(positionIdx: number): void {
    if (positionIdx < 0 || positionIdx >= this.positions.length) return;
    const isOngoing = positionIdx === this.positions.length - 1;
    if (this.positionIdx === positionIdx) {
      this.notifyMoveSelected(false, isOngoing);
    } else {
      Array.from(this.element.children)
          .forEach(row => row.classList.remove('movelist-selected'));
      const targetRow =
          Array.from(this.element.children)
              .find(row => row.getAttribute('ply-idx') === String(positionIdx));
      targetRow?.classList.add('movelist-selected');
      this.positionIdx = positionIdx;
      this.scrollToView();
      this.notifyMoveSelected(true, isOngoing);
    }
  }

  private updateSinglePosition(position: WsPositionData): void {
    while (position.ply >= this.positions.length) {
      const emptyPosition: WsPositionData = {
        gameId: -1,
        ply: this.positions.length,
        fen: '',
      };
      this.positions.push(emptyPosition);
    }
    this.positions[position.ply] = position;

    const move_idx = Math.floor((position.ply + 1) / 2);
    const is_black = (position.ply % 2) === 0;

    const newRow = document.createElement('tr');
    newRow.classList.add('movelist-item');
    newRow.setAttribute('ply-idx', position.ply.toString());

    const td = function(classNames?: string): HTMLElement {
      const td = document.createElement('td');
      if (classNames) td.className = classNames;
      newRow.appendChild(td);
      return td;
    };

    const nextMove = this.positions[position.ply + 1]?.moveSan;
    if (nextMove) {
      td('spacing-right justify-right move-number').innerHTML =
          `${is_black ? `${move_idx + 1}.` : ''}`;
      td().innerText = nextMove;
    } else {
      td();
      td().innerHTML = '&nbsp;';
    }
    const wdlEl = td();
    if (isValidWdl(position.scoreW, position.scoreD, position.scoreB)) {
      const wdlBar = new WdlBar(
          wdlEl, position.scoreW!, position.scoreD!, position.scoreB!);
      wdlBar.render();
    }

    const timeEl = td('justify-right');
    if (position.time != null) timeEl.innerText = formatTime(position.time);

    const nodesEl = td('justify-right');
    if (position.nodes != null) nodesEl.innerText = formatNodes(position.nodes);

    const depthEl = td('justify-right');
    if (position.depth != null && position.seldepth != null)
      depthEl.innerText =
          `${position.depth.toString()}/${position.seldepth.toString()}`;


    const existingRow = this.element.querySelector(
                            `[ply-idx="${position.ply}"]`) as HTMLDivElement;
    if (existingRow) {
      existingRow.innerHTML = newRow.innerHTML;
    } else {
      this.element.appendChild(newRow);
    }
  }

  public updatePositions(positions: WsPositionData[]): void {
    const wasAtEnd = (this.positionIdx === this.positions.length - 1) ||
        this.positions.length <= 1;
    const wasScrolledToBottom =
        this.parent.scrollHeight - this.parent.scrollTop ===
        this.parent.clientHeight;
    positions.forEach(position => {
      this.updateSinglePosition(position);
      if (position.ply > 0) {
        const prevPos = this.positions[position.ply - 1];
        if (prevPos) this.updateSinglePosition(prevPos);
      }
    });
    if (wasAtEnd && !this.variationView) {
      this.selectPly(this.positions.length - 1);
    } else if (wasScrolledToBottom) {
      this.parent.scrollTo({top: this.element.scrollHeight});
      this.scrollToView();
    }
  }

  public clearPositions(): void {
    this.positions = [];
    this.element.innerHTML = `<tr>
      <th class="movelist-col-pnum"></th>
      <th class="movelist-col-pmove">Move</th>
      <th class="movelist-col-eval">Eval</th>
      <th class="movelist-col-time">Time</th>
      <th class="movelist-col-nodes">Nodes</th>
      <th class="movelist-col-depth">Depth</th>
    </tr>`;
    this.positionIdx = -1;
  }
};