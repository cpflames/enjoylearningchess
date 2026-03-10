/**
 * Tests for sacrifice detection: the bot should not sacrifice material
 * with losing captures (e.g., knight takes defended pawn).
 *
 * Regression: After 1. e4 e5 2. Nf3 Nf6 3. Nc3 Bb4 4. Bc4 Nc6 5. d3,
 * the Level 7 bot was playing Nxe4 (knight takes defended e4 pawn).
 * The fix: SEE (Static Exchange Evaluation) adjustment in MoveEval.fromParent
 * penalizes losing captures in move ordering so they don't crowd out good moves
 * within the breadth limit.
 */

import {
  expectBotNotToPlay,
  expectMoveClassifiedAs,
} from './chessBotTestHelpers';
import { Chess } from 'chess.js';
import { BOT_CONFIGS, botMove } from './ChessBot';
import { MoveEval } from './MoveEval';
import { BoardSense } from './BoardSense';

// Position after 1. e4 e5 2. Nf3 Nf6 3. Nc3 Bb4 4. Bc4 Nc6 5. d3 — Black to move
const POSITION_AFTER_D3 = 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5';

// Position after 5...Nxe4 — White to move
const POSITION_AFTER_NXE4 = 'r1bqk2r/pppp1ppp/2n5/4p3/1bB1n3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6';

describe('Sacrifice Detection', () => {
  test('Nxe4 is classified as a losing capture (not unguarded or winning)', () => {
    const classified = expectMoveClassifiedAs(POSITION_AFTER_D3, 'b', 'Nxe4', 'losing');
    expect(classified.unguarded).not.toContain('Nxe4');
    expect(classified.winning).not.toContain('Nxe4');
  });

  test('After Nxe4, dxe4 is a high-priority (unguarded or winning) capture for White', () => {
    const game = new Chess(POSITION_AFTER_NXE4);
    const botConfig = BOT_CONFIGS[7];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    const boardSense = new BoardSense(game);

    const classified = boardSense.generateCapturesClassified('w', moveEval.attackersBySquare);
    const dxe4IsHighPriority =
      classified.unguarded.includes('dxe4') || classified.winning.includes('dxe4');
    expect(dxe4IsHighPriority).toBe(true);
  });

  test('After Nxe4, White candidate moves include dxe4', () => {
    const game = new Chess(POSITION_AFTER_NXE4);
    const botConfig = BOT_CONFIGS[7];
    const moveEval = MoveEval.fromScratch(game, botConfig);

    const candidates = moveEval.generateCandidateMoves('w');
    expect(candidates).toContain('dxe4');
  });

  test('Level 7 bot does not play Nxe4 after 1.e4 e5 2.Nf3 Nf6 3.Nc3 Bb4 4.Bc4 Nc6 5.d3', () => {
    const diag = expectBotNotToPlay(POSITION_AFTER_D3, 7, 'Nxe4');
    console.log('Bot chose:', diag.chosenMove, '-', diag.chosenMoveReason);
    // Nxe4 should have a penalised initialScore (SEE adjustment), pushing it down the candidate list
    const nxe4 = diag.candidates.find(c => c.move === 'Nxe4');
    if (nxe4) {
      console.log('Nxe4 initialScore:', nxe4.initialScore, '(searched:', nxe4.finalScore !== undefined, ')');
    }
  });
});
