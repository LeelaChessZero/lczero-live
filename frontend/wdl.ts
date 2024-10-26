

export class WdlBar {
  private element: HTMLElement;
  private w: number;
  private d: number;
  private l: number;
  private width: number = 200;
  private height: number = 14;

  constructor(element: HTMLElement, w: number, d: number, l: number) {
    this.element = element;
    this.w = w;
    this.d = d;
    this.l = l;
  }

  public render(): void {
    this.element.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wdl-bar');
    svg.setAttribute('height', this.height.toString());
    svg.setAttribute('width', this.width.toString());

    const total = this.w + this.d + this.l;

    const d: number = this.d / total * this.width;
    const w: number = this.w / total * this.width;
    const l: number = this.l / total * this.width;

    let curX = 0;
    const subbars: [string, number][] =
        [['wdl-white', w], ['wdl-draw', d], ['wdl-black', l]];
    for (const [color, width] of subbars) {
      const bar =
          document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', curX.toString());
      bar.setAttribute('y', '0');
      bar.setAttribute('width', width.toString());
      bar.setAttribute('height', this.height.toString());
      bar.setAttribute('class', color);
      svg.appendChild(bar);
      curX += width;
    }
    const outer =
        document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outer.setAttribute('x', '0');
    outer.setAttribute('y', '0');
    outer.setAttribute('width', this.width.toString());
    outer.setAttribute('height', this.height.toString());
    outer.setAttribute('class', 'wdl-outer');
    svg.appendChild(outer);

    this.element.appendChild(svg);
  }
}