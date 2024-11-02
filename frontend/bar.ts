

export class Bar {
  private element: HTMLElement;
  private value: number;
  private total: number;
  private width: number = 200;
  private height: number = 14;
  public lText?: string;
  public rText?: string;

  constructor(element: HTMLElement, value: number, total: number) {
    this.element = element;
    this.value = value;
    this.total = total;
  }

  public render(): void {
    this.element.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'nodes-bar');
    svg.setAttribute('height', this.height.toString());
    svg.setAttribute('width', this.width.toString());

    const width: number = this.value / this.total * this.width;
    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('x', '0');
    bar.setAttribute('y', '0');
    bar.setAttribute('width', width.toString());
    bar.setAttribute('height', this.height.toString());
    bar.setAttribute('class', 'nodes-inner');
    svg.appendChild(bar);

    const outer =
        document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    outer.setAttribute('x', '0');
    outer.setAttribute('y', '0');
    outer.setAttribute('width', this.width.toString());
    outer.setAttribute('height', this.height.toString());
    outer.setAttribute('class', 'nodes-outer');
    svg.appendChild(outer);

    if (this.lText) {
      const left =
          document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const onBar = this.lText.length * 8 < width;
      left.setAttribute('x', (onBar ? 2 : 2 + width).toString());
      left.setAttribute('y', (this.height / 2).toString());
      left.setAttribute('class', onBar ? 'text-onbar' : 'text-offbar');
      left.setAttribute('style', 'text-anchor: start');
      left.textContent = this.lText;
      svg.appendChild(left);
    }

    if (this.rText) {
      const right =
          document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const onBar = this.rText.length * 9 > (this.width - width);
      right.setAttribute('x', (onBar ? width - 2 : this.width - 2).toString());
      right.setAttribute('y', (this.height / 2).toString());
      right.setAttribute('class', onBar ? 'text-onbar' : 'text-offbar');
      right.setAttribute('style', 'text-anchor: end');
      right.textContent = this.rText;
      svg.appendChild(right);
    }

    this.element.appendChild(svg);
  }
};