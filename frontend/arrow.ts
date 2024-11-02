

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function arcLength(chordLength: number, angle: number): number {
  if (angle === 0) return chordLength;
  return angle * chordLength / (2 * Math.sin(angle / 2));
}

interface vector {
  x: number;
  y: number;
  angle: number;
}

function mkSvgElement(tag: string, attrs: {[key: string]: string}): SVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  return el;
}

function mkLine(x1: number, y1: number, x2: number, y2: number): SVGElement {
  return mkSvgElement('line', {
    x1: x1.toString(),
    y1: y1.toString(),
    x2: x2.toString(),
    y2: y2.toString()
  });
}

function mkWidePath(
    x1: number, y1: number, x2: number, y2: number, width: number): SVGElement {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const dx = -Math.sin(angle) * width / 2;
  const dy = Math.cos(angle) * width / 2;
  return mkSvgElement('path', {
    d: `M ${x1 + dx} ${y1 + dy} L ${x2 + dx} ${y2 + dy} L ${x2 - dx} ${
        y2 - dy} L ${x1 - dx} ${y1 - dy} Z`,
    stroke: 'black',
    fill: 'none',
    'stroke-width': '1',
  });
}

export class Arrow {
  public x1: number;
  public y1: number;
  public x2: number;
  public y2: number;
  public classes: string = '';
  public width: number = 5;
  public angle: number = 0;
  public headLength: number = 20;
  public headWidth: number = 20;
  public dashLength: number = 40;
  public dashSpace: number = 20;

  constructor() {}

  public render(el: SVGElement): void {
    const length = this.length();
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const rotation =
        Math.atan2(this.y2 - this.y1, this.x2 - this.x1) * 180 / Math.PI;
    group.setAttribute(
        'transform', `translate(${this.x1}, ${this.y1}) rotate(${rotation})`);
    el.appendChild(group);
    let rendered_head = false;
    for (let start = 0; !rendered_head;
         start += this.dashLength + this.dashSpace) {
      const end = Math.min(length, start + this.dashLength);
      rendered_head = start + this.dashLength + this.headLength >= length;
      this.renderDash(
          group, Math.min(start, length - this.headLength), end, rendered_head);
    }
  }

  private renderDash(
      parent: SVGElement, startDistance: number, endDistance: number,
      renderArrow: boolean): void {
    const length = this.length();
    const p0 = this.vectorAtDistance(startDistance);
    const p1 = this.vectorAtDistance(
        renderArrow ? length - this.headLength : endDistance);
    const p2 = this.vectorAtDistance(renderArrow ? length : endDistance);

    const angle = Math.atan2(p2.y - p0.y, p2.x - p0.x);
    const dxNorm = -Math.sin(angle);
    const dyNorm = Math.cos(angle);
    const dx = dxNorm * this.width / 2;
    const dy = dyNorm * this.width / 2;
    let d = `M ${p1.x + dx} ${p1.y + dy} L ${p0.x + dx} ${p0.y + dy} L ${
        p0.x - dx} ${p0.y - dy} L ${p1.x - dx} ${p1.y - dy}`;
    if (renderArrow) {
      const dxHead = dxNorm * this.headWidth / 2;
      const dyHead = dyNorm * this.headWidth / 2;
      d += ` L ${p1.x - dxHead} ${p1.y - dyHead} L ${p2.x} ${p2.y} L ${
          p1.x + dxHead} ${p1.y + dyHead}`;
    }
    const path = mkSvgElement('path', {
      d: `${d} Z`,
      'class': this.classes,
    });
    parent.appendChild(path);
  }

  private vectorAtDistance(k: number): vector {
    const dist = this.displacement();
    if (this.angle === 0) return {x: k, y: 0, angle: 0};
    const length = this.length();
    const fraction = k / length;

    const hAngle = this.angle / 2;
    const angle = fraction * this.angle - hAngle;
    const rawX = Math.sin(angle);
    const rawY = Math.cos(angle);
    const scale = dist / (2 * Math.sin(this.angle / 2));
    return {
      x: (rawX + Math.sin(hAngle)) * scale,
      y: (rawY - Math.cos(hAngle)) * scale,
      angle: angle,
    };
  }

  private displacement(): number {
    return distance(this.x1, this.y1, this.x2, this.y2);
  }

  private length(): number {
    return arcLength(this.displacement(), this.angle);
  }
}