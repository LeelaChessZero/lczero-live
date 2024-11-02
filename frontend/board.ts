import {Arrow} from './arrow';


interface PieceLocation {
  pieceSymbol: string;  // Upper case for white, lower case for black.
  rank: number;         // 0-based
  file: number;         // 0-based
}

export interface ArrowLocation {
  move: string;
  classes: string;
  width: number;
  angle: number;
  headLength: number;
  headWidth: number;
  dashLength: number;
  dashSpace: number;
}

const SQUARE_SIZE = 45;

function fileRanktoSquare(rank: number, file: number): string {
  return 'abcdefgh'[file] + (rank + 1).toString();
}

function squareToFileRank(square: string): [number, number] {
  return [square.charCodeAt(0) - 'a'.charCodeAt(0), parseInt(square[1]) - 1];
}

export class Board {
  private element: HTMLElement;
  private pieces: Set<PieceLocation> = new Set();
  private highlightedSquares: Set<string> = new Set();
  private flipped: boolean = false;
  private arrows: ArrowLocation[] = [];

  constructor(element: HTMLElement) {
    this.element = element;
    this.fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  }

  public clearHighlights(): void {
    this.highlightedSquares.clear();
  }

  public clearArrows(): void {
    this.arrows = [];
  }

  public addHighlight(square: string): void {
    this.highlightedSquares.add(square);
  }

  public addArrow(arrow: ArrowLocation): void {
    this.arrows.push(arrow);
  }

  public render(): void {
    this.element.innerHTML = '';

    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'board');
    const border = 0;
    svg.setAttribute('height', (SQUARE_SIZE * 8 + 2 * border).toString());
    svg.setAttribute('width', (SQUARE_SIZE * 8 + 2 * border).toString());

    Array.from({length: 8}, (_, rank) => {
      Array.from({length: 8}, (_, file) => {
        const x = (this.flipped ? 7 - file : file) * SQUARE_SIZE + border;
        const y = (this.flipped ? rank : 7 - rank) * SQUARE_SIZE + border;
        const is_light = (rank + file) % 2 === 1;
        const square =
            document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        square.setAttribute('x', x.toString());
        square.setAttribute('y', y.toString());
        square.setAttribute('width', SQUARE_SIZE.toString());
        square.setAttribute('height', SQUARE_SIZE.toString());
        let className = 'square';
        className += is_light ? ' light' : ' dark';
        if (this.highlightedSquares.has(fileRanktoSquare(rank, file))) {
          className += ' lastmove';
        }
        square.setAttribute('class', className);
        svg.appendChild(square);
      });
    });

    this.pieces.forEach(piece => {
      const x =
          (this.flipped ? 7 - piece.file : piece.file) * SQUARE_SIZE + border;
      const y =
          (this.flipped ? 7 - piece.rank : piece.rank) * SQUARE_SIZE + border;
      const pieceEl =
          document.createElementNS('http://www.w3.org/2000/svg', 'use');
      pieceEl.setAttribute('x', x.toString());
      pieceEl.setAttribute('y', y.toString());
      pieceEl.setAttributeNS(
          'http://www.w3.org/1999/xlink', 'href',
          `/static/pieces.svg#piece-${piece.pieceSymbol}`);
      svg.appendChild(pieceEl);
    });

    this.renderArrows(svg);
    this.element.appendChild(svg);
  }

  private renderArrows(parent: SVGElement): void {
    const border = 0;
    for (let arrow of this.arrows) {
      const ar = new Arrow();
      const [file1, rank1] = squareToFileRank(arrow.move.slice(0, 2));
      const [file2, rank2] = squareToFileRank(arrow.move.slice(2, 4));
      ar.x1 = (this.flipped ? 7 - file1 : file1) * SQUARE_SIZE +
          SQUARE_SIZE / 2 + border;
      ar.y1 = (this.flipped ? rank1 : 7 - rank1) * SQUARE_SIZE +
          SQUARE_SIZE / 2 +

          border;
      ar.x2 = (this.flipped ? 7 - file2 : file2) * SQUARE_SIZE +
          SQUARE_SIZE / 2 + border;
      ar.y2 = (this.flipped ? rank2 : 7 - rank2) * SQUARE_SIZE +
          SQUARE_SIZE / 2 + border;
      ar.classes = arrow.classes;
      ar.width = arrow.width;
      ar.angle = arrow.angle;
      ar.headLength = arrow.headLength;
      ar.headWidth = arrow.headWidth;
      ar.dashLength = arrow.dashLength;
      ar.dashSpace = arrow.dashSpace;
      ar.render(parent);
    }
  }

  public fromFen(fen: string): void {
    this.pieces.clear();
    this.clearArrows();
    const rows = fen.split(' ')[0].split('/');
    rows.forEach((row, rowIndex) => {
      let file = 0;
      for (let char of row) {
        const num = parseInt(char);
        if (isNaN(num)) {
          this.pieces.add({pieceSymbol: char, rank: rowIndex, file: file});
          file++;
        } else {
          file += num;
        }
      }
    });
  }
};
