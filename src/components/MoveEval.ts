import { Chess } from 'chess.js';
import type { Color } from 'chess.js';

export class MoveEval {
  // Set during construction
  private game: Chess;
  public move: string;
  public logs: string;
  // Set during evaluation
  public possibleMoves: MoveEval[];
  public score: number;
  public bestMove: MoveEval;
  public finalState: MoveEval;

  constructor(game: Chess, move: string = '') {
    this.game = game;
    this.move = move;
    this.logs = '';
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

  // encodes that moving to the middle is better, for all pieces.
  private positionalValuesArray: number[][] = [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 1, 1, 2, 2, 1, 1, 0], 
    [0, 1, 4, 4, 4, 4, 1, 0],
    [0, 2, 5, 7, 7, 5, 2, 0], 
    [0, 2, 5, 7, 7, 5, 2, 0],
    [0, 1, 4, 4, 4, 4, 1, 0], 
    [0, 1, 1, 2, 2, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ]

  private positionalValues(square: string): number {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square.charAt(1)) - 1;
    return this.positionalValuesArray[rank][file];
  }

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

  nextTurn(): Color {
    return this.game.turn() === 'w' ? 'w' : 'b';
  }

  materialPointsAheadForWhite(): number {
    this.logs += `Calculating material points ahead...\n`;
    const {white: materialWhite, black: materialBlack} = this.materialPoints();
    this.logs += `Material points: white: ${materialWhite}, black: ${materialBlack}\n`;
    const pointsAhead = materialWhite - materialBlack;
    this.logs += `Points ahead: ${pointsAhead}\n`;
    if (isNaN(pointsAhead)) {
      return materialWhite; // e.g. Infinity
    }
    return pointsAhead;
  }

  /**
   * Calculates the material points for a given color
   * @returns Total material points for that color
   */
  materialPoints(): {white: number, black: number} {
    if (this.game.isGameOver()) {
      if (this.game.isCheckmate()) {
        if (this.game.turn() === 'w') { 
          return {white: -99999, black: 99999 };
        } else {
          return {white: 99999, black: -99999};
        }
      }
      if (this.game.isStalemate()) {
        return {white: 0, black: 0};
      }
      if (this.game.isDraw()) {
        return {white: 0, black: 0};
      }
    }
    let whitePoints = 0;
    let blackPoints = 0;
    const board = this.game.board();

    for (const row of board) {
      for (const piece of row) {
        if (piece) {
          const value = this.materialValues[piece.type] || 0;
          if (piece.color === 'w') {
            whitePoints += value;
          } else {
            blackPoints += value;
          }
        }
      }
    }
    return {white: whitePoints, black: blackPoints};
  }

  /**
   * Calculates the positional points for a given color
   * @param color - 'w' for white or 'b' for black
   * @returns Total positional points for that color
   */
  positionalPoints(): {white: number, black: number} {  
    let whitePoints = 0;
    let blackPoints = 0;
    const board = this.game.board();
    for (const row of board) {
      for (const piece of row) {  
        if (piece) {
          const value = this.positionalValues(piece.square) / 100;
          if (piece.color === 'w') {
            whitePoints += value;
          } else {
            blackPoints += value;
          }
        }
      }
    }
    return {white: whitePoints, black: blackPoints};
  }

  minimax(evalFunc: (moveEval: MoveEval) => number, depth: number, isMaximizing: boolean): MoveEval {
    this.findPossibleMoves();
    if (depth === 0 || this.possibleMoves.length === 0) {
      this.finalState = this;
      this.score = evalFunc(this);
      return this;
    }
    
    this.score = isMaximizing ? -Infinity : Infinity;
    for (const move of this.possibleMoves) {
      move.minimax(evalFunc, depth - 1, !isMaximizing);
      const isBetter = isMaximizing ? move.score > this.score : move.score < this.score;
      if (isBetter) {
        this.score = move.score;
        this.finalState = move.finalState;
        this.bestMove = move;
      }
    }
    
    return this.bestMove; // can use the bestMove returned, or call functions on this object.
  };

  /** 
   * Returns an array of MoveEval objects for all possible moves
   * @returns Array of MoveEval objects
   */
  findPossibleMoves(): MoveEval[] {
    const gameMoves = this.game.moves();
    this.possibleMoves = gameMoves.map(move => this.moveAndClone(move));
    return this.possibleMoves;
  }

  moveAndClone(move: string): MoveEval {
    const newGame = new Chess(this.game.fen());
    newGame.move(move);
    return new MoveEval(newGame, move);
  }

  getMovesAndScores(): {move: string, score: number}[] {
    return this.possibleMoves.map(move => ({move: move.getMoveString(), score: move.score}));
  }

  getMovesAndScoresSortedAsString(): string {
    this.possibleMoves.sort((a, b) => a.score - b.score); 
    const movesAndScore = this.possibleMoves.map(move => `${move.getMoveString()}: ${move.score.toFixed(2)}`).join('\n')
    return `Current Eval: ${this.score.toFixed(2)}\n` + movesAndScore;
  }
}
