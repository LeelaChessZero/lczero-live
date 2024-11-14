import {isValidWdl, WdlBar} from './wdl';
import {WsPositionData} from './ws_feed';

export interface MoveSelectionObserver {
  onMoveSelected(
      position: WsPositionData, pos_changed: boolean,
      isOngoling: boolean): void;
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

export class MoveList {
  private parent: HTMLElement;
  private element: HTMLTableElement;
  private positions: WsPositionData[] = [];
  private positionIdx: number = -1;
  private observers: MoveSelectionObserver[] = [];

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.element = document.createElement('table');
    this.element.setAttribute('tabindex', '0');
    this.element.addEventListener('click', this.onClick.bind(this));
    this.element.addEventListener('keydown', this.onKeydown.bind(this));
    this.element.addEventListener('wheel', this.onWheel.bind(this));
    this.parent.appendChild(this.element);
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
    if (plyIdx != null) this.selectPly(parseInt(plyIdx, 10));
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

  private selectPly(positionIdx: number): void {
    if (positionIdx < 0 || positionIdx >= this.positions.length) return;
    const isOngoling = positionIdx === this.positions.length - 1;
    if (this.positionIdx === positionIdx) {
      this.notifyMoveSelected(false, isOngoling);
    } else {
      Array.from(this.element.children)
          .forEach(row => row.classList.remove('movelist-selected'));
      const targetRow =
          Array.from(this.element.children)
              .find(row => row.getAttribute('ply-idx') === String(positionIdx));
      targetRow?.classList.add('movelist-selected');
      if (positionIdx == this.positions.length - 1) {
        this.parent.scrollTo({top: this.element.scrollHeight});
      } else {
        targetRow?.scrollIntoView({block: 'nearest'});
      }
      this.positionIdx = positionIdx;
      this.notifyMoveSelected(true, isOngoling);
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
      td();
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
    positions.forEach(position => {
      this.updateSinglePosition(position);
      if (position.ply > 0) {
        const prevPos = this.positions[position.ply - 1];
        if (prevPos) this.updateSinglePosition(prevPos);
      }
    });
    if (wasAtEnd) this.selectPly(this.positions.length - 1);
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