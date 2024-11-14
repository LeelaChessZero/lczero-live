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
  renderAfterPieces: boolean;
  offset: number;
  totalOffsets: number;
  offsetDirection: number;
}

export function moveToDirectionDeg(move: string): number {
  const [file1, rank1] = squareToFileRank(move.slice(0, 2));
  const [file2, rank2] = squareToFileRank(move.slice(2, 4));
  return Math.round(Math.atan2(rank2 - rank1, file2 - file1) * 180 / Math.PI);
}

const SQUARE_SIZE = 45;
const BEAM_SPREAD = 55;
const OUTLINE_WIDTH = 3;

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
  private outlinedSquares: Set<string> = new Set();
  private flipped: boolean = false;
  private arrows: ArrowLocation[] = [];
  private whiteToMove: boolean = true;
  private border: number = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w');
  }

  public clearHighlights(): void {
    this.highlightedSquares.clear();
  }

  public clearArrows(): void {
    this.arrows = [];
  }

  public clearOutlines(): void {
    this.outlinedSquares.clear();
  }

  public addHighlight(square: string): void {
    this.highlightedSquares.add(square);
  }

  public addOutline(square: string): void {
    this.outlinedSquares.add(square);
  }

  public addArrow(arrow: ArrowLocation): void {
    this.arrows.push(arrow);
  }

  public render(): void {
    this.element.innerHTML = '';

    let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'board');
    const side = SQUARE_SIZE * 8 + 2 * this.border;
    svg.setAttribute('viewBox', `0 0 ${side} ${side}`);
    this.renderBoard(svg);
    this.renderOutlines(svg);
    this.renderPieces(svg, false);
    this.renderArrows(svg, false);
    this.renderPieces(svg, true);
    this.renderArrows(svg, true);
    this.element.appendChild(svg);
  }

  private renderBoard(parent: SVGElement): void {
    Array.from({length: 8}, (_, rank) => {
      Array.from({length: 8}, (_, file) => {
        const x = (this.flipped ? 7 - file : file) * SQUARE_SIZE + this.border;
        const y = (this.flipped ? rank : 7 - rank) * SQUARE_SIZE + this.border;
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
        parent.appendChild(square);
      });
    });
  }


  private renderOutlines(parent: SVGElement): void {
    this.outlinedSquares.forEach(square => {
      const [file, rank] = squareToFileRank(square);
      const x = (this.flipped ? 7 - file : file) * SQUARE_SIZE + this.border;
      const y = (this.flipped ? rank : 7 - rank) * SQUARE_SIZE + this.border;
      const outline =
          document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const hWidth = OUTLINE_WIDTH / 2;
      outline.setAttribute('x', (x + hWidth).toString());
      outline.setAttribute('y', (y + hWidth).toString());
      outline.setAttribute('width', (SQUARE_SIZE - 2 * hWidth).toString());
      outline.setAttribute('height', (SQUARE_SIZE - 2 * hWidth).toString());
      outline.setAttribute('class', 'square-outline');
      parent.appendChild(outline);
    });
  }



  private renderPieces(parent: SVGElement, sideToMove: boolean): void {
    const whiteToShow: boolean = this.whiteToMove == sideToMove;
    this.pieces.forEach(piece => {
      const isWhitePiece =
          piece.pieceSymbol === piece.pieceSymbol.toUpperCase();
      if (isWhitePiece != whiteToShow) return;

      const x = (this.flipped ? 7 - piece.file : piece.file) * SQUARE_SIZE +
          this.border;
      const y = (this.flipped ? 7 - piece.rank : piece.rank) * SQUARE_SIZE +
          this.border;
      const pieceEl =
          document.createElementNS('http://www.w3.org/2000/svg', 'use');
      pieceEl.setAttribute('x', x.toString());
      pieceEl.setAttribute('y', y.toString());
      pieceEl.setAttributeNS(
          'http://www.w3.org/1999/xlink', 'href',
          `/static/pieces.svg#piece-${piece.pieceSymbol}`);
      if (this.whiteToMove == isWhitePiece) {
        pieceEl.setAttribute('class', ' side-to-move');
      }

      parent.appendChild(pieceEl);
    });
  }

  private renderArrows(parent: SVGElement, renderAfterPieces: boolean): void {
    for (let arrow of this.arrows) {
      if (arrow.renderAfterPieces != renderAfterPieces) {
        continue;
      }
      const ar = new Arrow();
      const [file1, rank1] = squareToFileRank(arrow.move.slice(0, 2));
      const [file2, rank2] = squareToFileRank(arrow.move.slice(2, 4));
      const offset =
          ((arrow.offset + 1) / (arrow.totalOffsets + 1) - 0.5) * BEAM_SPREAD;
      const dx = Math.sin(arrow.offsetDirection * Math.PI / 180) * offset;
      const dy = Math.cos(arrow.offsetDirection * Math.PI / 180) * offset;

      ar.x1 = (this.flipped ? 7 - file1 : file1) * SQUARE_SIZE + dx +
          SQUARE_SIZE / 2 + this.border;
      ar.y1 = (this.flipped ? rank1 : 7 - rank1) * SQUARE_SIZE + dy +
          SQUARE_SIZE / 2 + this.border;
      ar.x2 = (this.flipped ? 7 - file2 : file2) * SQUARE_SIZE + dx +
          SQUARE_SIZE / 2 + this.border;
      ar.y2 = (this.flipped ? rank2 : 7 - rank2) * SQUARE_SIZE + dy +
          SQUARE_SIZE / 2 + this.border;
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
    this.clearOutlines();
    this.whiteToMove = fen.split(' ')[1] === 'w';
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
