import {GameThinkingUpdate} from './thinking_feed';
import {WdlBar, isValidWdl} from './wdl';

export class MultiPvView {
  private parent: HTMLElement;
  private element: HTMLTableElement;

  constructor(parent: HTMLElement) {
    this.parent = parent;
    this.element = document.createElement('table');
    this.parent.appendChild(this.element);
  }

  public clear(): void {
    this.element.innerHTML = '';
  }

  public updateMultiPv(update: GameThinkingUpdate): void {
    this.element.innerHTML = '';
    for (let row of update.moves) {
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
      addCell().textContent = row.nodes.toString();
      addCell().textContent = row.pvSan;

      this.element.appendChild(tr);
    }
  }
};