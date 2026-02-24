import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { BotConfig } from './ChessBot';

/**
 * Array of strategic move ideas
 */
const MOVE_IDEAS: MoveIdea[] = [
  // High priority: Tactical moves
  {
    name: 'Capture free piece',
    description: 'Capture opponent pieces that are undefended',
    priority: 100,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.captured !== undefined)
        .map(move => move.san);
    }
  },

  {
    name: 'Recapture',
    description: 'Recapture if a piece was just taken',
    priority: 95,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      const history = game.history({ verbose: true });
      if (history.length === 0) return [];

      const lastMove = history[history.length - 1];
      if (!lastMove.captured) return [];

      // Generate moves that capture on the square where the last capture happened
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.to === lastMove.to && move.captured !== undefined)
        .map(move => move.san);
    }
  },

  {
    name: 'Defend attacked piece',
    description: 'Defend pieces that are under attack',
    priority: 90,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      // For now, return all moves (defending is complex to detect)
      // TODO: Implement proper defense detection using BoardSense
      return [];
    }
  },

  // Opening moves
  {
    name: 'Push center pawn',
    description: 'Push d or e pawn toward center',
    priority: 80,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => {
          const piece = move.piece;
          const from = move.from;
          const to = move.to;

          // Check if it's a pawn move on d or e file
          if (piece !== 'p') return false;
          const file = from[0];
          if (file !== 'd' && file !== 'e') return false;

          // Check if moving toward center (rank 4 or 5)
          const toRank = parseInt(to[1]);
          return toRank === 4 || toRank === 5;
        })
        .map(move => move.san);
    }
  },

  {
    name: 'Develop knight',
    description: 'Develop knights toward center',
    priority: 75,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => {
          if (move.piece !== 'n') return false;

          // Prefer moves to c3, f3, c6, f6 (good knight squares)
          const to = move.to;
          const goodSquares = ['c3', 'f3', 'c6', 'f6', 'd2', 'e2', 'd7', 'e7'];
          return goodSquares.includes(to);
        })
        .map(move => move.san);
    }
  },

  {
    name: 'Develop bishop',
    description: 'Develop bishops to active squares',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.piece === 'b')
        .map(move => move.san);
    }
  },

  {
    name: 'Castle',
    description: 'Castle to protect king',
    priority: 85,
    isRelevant: (context) => context.phase === GamePhase.OPENING || context.phase === GamePhase.MIDDLEGAME,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.flags.includes('k') || move.flags.includes('q'))
        .map(move => move.san);
    }
  },

  // Material-based moves
  {
    name: 'Seek trades',
    description: 'Trade pieces when ahead in material',
    priority: 60,
    isRelevant: (context, color) => {
      const ahead = color === 'w' ? context.materialBalance > 2 : context.materialBalance < -2;
      return ahead;
    },
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      // Moves that capture (potential trades)
      return moves
        .filter(move => move.captured !== undefined)
        .map(move => move.san);
    }
  },

  {
    name: 'Avoid trades',
    description: 'Avoid trading pieces when behind in material',
    priority: 55,
    isRelevant: (context, color) => {
      const behind = color === 'w' ? context.materialBalance < -2 : context.materialBalance > 2;
      return behind;
    },
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      // Moves that don't capture (avoid trades)
      return moves
        .filter(move => move.captured === undefined)
        .map(move => move.san);
    }
  },

  // Endgame moves
  {
    name: 'Activate king',
    description: 'Bring king toward center in endgame',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.ENDGAME,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.piece === 'k')
        .map(move => move.san);
    }
  },

  // Fallback: consider all moves
  {
    name: 'All legal moves',
    description: 'Consider all legal moves as fallback',
    priority: 1,
    isRelevant: () => true,
    generateMoves: (game: Chess, color: Color) => {
      return game.moves();
    }
  }
];

/**
 * Game phase enumeration
 */
export enum GamePhase {
  OPENING = 'opening',
  MIDDLEGAME = 'middlegame',
  ENDGAME = 'endgame'
}

/**
 * Context about the current game state for move idea evaluation
 */
export interface GameContext {
  moveNumber: number;
  materialBalance: number; // positive = white ahead, negative = black ahead
  phase: GamePhase;
}

/**
 * A strategic move idea that can generate candidate moves
 */
export interface MoveIdea {
  name: string;
  description: string;
  priority: number; // higher = more important
  isRelevant: (context: GameContext, color: Color) => boolean;
  generateMoves: (game: Chess, color: Color) => string[];
}

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
          this.materialPoints = {white: -50000, black: 50000};
          return this.materialPoints;
        } else {
          this.materialPoints = {white: 50000, black: -50000};
          return this.materialPoints;
        }
      }
      if (this.game.isStalemate()) {
        this.materialPoints = {white: 0, black: 0};
        return this.materialPoints;
      }
      if (this.game.isDraw()) {
        this.materialPoints = {white: 0, black: 0};
        return this.materialPoints;
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
      // Initialize alpha-beta bounds
      this._minimax(this.botConfig.depth, false, -Infinity, Infinity);
      this.topMoves.sort((a, b) => (a.score > b.score) ? 1 : -1);
      return this.topMoves[0];
    }

  private _minimax(depth: number, isMaximizing: boolean, alpha: number, beta: number, extensionsUsed: number = 0): MoveEval {
      const start = performance.now();
      GLOBAL_EVAL_COUNT++;
      const strategy = this.botConfig.strategy;
      
      // Generate candidate moves - use goal-based system if enabled, otherwise use all legal moves
      const color = this.game.turn();
      const candidateMoves = this.botConfig.useGoalBasedMoves 
        ? this.generateCandidateMoves(color)
        : this.game.moves();
      
      if (depth === 0 || candidateMoves.length === 0) {
        this.finalState = this;
        this.score = strategy.evalFunc(this);
        return this;
      }
      const flip = isMaximizing ? 1 : -1;
      const numMovesToConsider = this.botConfig.breadth;

      this.possibleMoves = candidateMoves.map(move => MoveEval.fromParent(this, move));
      this.possibleMoves.sort((a, b) => (b.initialScore - a.initialScore) * flip);
      // Take up to breadth moves, but don't pad if fewer candidates exist
      this.topMoves = this.possibleMoves.slice(0, Math.min(numMovesToConsider, this.possibleMoves.length));

      const MAX_EXTENSIONS = 10; // Prevent runaway extensions in very tactical positions

      this.score = isMaximizing ? -Infinity : Infinity;
      for (const moveEval of this.topMoves) {
        // Setup
        this.game.move(moveEval.move); // make the move

        // Determine next depth with quiescence extension
        let nextDepth = depth - 1;
        let nextExtensions = extensionsUsed;

        // Quiescence: if this move is a capture and we'd hit depth 0, extend by 1
        if (this.botConfig.quiescence && 
            nextDepth === 0 && 
            this.wasCapture(moveEval.move) && 
            extensionsUsed < MAX_EXTENSIONS) {
          nextDepth = 1;
          nextExtensions = extensionsUsed + 1;
        }

        // Eval
        moveEval._minimax(nextDepth, !isMaximizing, alpha, beta, nextExtensions);

        // Interpret
        const isBetter = isMaximizing ? moveEval.score > this.score : moveEval.score < this.score;
        if (isBetter) {
          this.score = moveEval.score;
          this.finalState = moveEval.finalState;
          this.bestMove = moveEval;
        }

        // Alpha-beta pruning
        if (isMaximizing) {
          alpha = Math.max(alpha, this.score);
        } else {
          beta = Math.min(beta, this.score);
        }

        // Cleanup
        this.game.undo();

        // Prune if we've found a move that's good enough
        if (beta <= alpha) {
          break; // Beta cutoff - remaining moves won't be chosen
        }
      }
      const end = performance.now();
      const duration = end - start;
      this.log(`minimax took ${duration.toFixed(2)}ms`);
      return this.bestMove; // can use the bestMove returned, or call functions on this object.
    }

  /**
   * Checks if the given move was a capture
   * @private
   */
  private wasCapture(move: string): boolean {
    // The move has already been made, so check the last move from history
    const history = this.game.history({ verbose: true });
    if (history.length === 0) return false;
    
    const lastMove = history[history.length - 1];
    return lastMove.captured !== undefined;
  }

  getCurrentEvalAsString(): string {
    return `Current Eval: (initial: ${this.initialScore.toFixed(2)}, best line: ${this.score.toFixed(2)})`;
  }

  getGame(): Chess {
    return this.game;
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

    /**
     * Builds game context for move idea evaluation
     */
    private buildGameContext(): GameContext {
      const moveNumber = Math.floor(this.game.history().length / 2) + 1;
      const materialBalance = this.materialPointsAheadForWhite();

      // Determine phase based on move number and material
      let phase: GamePhase;
      if (moveNumber <= 10) {
        phase = GamePhase.OPENING;
      } else {
        // Check if we're in endgame (queens traded or low material)
        const whiteMaterial = this.materialPoints.white;
        const blackMaterial = this.materialPoints.black;
        const totalMaterial = whiteMaterial + blackMaterial;

        if (totalMaterial < 20) { // Less than ~2 rooks + 2 knights per side
          phase = GamePhase.ENDGAME;
        } else {
          phase = GamePhase.MIDDLEGAME;
        }
      }

      return { moveNumber, materialBalance, phase };
    }

    /**
     * Generates candidate moves based on strategic move ideas
     */
    private generateCandidateMoves(color: Color): string[] {
      const context = this.buildGameContext();
      const candidates = new Set<string>();

      // Filter to relevant ideas and sort by priority
      const relevantIdeas = MOVE_IDEAS
        .filter(idea => idea.isRelevant(context, color))
        .sort((a, b) => b.priority - a.priority);

      // Generate moves from each relevant idea
      for (const idea of relevantIdeas) {
        const moves = idea.generateMoves(this.game, color);
        moves.forEach(move => candidates.add(move));
      }

      // If no candidates generated, fall back to all legal moves
      if (candidates.size === 0) {
        return this.game.moves();
      }

      return Array.from(candidates);
    }
}
