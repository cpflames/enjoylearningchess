import { Chess } from 'chess.js';
import type { Color } from 'chess.js';

/**
 * Structural interface describing what ChessConcepts need from a MoveEval.
 * MoveEval satisfies this via TypeScript's structural typing without a direct import.
 */
export interface ConceptMoveEval {
  move: string;
  getPieceType(): string;
  getGame(): Chess;
  nextTurn(): Color;
  materialPointsAheadForWhite(): number;
  wasLastMoveCapture(): boolean;
}

/**
 * A chess concept that adjusts evaluation scores based on strategic principles.
 * Returns a score delta from white's perspective: positive = better for white, negative = better for black.
 * Return 0 when the concept is not applicable.
 */
export interface ChessConcept {
  name: string;
  description: string;
  evaluate(moveEval: ConceptMoveEval): number;
}

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Penalize queen moves in the first 7 full moves (14 plies) of the game.
 * Discourages early queen development, which is a common beginner mistake.
 */
const DONT_BRING_QUEEN_EARLY: ChessConcept = {
  name: 'DontBringQueenEarly',
  description: 'Penalize queen moves in the first 7 full moves',
  evaluate(moveEval: ConceptMoveEval): number {
    if (!moveEval.move) return 0;
    if (moveEval.getPieceType() !== 'q') return 0;
    const moveNumber = Math.floor(moveEval.getGame().history().length / 2) + 1;
    if (moveNumber > 7) return 0;
    const playerWhoMoved = moveEval.nextTurn() === 'w' ? 'b' : 'w';
    return playerWhoMoved === 'w' ? -0.5 : +0.5;
  }
};

/**
 * Penalize equal trades when the trading side is down by 2+ material points.
 * When behind in material, keeping pieces on the board provides more chances to complicate.
 */
const AVOID_TRADES_WHEN_BEHIND: ChessConcept = {
  name: 'AvoidTradesWhenBehind',
  description: 'Penalize equal trades when down by 2+ material points',
  evaluate(moveEval: ConceptMoveEval): number {
    if (!moveEval.wasLastMoveCapture()) return 0;
    const materialAhead = moveEval.materialPointsAheadForWhite();
    if (Math.abs(materialAhead) < 2) return 0;

    const history = moveEval.getGame().history({ verbose: true });
    if (history.length === 0) return 0;
    const lastMove = history[history.length - 1];
    if (!lastMove.captured) return 0;

    const movingPieceValue = PIECE_VALUES[lastMove.piece] ?? 0;
    const capturedPieceValue = PIECE_VALUES[lastMove.captured] ?? 0;
    // Only penalize equal or near-equal trades (within 1 point of material value)
    if (Math.abs(movingPieceValue - capturedPieceValue) > 1) return 0;

    const playerWhoMoved = moveEval.nextTurn() === 'w' ? 'b' : 'w';
    if (playerWhoMoved === 'w' && materialAhead < -2) return -0.7;
    if (playerWhoMoved === 'b' && materialAhead > 2) return +0.7;
    return 0;
  }
};

export const ALL_CONCEPTS: ChessConcept[] = [
  DONT_BRING_QUEEN_EARLY,
  AVOID_TRADES_WHEN_BEHIND,
];

export function evaluateConcepts(moveEval: ConceptMoveEval, concepts: ChessConcept[]): number {
  let total = 0;
  for (const concept of concepts) {
    total += concept.evaluate(moveEval);
  }
  return total;
}
