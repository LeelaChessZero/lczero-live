

export class Bar {
  private element: HTMLElement;
  private value: number;
  private total: number;
  private width: number = 200;
  private height: number = 14;

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

    this.element.appendChild(svg);
  }
};