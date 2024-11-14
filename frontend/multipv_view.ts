import {numVariationsToRender} from './arrow_selector';
import {Bar} from './bar';
import {isValidWdl, WdlBar} from './wdl';
import {WsEvaluationData} from './ws_feed';

function makePv(element: HTMLElement, pvSan: string, ply: number): void {
  element.classList.add('pv-cell');
  const is_white = p => p % 2 == 0;

  const addSpan =
      (text: string, className: string) => {
        const span = document.createElement('span');
        span.textContent = text;
        span.classList.add(className);
        element.appendChild(span);
      }

  if (!is_white(ply)) addSpan(`${Math.floor(ply / 2) + 1}…`, 'move-number');
  for (let san of pvSan.split(' ')) {
    if (is_white(ply)) addSpan(`${Math.floor(ply / 2) + 1}.`, 'move-number');
    addSpan(san, 'pv-move');
    ply++;
  }
}

export class MultiPvView {
  private parent: HTMLElement;
  private element: HTMLElement;

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
    table.appendChild(this.element);
  }

  public clear(): void {
    this.element.innerHTML = '';
  }

  public updateMultiPv(update: WsEvaluationData, nextMoveUci?: string): void {
    this.element.innerHTML = '';
    const numArrows = numVariationsToRender(update);
    for (let [variation, row] of update.variations.entries()) {
      const width =
          Math.pow(row.nodes / update.variations[0].nodes, 1 / 1.2) * 12;

      let tr = document.createElement('tr');
      if (nextMoveUci && row.pvUci.split(' ')[0] == nextMoveUci) {
        tr.classList.add('row-move-played');
      }
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
      addCell().textContent = row.pvSan.split(' ')[0];
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
      makePv(addCell(), row.pvSan, update.ply);

      this.element.appendChild(tr);
    }
  }
};