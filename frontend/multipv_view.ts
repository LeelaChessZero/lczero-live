import {GameThinkingUpdate} from './thinking_feed';

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
    console.log(update);
  }
};