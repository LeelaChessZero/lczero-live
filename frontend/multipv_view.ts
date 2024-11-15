import {numVariationsToRender} from './arrow_selector';
import {Bar} from './bar';
import {applyMoveToFen} from './chess';
import {isValidWdl, WdlBar} from './wdl';
import {WsEvaluationData, WsPositionData, WsVariationData} from './ws_feed';

export interface MultiPvViewObserver {
  onPvPlySelected(lastMove: string|null, baseFen: string, moves: string[]):
      void;
  onPvPlyUnselected(): void;
}

export class MultiPvView {
  private parent: HTMLElement;
  private element: HTMLElement;
  private selectedMove?: string = undefined;
  private selectedIdx?: number = undefined;
  private selectedEl?: Element = undefined;
  private observers: MultiPvViewObserver[] = [];
  private fen?: string;
  private lastUpdates: Map<string, WsVariationData> = new Map();

  constructor(parent: HTMLElement) {
    this.parent = parent;
    const table = document.createElement('table');
    this.parent.appendChild(table);
    const hdr = document.createElement('thead');
    table.appendChild(hdr);
    const tr = document.createElement('tr');
    hdr.appendChild(tr);
    function addTr(text: string, className: string): void {
      let th = document.createElement('th');
      th.classList.add(className);
      th.textContent = text;
      tr.appendChild(th);
    }
    addTr('', 'mpv-col-legend');
    addTr('Move', 'mpv-col-move');
    addTr('White / Draw / Black probability', 'mpv-col-wdl');
    addTr('Nodes / Probability of being best', 'mpv-col-node');
    addTr('PV', 'mpv-col-pv');

    this.element = document.createElement('tbody');
    this.element.addEventListener('click', this.onClick.bind(this));
    table.appendChild(this.element);
  }

  public addObserver(observer: MultiPvViewObserver): void {
    this.observers.push(observer);
  }

  public isPvSelected(): boolean {
    return this.selectedMove !== undefined;
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const move = target.closest('.pv-move');
    if (move) {
      if (this.selectedEl) this.selectedEl.classList.remove('pv-move-selected');
      this.selectedMove = move.getAttribute('data-uci')!;
      this.selectedIdx = parseInt(move.getAttribute('data-idx')!);
      this.selectedEl = move;
      this.selectedEl.classList.add('pv-move-selected');
      this.notifyPlySelected(
          this.lastUpdates.get(this.selectedMove)!.pvUci, this.selectedIdx);
    } else if (this.selectedMove) {
      this.selectedMove = undefined;
      this.selectedIdx = undefined;
      if (this.selectedEl) this.selectedEl.classList.remove('pv-move-selected');
      this.selectedEl = undefined;
      this.observers.forEach(observer => observer.onPvPlyUnselected());
    }
  }

  // private onWheel(event: WheelEvent): void {
  //   const target = event.target as HTMLElement;
  //   const move = target.closest('.pv-move');
  //   if (!move) return;
  //   if (!this.selectedEl) return;

  //   if (event.deltaY < 0 && this.selectedIdx! > 0) {
  //     this.selectedIdx = this.selectedIdx! - 1;
  //   } else if (
  //       event.deltaY > 0 &&
  //       this.selectedIdx! < move.textContent!.split(' ').length - 1) {
  //     this.selectedIdx = this.selectedIdx! + 1;
  //   } else {
  //     return;
  //   }

  //   event.preventDefault();
  //   this.selectedEl.classList.remove('pv-move-selected');
  //   this.selectedEl = this.element.querySelector(
  //                         `.pv-move[data-idx="${this.selectedIdx}"]`) ||
  //       undefined;
  //   if (this.selectedEl) {
  //     this.selectedEl.classList.add('pv-move-selected');
  //     this.notifyPlySelected(
  //         this.lastUpdates.get(this.selectedMove!)!.pvUci,
  //         this.selectedIdx!);
  //   } else {
  //     this.selectedMove = undefined;
  //     this.selectedIdx = undefined;
  //     this.observers.forEach(observer => observer.onPvPlyUnselected());
  //   }
  // }

  public setPosition(pos: WsPositionData): void {
    this.fen = pos.fen;
    this.element.innerHTML = '';
    this.selectedMove = undefined;
    this.selectedIdx = undefined;
    this.selectedEl = undefined;
    this.lastUpdates.clear();
  }

  private notifyPlySelected(pvUci: string, idx: number): void {
    let lastMove = ''
    let fen = this.fen!;
    const uci = pvUci.split(' ');
    const preUci = uci.slice(0, idx + 1);
    const postUci = uci.slice(idx + 1);
    for (const move of preUci) {
      lastMove = move;
      fen = applyMoveToFen(fen, move);
    }
    this.observers.forEach(
        observer => observer.onPvPlySelected(lastMove || null, fen, postUci));
  }

  public updateMultiPv(update: WsEvaluationData, nextMoveUci?: string): void {
    this.element.innerHTML = '';
    const numArrows = numVariationsToRender(update);
    for (let [variation, row] of update.variations.entries()) {
      this.lastUpdates.set(row.pvUci.split(' ')[0], row);
      const width =
          Math.pow(row.nodes / update.variations[0].nodes, 1 / 1.2) * 12;

      let tr = document.createElement('tr');
      function addCell(): HTMLElement {
        let td = document.createElement('td');
        tr.appendChild(td);
        return td;
      }
      const color = addCell();
      if (variation < numArrows) {
        const svg =
            document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '8');
        svg.setAttribute('height', '8');
        const rect =
            document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '8');
        rect.setAttribute('height', '8');
        rect.setAttribute('class', `legend arrow-variation${variation}`);
        svg.appendChild(rect);
        color.appendChild(svg);
      }
      const move = addCell();
      move.textContent = row.pvSan.split(' ')[0];
      if (nextMoveUci && row.pvUci.split(' ')[0] == nextMoveUci) {
        color.classList.add('row-move-played');
        move.classList.add('row-move-played');
      }
      if (isValidWdl(row.scoreW, row.scoreD, row.scoreB)) {
        let wdl = new WdlBar(addCell(), row.scoreW, row.scoreD, row.scoreB);
        wdl.render();
      } else {
        addCell();
      }
      const bar = new Bar(addCell(), row.nodes, update.nodes);
      bar.lText =
          Intl.NumberFormat('ru-RU', {style: 'decimal', useGrouping: true})
              .format(row.nodes);
      bar.rText = `${(100 * row.nodes / update.nodes).toFixed(1)}%`;
      bar.render();
      this.makePv(addCell(), row, update.ply);

      this.element.appendChild(tr);
    }
  }

  private makePv(element: HTMLElement, row: WsVariationData, ply: number):
      void {
    if (!row.pvSan) return;
    element.classList.add('pv-cell');
    const is_white = p => p % 2 == 0;

    const addSpan =
        (text: string, className: string) => {
          const span = document.createElement('span');
          span.textContent = text;
          span.classList.add(className);
          element.appendChild(span);
          return span;
        }

    if (!is_white(ply)) addSpan(`${Math.floor(ply / 2) + 1}…`, 'move-number');
    const moveUci = row.pvUci.split(' ')[0];
    for (let [idx, san] of row.pvSan.split(' ').entries()) {
      if (is_white(ply)) addSpan(`${Math.floor(ply / 2) + 1}.`, 'move-number');
      const el = addSpan(san, 'pv-move');
      el.setAttribute('data-uci', moveUci);
      el.setAttribute('data-idx', idx.toString());
      if (this.selectedMove == moveUci && this.selectedIdx == idx) {
        el.classList.add('pv-move-selected');
        this.selectedEl = el;
        this.notifyPlySelected(row.pvUci, idx);
      }
      ply++;
    }
  }
};