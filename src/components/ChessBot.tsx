import { Chess } from 'chess.js';

const getPieceName = (pieceType: string): string => {
  const pieceNames: { [key: string]: string } = {
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king'
  };
  return pieceNames[pieceType] || pieceType;
};

const getPieceType = (moveString: string) => {
  const pieceMap: { [key: string]: string } = {
    'N': 'n',
    'B': 'b',
    'R': 'r',
    'Q': 'q',
    'K': 'k'
  };
  return pieceMap[moveString[0]] || 'p';
};

// Bot move logic
// In this function, the bot is passed the game object, and will return a moveString, and a chatMessage
// Note: This function does NOT make the move - it only returns what move should be made
export const botMove = (game: Chess) => {
  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.' };
  }

  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  const moveString = possibleMoves[randomIdx];
  const pieceType = getPieceType(moveString);
  const pieceName = getPieceName(pieceType);
  
  return { moveString, chatMessage: `Out of ${possibleMoves.length} possible moves, I chose the ${pieceName}.` };
};

