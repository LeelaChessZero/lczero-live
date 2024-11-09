export class VerticalWdlBar {
  private width: number = 55;
  private height: number = 45 * 8;
  public flipped: boolean = false;

  constructor(
      private w: number,
      private d: number,
      private l: number,
  ) {}

  public render(element: HTMLElement): void {
    element.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vwdl-bar');
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

    const d: number = this.d / total * this.height;
    const w: number = this.w / total * this.height;
    const l: number = this.l / total * this.height;

    let curY = 0;
    const subbars: [string, number][] = this.flipped ?
        [['vwdl-white', w], ['vwdl-draw', d], ['vwdl-black', l]] :
        [['vwdl-black', l], ['vwdl-draw', d], ['vwdl-white', w]];
    for (const [color, height] of subbars) {
      mkEl('rect', {
        x: '0',
        y: curY.toString(),
        width: this.width.toString(),
        height: height.toString(),
        class: color
      });
      curY += height;
    }

    const writeText = (text: string, y: number, className: string): void => {
      mkEl('text', {
        x: (this.width / 2).toString(),
        y: y.toString(),
        class: `${className}`
      }).innerHTML = text;
    };

    let drawTextAnchor = (this.flipped ? w : l) + d / 2;
    if (drawTextAnchor < 35) drawTextAnchor = 35;
    if (drawTextAnchor > this.height - 35) drawTextAnchor = this.height - 35;

    const textsAndStyles: {y: number, text: string, cls: string}[] =
        this.flipped ? [] : [
          {
            y: 2,
            text: `${(this.l / 10).toFixed(1)}%`,
            cls: 'text vwdl-top-text vwdl-black-text'
          },
          {
            y: this.height - 2,
            text: `${(this.w / 10).toFixed(1)}%`,
            cls: 'text vwdl-bottom-text vwdl-white-text'
          },
          {
            y: drawTextAnchor,
            text: `${(this.d / 10).toFixed(1)}%`,
            cls: 'text vwdl-middle-text vwdl-draw-text'
          }

          // {
          //   x: this.width - 2,
          //   text: `${(this.l / 10).toFixed(1)}%`,
          //   cls: 'text wdl-text-right vwdl-black-text'
          // },
          // {
          //   x: drawTextAnchor,
          //   text: `${(this.d / 10).toFixed(1)}%`,
          //   cls: `text ${(this.w < this.l) ? '' : 'wdl-text-right
          //   '}wdl-draw-text`
          // }
        ];

    for (const {y, text, cls} of textsAndStyles) {
      writeText(text, y, cls + '-shadow');
      writeText(text, y, cls);
    }

    element.appendChild(svg);
  }
};
