import {numVariationsToRender} from './arrow_selector';
import {Bar} from './bar';
import {isValidWdl, WdlBar} from './wdl';
import {WsEvaluationData, WsPositionData, WsVariationData} from './ws_feed';

export interface MultiPvViewObserver {
  onVariationSelected(
      baseFen: string, startPly: number, selectedPly: number, pvUci: string,
      pvSan: string): void;
  onVariationUnselected(): void;
}

export class MultiPvView {
  private parent: HTMLElement;
  private element: HTMLElement;
  private observers: MultiPvViewObserver[] = [];
  private fen?: string;
  private currentPly?: number;
  private variations: WsVariationData[] = [];

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
    addTr('Nodes / Probability of being the best', 'mpv-col-node');
    addTr('PV', 'mpv-col-pv');

    this.element = document.createElement('tbody');
    this.element.addEventListener('click', this.onClick.bind(this));
    table.appendChild(this.element);
  }

  public addObserver(observer: MultiPvViewObserver): void {
    this.observers.push(observer);
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const move = target.closest('.pv-selectable-move');
    if (move) {
      const variationIdx = parseInt(move.getAttribute('data-idx')!);
      const ply = parseInt(move.getAttribute('data-ply')!);
      this.observers.forEach(
          observer => observer.onVariationSelected(
              this.fen!, this.currentPly!, ply,
              this.variations[variationIdx].pvUci,
              this.variations[variationIdx].pvSan));
      event.stopPropagation();
      return;
    }
    const row = target.closest('tr.pv-row');
    if (row) {
      const variationIdx = parseInt(row.getAttribute('data-idx')!);
      this.observers.forEach(
          observer => observer.onVariationSelected(
              this.fen!, this.currentPly!, 0,
              this.variations[variationIdx].pvUci,
              this.variations[variationIdx].pvSan));
      event.stopPropagation();
      return;
    }
  }

  public setPosition(pos: WsPositionData): void {
    this.fen = pos.fen;
    this.currentPly = pos.ply;
    this.element.innerHTML = '';
  }

  public updateMultiPv(update: WsEvaluationData, nextMoveUci?: string): void {
    this.element.innerHTML = '';
    this.variations = update.variations;
    const numArrows = numVariationsToRender(update);
    for (let [variation, row] of update.variations.entries()) {
      let tr = document.createElement('tr');
      tr.classList.add('pv-row');
      tr.setAttribute('data-idx', variation.toString());
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
      this.makePv(addCell(), row, variation, update.ply);

      this.element.appendChild(tr);
    }
  }

  private makePv(
      element: HTMLElement, row: WsVariationData, variationIdx: number,
      startPly: number): void {
    if (!row.pvSan) return;
    element.classList.add('pv-cell');
    const is_white = (p: number) => p % 2 == 0;

    const addSpan =
        (parent: Element, className: string, text?: string) => {
          const span = document.createElement('span');
          if (text) span.textContent = text;
          span.classList.add(className);
          parent.appendChild(span);
          return span;
        }

    if (!is_white(startPly)) {
      addSpan(element, 'move-number', `${Math.floor(startPly / 2) + 1}…`);
    }
    for (let [ply, san] of row.pvSan.split(' ').entries()) {
      const selectable = addSpan(element, 'pv-selectable-move');
      selectable.setAttribute('data-idx', variationIdx.toString());
      selectable.setAttribute('data-ply', ply.toString());
      if (is_white(startPly)) {
        addSpan(selectable, 'move-number', `${Math.floor(startPly / 2) + 1}.`);
      }
      addSpan(selectable, 'pv-move', san);
      startPly++;
    }
  }
};