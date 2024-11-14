
export function isValidWdl(w?: number, d?: number, l?: number): boolean {
  if (w == null || d == null || l == null) return false;
  return w > 0 || d > 0 || l > 0;
}

export class WdlBar {
  private width: number = 240;
  private height: number = 18;

  constructor(
      private element: HTMLElement,
      private w: number,
      private d: number,
      private l: number,
  ) {}

  public render(): void {
    this.element.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'wdl-bar');
    svg.setAttribute('height', this.height.toString());
    svg.setAttribute('width', this.width.toString());

    const mkEl = (tag: string, attrs: {[key: string]: string}): SVGElement => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attrs)) {
        el.setAttribute(key, value);
      }
      svg.appendChild(el);
      return el;
    };

    const total = this.w + this.d + this.l;

    const d: number = this.d / total * this.width;
    const w: number = this.w / total * this.width;
    const l: number = this.l / total * this.width;

    let curX = 0;
    const subbars: [string, number][] =
        [['wdl-white', w], ['wdl-draw', d], ['wdl-black', l]];
    for (const [color, width] of subbars) {
      mkEl('rect', {
        x: curX.toString(),
        y: '0',
        width: width.toString(),
        height: this.height.toString(),
        class: color
      });
      curX += width;
    }

    mkEl('line', {
      x1: (this.width / 2).toString(),
      y1: '0',
      x2: (this.width / 2).toString(),
      y2: this.height.toString(),
      class: 'wdl-midline'
    });

    const writeText = (text: string, x: number, className: string): void => {
      mkEl('text', {
        x: x.toString(),
        y: (this.height / 2).toString(),
        class: `${className}`
      }).innerHTML = text;
    };

    let drawTextAnchor = w + 0.5 * d;
    if (drawTextAnchor < 40) drawTextAnchor = 40;
    if (drawTextAnchor > this.width - 40) drawTextAnchor = this.width - 40;
    const textsAndStyles: {x: number, text: string, cls: string}[] = [
      {x: 2, text: `${(this.w / 10).toFixed(1)}%`, cls: 'text wdl-white-text'},
      {
        x: this.width - 2,
        text: `${(this.l / 10).toFixed(1)}%`,
        cls: 'text wdl-text-right wdl-black-text'
      },
      {
        x: drawTextAnchor,
        text: `${(this.d / 10).toFixed(1)}%`,
        cls: `text ${(this.w < this.l) ? '' : 'wdl-text-right '}wdl-draw-text`
      }
    ];

    for (const {x, text, cls} of textsAndStyles) {
      writeText(text, x, cls + '-shadow');
    }
    mkEl('line', {
      x1: (w + d / 2).toString(),
      y1: '0',
      x2: (w + d / 2).toString(),
      y2: this.height.toString(),
      class: 'wdl-middle'
    });
    for (const {x, text, cls} of textsAndStyles) {
      writeText(text, x, cls);
    }

    mkEl('rect', {
      x: '0',
      y: '0',
      width: this.width.toString(),
      height: this.height.toString(),
      class: 'wdl-outer'
    });
    this.element.appendChild(svg);
  }
}