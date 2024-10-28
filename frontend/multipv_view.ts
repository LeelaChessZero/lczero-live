import {Bar} from './bar';
import {isValidWdl, WdlBar} from './wdl';
import {WsEvaluationData} from './ws_feed';

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
    addTr('Move');
    addTr('White / Draw / Black probability');
    addTr('Nodes');
    addTr('PV');

    this.element = document.createElement('tbody');
    table.appendChild(this.element);
  }

  public clear(): void {
    this.element.innerHTML = '';
  }

  public updateMultiPv(update: WsEvaluationData): void {
    this.element.innerHTML = '';
    for (let row of update.variations) {
      let tr = document.createElement('tr');
      function addCell(): HTMLElement {
        let td = document.createElement('td');
        tr.appendChild(td);
        return td;
      }
      addCell().textContent = row.moveSan;
      if (isValidWdl(row.scoreW, row.scoreD, row.scoreB)) {
        let wdl = new WdlBar(addCell(), row.scoreW, row.scoreD, row.scoreB);
        wdl.render();
      } else {
        addCell();
      }
      new Bar(addCell(), row.nodes, update.variations[0].nodes).render();
      addCell().textContent = row.nodes.toString();
      addCell().textContent = row.pvSan;

      this.element.appendChild(tr);
    }
  }
};