/**
 * Test helpers for chess bot diagnosis and regression testing.
 *
 * Usage:
 *   import { expectBotNotToPlay, expectMoveClassifiedAs, explainBotMove } from './chessBotTestHelpers';
 *
 *   // Regression: bot should not sacrifice knight
 *   const diag = expectBotNotToPlay(FEN, 7, 'Nxe4');
 *   // Inspect what it did choose:
 *   console.log(diag.chosenMove, diag.candidates);
 *
 *   // Classification check:
 *   expectMoveClassifiedAs(FEN, 'b', 'Nxe4', 'losing');
 */

import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { BOT_CONFIGS, botMove, BotDiagnostics } from './ChessBot';
import { MoveEval } from './MoveEval';
import { BoardSense } from './BoardSense';

/**
 * Runs the bot on a FEN position and returns full diagnostics without any assertion.
 * Use this to explore what the bot considers in a position.
 */
export function explainBotMove(fen: string, level: number): BotDiagnostics {
  const game = new Chess(fen);
  const result = botMove(game, level);
  if (!result.diagnostics) throw new Error('No diagnostics returned — position may have no legal moves.');
  return result.diagnostics;
}

/**
 * Asserts that the bot does NOT play the given move, then returns diagnostics for further inspection.
 *
 * Example:
 *   const diag = expectBotNotToPlay(FEN, 7, 'Nxe4');
 *   expect(diag.candidates.find(c => c.move === 'Nxe4')?.initialScore).toBeLessThan(0);
 */
export function expectBotNotToPlay(fen: string, level: number, move: string): BotDiagnostics {
  const game = new Chess(fen);
  const result = botMove(game, level);
  expect(result.moveString).not.toBe(move);
  if (!result.diagnostics) throw new Error('No diagnostics returned.');
  return result.diagnostics;
}

/**
 * Asserts that the bot DOES play the given move, then returns diagnostics for further inspection.
 *
 * Example:
 *   const diag = expectBotToPlay(FEN, 7, 'd5');
 *   expect(diag.chosenMoveReason).toContain('center');
 */
export function expectBotToPlay(fen: string, level: number, move: string): BotDiagnostics {
  const game = new Chess(fen);
  const result = botMove(game, level);
  expect(result.moveString).toBe(move);
  if (!result.diagnostics) throw new Error('No diagnostics returned.');
  return result.diagnostics;
}

/**
 * Asserts that a move is classified into the given category (unguarded/winning/equal/losing).
 * Returns the full classification for further assertions.
 *
 * Example:
 *   const classified = expectMoveClassifiedAs(FEN, 'b', 'Nxe4', 'losing');
 *   expect(classified.unguarded).not.toContain('Nxe4');
 */
export function expectMoveClassifiedAs(
  fen: string,
  color: Color,
  move: string,
  category: 'unguarded' | 'winning' | 'equal' | 'losing'
): { unguarded: string[]; winning: string[]; equal: string[]; losing: string[] } {
  const game = new Chess(fen);
  const botConfig = BOT_CONFIGS[7]; // Level 7 for most accurate attacker analysis
  const moveEval = MoveEval.fromScratch(game, botConfig);
  const boardSense = new BoardSense(game);
  const classified = boardSense.generateCapturesClassified(color, moveEval.attackersBySquare);
  expect(classified[category]).toContain(move);
  return classified;
}
