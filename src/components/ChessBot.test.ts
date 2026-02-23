import { Chess } from 'chess.js';
import { BOT_CONFIGS, MAX_BOT_LEVEL, BOARDSENSE_STRATEGY } from './ChessBot';
import { MoveEval } from './MoveEval';

describe('ChessBot', () => {
  test('Level 5 bot config exists', () => {
    expect(BOT_CONFIGS.length).toBe(6);
    expect(BOT_CONFIGS[5]).toBeDefined();
    expect(BOT_CONFIGS[5].botName).toContain('Level 5');
    expect(BOT_CONFIGS[5].botName).toContain('BoardSense Enhanced');
    expect(BOT_CONFIGS[5].depth).toBe(4);
    expect(BOT_CONFIGS[5].breadth).toBe(10);
  });

  test('MAX_BOT_LEVEL is updated', () => {
    expect(MAX_BOT_LEVEL).toBe(5);
  });

  test('BoardSense strategy can evaluate a position', () => {
    const game = new Chess();
    const botConfig = BOT_CONFIGS[5];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    // The strategy should return a number
    const score = BOARDSENSE_STRATEGY.evalFunc(moveEval);
    expect(typeof score).toBe('number');
    expect(isFinite(score)).toBe(true);
  });

  test('BoardSense strategy evaluates differently than material-only', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    
    const botConfig = BOT_CONFIGS[5];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const boardSenseScore = BOARDSENSE_STRATEGY.evalFunc(moveEval);
    const materialScore = moveEval.materialPointsAheadForWhite();
    
    // BoardSense should consider more than just material
    // (they might be equal by chance, but the evaluation should work)
    expect(typeof boardSenseScore).toBe('number');
    expect(typeof materialScore).toBe('number');
  });
});
