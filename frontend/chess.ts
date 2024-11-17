export function applyMoveToFen(fen: string, move: string): string {
  const board: string[] =
      fen.split(' ')[0]
          .split('/')
          .map(rank => rank.replace(/\d/g, d => '1'.repeat(+d)))
          .reverse();
  const whiteToMove = fen.split(' ')[1] === 'w';

  const sFile = move.charCodeAt(0) - 'a'.charCodeAt(0);
  const sRank = parseInt(move[1]) - 1;
  const eFile = move.charCodeAt(2) - 'a'.charCodeAt(0);
  const eRank = parseInt(move[3]) - 1;
  const piece = board[sRank][sFile];
  const isBlack = piece.toLowerCase() === piece;
  let promotion = move[4];
  if (promotion && !isBlack) promotion = promotion.toUpperCase();
  board[sRank] = replaceAt(board[sRank], sFile, '1');
  const dstPiece = board[eRank][eFile];
  const dstIsBlack = dstPiece.toLowerCase() === dstPiece;
  if (piece.toLowerCase() === 'k' &&
      (Math.abs(sFile - eFile) >= 2 ||
       (board[eRank][eFile] !== '1' && isBlack === dstIsBlack))) {
    // Castling!
    const dstKingFile = eFile > sFile ? 6 : 2;
    const dstRookFile = eFile > sFile ? 5 : 3;
    const srcRookFile = eFile > sFile ? 7 : 0;
    if (board[eRank][eFile] == '1') {
      board[eRank] = replaceAt(board[eRank], srcRookFile, '1');
    }
    board[eRank] = replaceAt(board[eRank], eFile, '1');
    board[eRank] = replaceAt(board[eRank], dstKingFile, piece);
    board[eRank] = replaceAt(board[eRank], dstRookFile, isBlack ? 'r' : 'R');
  } else {
    // En passant!
    if (piece.toLowerCase() === 'p' && sFile !== eFile && dstPiece === '1') {
      board[eRank + (isBlack ? 1 : -1)] =
          replaceAt(board[eRank + (isBlack ? 1 : -1)], eFile, '1');
    }

    board[eRank] = replaceAt(board[eRank], eFile, promotion || piece);
  }
  return board.reverse()
             .map(rank => rank.replace(/1+/g, m => m.length.toString()))
             .join('/') +
      ' ' + (whiteToMove ? 'b' : 'w');
}

function replaceAt(str: string, idx: number, repl: string): string {
  return str.substring(0, idx) + repl + str.substring(idx + 1);
}