import { Chess } from 'chess.js';
import type { Color } from 'chess.js';

export class MoveEval {
  private game: Chess;
  private move: string;
  constructor(game: Chess, move: string = '') {
    this.game = game;
    this.move = move;
  }

  private materialValues: { [key: string]: number } = {
    'p': 1,
    'n': 3,
    'b': 3,
    'r': 5,
    'q': 9,
    'k': 0
  };

  private pieceNames: { [key: string]: string } = {
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king'
  };

  getPieceName(): string {
    return this.pieceNames[this.getPieceType()] || 'pawn';
  }

  getPieceType(): string {
    const firstChar = this.move.split('')[0];
    if (firstChar === 'N') return 'n';
    if (firstChar === 'B') return 'b';
    if (firstChar === 'R') return 'r';
    if (firstChar === 'Q') return 'q';
    if (firstChar === 'K') return 'k';
    if (firstChar === 'O') return 'k'; // O-O-O
    // if firstChar is lowercase a to h, return 'p'
    if (firstChar >= 'a' && firstChar <= 'h') return 'p';
    return 'p';
  }

  getMoveString(): string {
    return this.move;
  }

  /**
   * Calculates the material points for a given color
   * @param color - 'w' for white or 'b' for black
   * @returns Total material points for that color
   */
  points(color: Color): number {
    let totalPoints = 0;
    const board = this.game.board();

    for (const row of board) {
      for (const piece of row) {
        if (piece && piece.color === color) {
          const value = this.materialValues[piece.type] || 0;
          totalPoints += value;
        }
      }
    }

    return totalPoints;
  }

    /**
   * Calculates the material points for a given color
   * @param color - 'w' for white or 'b' for black
   * @returns Total material points for that color
   */
    pointsAhead(color: Color): number {
      if (this.game.isGameOver()) {
        if (this.game.isCheckmate()) {
          return (color === this.game.turn()) ? -Infinity : Infinity;
        }
        if (this.game.isStalemate()) {
          return 0;
        }
        if (this.game.isDraw()) {
          return 0;
        }
      }
      let totalPoints = 0;
      const board = this.game.board();
  
      for (const row of board) {
        for (const piece of row) {
          if (piece) {
            const value = this.materialValues[piece.type] || 0;
            if (piece.color === color) {
              totalPoints += value;
            } else {
              totalPoints -= value;
            }
          }
        }
      }
  
      return totalPoints;
    }

  /** 
   * Returns an array of BoardVision objects for all possible moves
   * @returns Array of BoardVision objects
   */
  possibleMoves(): MoveEval[] {
    const possibleMoves = this.game.moves();
    return possibleMoves.map(move => this.moveAndClone(move));
  }

  moveAndClone(move: string): MoveEval {
    const newGame = new Chess(this.game.fen());
    newGame.move(move);
    return new MoveEval(newGame, move);
  }
}
