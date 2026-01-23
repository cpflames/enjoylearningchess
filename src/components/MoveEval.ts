import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { BotConfig } from './ChessBot';

export let GLOBAL_EVAL_COUNT: number = 0;

export class MoveEval {
  // Set during construction
  private game: Chess;
  public move: string;
  public logs: string;
  public botConfig: BotConfig;
  // Set during post-construction
  public lineString: string = '';
  public materialPoints: {white: number, black: number};
  public positionalPoints: {white: number, black: number};
  public initialScore: number; // score of the initial state
  // Set during evaluation
  public score: number; // score of the bestMove / finalState line
  public possibleMoves: MoveEval[];
  public topMoves: MoveEval[];
  public bestMove: MoveEval;
  public finalState: MoveEval;

  private constructor(game: Chess, botConfig: BotConfig, move: string) {
    this.game = game;
    this.botConfig = botConfig;
    this.move = move;
    this.logs = '';
  }

  // This doesn't take a move, because it is for setting up the initial board state.
  public static fromScratch(game: Chess, botConfig: BotConfig): MoveEval {
    const moveEval = new MoveEval(game, botConfig, '');
    moveEval.findMaterialPoints();
    moveEval.findPositionalPoints();
    moveEval.lineString = '';
    moveEval.initialScore = botConfig.strategy.evalFunc(moveEval);
    return moveEval;
  }

  // This will now make the move and undo the move, because it's used for initial consideration of moves.
  public static fromParent(parent: MoveEval, move: string): MoveEval {
    const game = parent.game;
    game.move(move); // make the move
    const moveEval = new MoveEval(game, parent.botConfig, move);
    // Use spread operator to create a new object with the same properties as the parent's materialPoints and positionalPoints
    moveEval.materialPoints = { ...parent.materialPoints };
    moveEval.positionalPoints = { ...parent.positionalPoints };
    moveEval.updatePointsForMove(move);
    moveEval.initialScore = moveEval.botConfig.strategy.evalFunc(moveEval);
    moveEval.lineString = `${parent.lineString} ${move}`;
    game.undo(); // undo the move
    return moveEval;
  }

  private updatePointsForMove(move: string): void {
    const start = performance.now();
    // Use undo as the fastest way to get the full moveObject
    const moveObject = this.game.undo();
    if (!moveObject) {
      return;
    }
    this.game.move(move);
    const color = moveObject.color;
    const from = moveObject.from;
    const to = moveObject.to;
    //const piece = moveObject.piece;
    const fromSquareValue = this.positionalValues(from);
    const toSquareValue = this.positionalValues(to);

    if (moveObject.isCapture()) {
      const capturedPiece = moveObject.captured || 'p';
      const value = this.materialValues[capturedPiece] || 0;
      if (color === 'w') { // white captured black piece
        this.materialPoints.black -= value;
        this.positionalPoints.black -= toSquareValue;
      } else { // black captured white piece
        this.materialPoints.white -= value;
        this.positionalPoints.white -= toSquareValue;
      }
    }
    if (moveObject.isPromotion()) {
      const promotionPiece = moveObject.promotion || 'q';
      const value = this.materialValues[promotionPiece] || 0;
      if (color === 'w') { // white promoted piece
        this.materialPoints.white += value - 1; // -1 for the pawn that was promoted
      } else { // black promoted piece
        this.materialPoints.black += value - 1; // -1 for the pawn that was promoted
      }
    }
    if (moveObject.isKingsideCastle() || moveObject.isQueensideCastle()) {
      const value = 0.5; // castling is cool
      if (color === 'w') { // white castled
        this.materialPoints.white += value;
      } else { // black castled
        this.materialPoints.black += value;
      }
    }
    if (this.game.isCheckmate()) {
      if (color === 'w') { // white checkmated
        this.materialPoints.white = 50000;
        this.materialPoints.black = -50000;
      } else { // black checkmated
        this.materialPoints.white = -50000;
        this.materialPoints.black = 50000;
      }
    }
    if (this.game.isDraw()) {
      this.materialPoints.white = 0;
      this.materialPoints.black = 0;
    }
    // positional points update
    if (color === 'w') { // white moved
      this.positionalPoints.white += (toSquareValue - fromSquareValue);
    } else { // black moved
      this.positionalPoints.black += (toSquareValue - fromSquareValue);
    }
    const end = performance.now();
    const duration = end - start;
    this.log(`updatePointsForMove took ${duration.toFixed(2)}ms`);
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
    [0, 1, 1, 1, 1, 1, 1, 0], 
    [0, 1, 4, 4, 4, 4, 1, 0],
    [0, 2, 5, 9, 9, 5, 2, 0], 
    [0, 2, 5, 9, 9, 5, 2, 0],
    [0, 1, 4, 4, 4, 4, 1, 0], 
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0],
  ]

  private positionalValues(square: string): number {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = parseInt(square.charAt(1)) - 1;
    return this.positionalValuesArray[rank][file] / 100;
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

  getFinalStateString(): string {
    return this.finalState.lineString;
  }

  nextTurn(): Color {
    return this.game.turn() === 'w' ? 'w' : 'b';
  }

  materialPointsAheadForWhite(): number {
    return this.materialPoints.white - this.materialPoints.black;
  }

  positionalPointsAheadForWhite(): number {
    return this.positionalPoints.white - this.positionalPoints.black;
  }

  /**
   * Calculates the material points for a given color
   * @returns Total material points for that color
   */
  findMaterialPoints(): {white: number, black: number} {
    const start = performance.now();
    if (this.game.isGameOver()) {
      if (this.game.isCheckmate()) {
        if (this.game.turn() === 'w') { 
          return {white: -50000, black: 50000};
        } else {
          return {white: 50000, black: -50000};
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
    const end = performance.now();
    const duration = end - start;
    this.log(`findMaterialPoints took ${duration.toFixed(2)}ms`);
    this.materialPoints = {white: whitePoints, black: blackPoints};
    return this.materialPoints;
  }

  /**
   * Calculates the positional points for a given color
   * @param color - 'w' for white or 'b' for black
   * @returns Total positional points for that color
   */
  findPositionalPoints(): {white: number, black: number} {  
    const start = performance.now();
    let whitePoints = 0;
    let blackPoints = 0;
    const board = this.game.board();
    for (const row of board) {
      for (const piece of row) {  
        if (piece) {
          const value = this.positionalValues(piece.square);
          if (piece.color === 'w') {
            whitePoints += value;
          } else {
            blackPoints += value;
          }
        }
      }
    }
    const end = performance.now();
    const duration = end - start;
    this.log(`findPositionalPoints took ${duration.toFixed(2)}ms`);
    this.positionalPoints = {white: whitePoints, black: blackPoints};
    return this.positionalPoints;
  }

  minimax(): MoveEval {
    this._minimax(this.botConfig.depth, false);
    this.topMoves.sort((a, b) => (a.score > b.score) ? 1 : -1);
    return this.topMoves[0];
  }

  private _minimax(depth: number, isMaximizing: boolean): MoveEval {
    const start = performance.now();
    GLOBAL_EVAL_COUNT++;
    const strategy = this.botConfig.strategy;
    const gameMoves = this.game.moves();
    if (depth === 0 || gameMoves.length === 0) {
      this.finalState = this;
      this.score = strategy.evalFunc(this);
      return this;
    }
    const flip = isMaximizing ? 1 : -1;
    const numMovesToConsider = this.botConfig.breadth;

    this.possibleMoves = gameMoves.map(move => MoveEval.fromParent(this, move));
    this.possibleMoves.sort((a, b) => (b.initialScore - a.initialScore) * flip);
    this.topMoves = this.possibleMoves.slice(0, numMovesToConsider);
    
    this.score = isMaximizing ? -Infinity : Infinity;
    for (const moveEval of this.topMoves) {
      // Setup
      this.game.move(moveEval.move); // make the move
      // Eval
      moveEval._minimax(depth - 1, !isMaximizing);
      // Interpret
      const isBetter = isMaximizing ? moveEval.score > this.score : moveEval.score < this.score;
      if (isBetter) {
        this.score = moveEval.score;
        this.finalState = moveEval.finalState;
        this.bestMove = moveEval;
      }
      // Cleanup
      this.game.undo();
    }
    const end = performance.now();
    const duration = end - start;
    this.log(`minimax took ${duration.toFixed(2)}ms`);
    return this.bestMove; // can use the bestMove returned, or call functions on this object.
  };

  getCurrentEvalAsString(): string {
    return `Current Eval: (initial: ${this.initialScore.toFixed(2)}, best line: ${this.score.toFixed(2)})`;
  }

  getMovesAndScores(): {move: string, score: number}[] {
    return this.possibleMoves.map(move => ({move: move.getMoveString(), score: move.score}));
  }

  getTopMovesAsString(count: number): string {
    return this.topMoves.slice(0, count).map(move => `${move.getFinalStateString()}: ${move.score.toFixed(2)}`).join('\n');
  }

  getAllPossibleMovesAsString(): string {
    // possible moves are already sorted by initial score
    const posMovesStr = this.possibleMoves.map(move => `${move.getMoveString()}: ${move.initialScore.toFixed(2)}`).join(',   ');
    return `Possible moves:\n${posMovesStr}`;
  }

  getAllTopMovesAsString(): string {
    const topMovesStr = this.topMoves.map(move => `${move.getFinalStateString()}: ${move.score.toFixed(2)}`).join(',   ');
    return `Top moves:\n${topMovesStr}`;
  }

  log(msg: string): void {
    this.logs += `${msg}\n`;
  }
}
