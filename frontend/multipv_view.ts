import {Bar} from './bar';
import {isValidWdl, WdlBar} from './wdl';
import {WsEvaluationData} from './ws_feed';

export function numArrowsToRender(update: WsEvaluationData): number {
  for (let [ply, row] of update.variations.entries()) {
    if (ply == 0) continue;
    if (row.nodes / update.variations[0].nodes < 1 / 50) return ply;
    if (ply == 9) return 9;
  }
  return update.variations.length;
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
    function addTr(text: string): void {
      let th = document.createElement('th');
      th.textContent = text;
      tr.appendChild(th);
    }
    addTr('');
    addTr('Move');
    addTr('White / Draw / Black probability');
    addTr('Nodes / Probability of being best');
    addTr('PV');

    this.element = document.createElement('tbody');
    table.appendChild(this.element);
  }

  public clear(): void {
    this.element.innerHTML = '';
  }

  public updateMultiPv(update: WsEvaluationData): void {
    this.element.innerHTML = '';
    const numArrows = numArrowsToRender(update);
    for (let [ply, row] of update.variations.entries()) {
      const width =
          Math.pow(row.nodes / update.variations[0].nodes, 1 / 1.2) * 12;


      let tr = document.createElement('tr');
      function addCell(): HTMLElement {
        let td = document.createElement('td');
        tr.appendChild(td);
        return td;
      }
      const color = addCell();
      if (ply < numArrows) {
        const svg =
            document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '8');
        svg.setAttribute('height', '8');
        const rect =
            document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', '8');
        rect.setAttribute('height', '8');
        rect.setAttribute('class', `legend arrow-ply${ply}`);
        svg.appendChild(rect);
        color.appendChild(svg);
      }
      addCell().textContent = row.moveSan;
      if (isValidWdl(row.scoreW, row.scoreD, row.scoreB)) {
        let wdl = new WdlBar(addCell(), row.scoreW, row.scoreD, row.scoreB);
        wdl.render();
      } else {
        addCell();
      }
      const bar = new Bar(addCell(), row.nodes, update.nodes);
      bar.lText = row.nodes.toString();
      bar.rText = `${(100 * row.nodes / update.nodes).toFixed(1)}%`;
      bar.render();
      addCell().textContent = row.pvSan;

      this.element.appendChild(tr);
    }
  }
};