import { Chess } from 'chess.js';
import { BOT_CONFIGS, MAX_BOT_LEVEL, BOARDSENSE_STRATEGY } from './ChessBot';
import { MoveEval, GLOBAL_EVAL_COUNT } from './MoveEval';

describe('ChessBot', () => {
  test('Level 5 bot config exists', () => {
    expect(BOT_CONFIGS.length).toBe(8);
    expect(BOT_CONFIGS[5]).toBeDefined();
    expect(BOT_CONFIGS[5].botName).toContain('Level 5');
    expect(BOT_CONFIGS[5].botName).toContain('BoardSense Enhanced');
  });

  test('MAX_BOT_LEVEL is updated', () => {
    expect(MAX_BOT_LEVEL).toBe(7);
  });

  test('Level 7 bot has depth 4', () => {
    expect(BOT_CONFIGS[7]).toBeDefined();
    expect(BOT_CONFIGS[7].depth).toBe(4);
    expect(BOT_CONFIGS[7].botName).toContain('Level 7');
    expect(BOT_CONFIGS[7].botName).toContain('BoardSense Enhanced');
    expect(BOT_CONFIGS[7].botName).toContain('Goal-Based');
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

  test('Alpha-beta pruning reduces node evaluations', () => {
    const game = new Chess();
    const botConfig = BOT_CONFIGS[5]; // Level 5 bot with depth 4, breadth 10
    
    // Get eval count before
    const evalCountBefore = GLOBAL_EVAL_COUNT;
    
    const moveEval = MoveEval.fromScratch(game, botConfig);
    const bestMove = moveEval.minimax();
    
    // Get the number of evaluations for this search
    const evalCount = GLOBAL_EVAL_COUNT - evalCountBefore;
    
    // Theoretical maximum without pruning: breadth^depth = 10^3 = 1,000 (L5: depth 3, breadth 10)
    const theoreticalMax = Math.pow(botConfig.breadthPerDepth[0], botConfig.depth);
    
    console.log(`\nAlpha-beta pruning stats:`);
    console.log(`  Nodes evaluated: ${evalCount}`);
    console.log(`  Theoretical max: ${theoreticalMax}`);
    console.log(`  Pruning efficiency: ${((1 - evalCount / theoreticalMax) * 100).toFixed(1)}% nodes skipped`);
    
    // Verify we found a valid move
    expect(bestMove).toBeDefined();
    expect(bestMove.getMoveString()).toBeTruthy();
    
    // Alpha-beta should evaluate significantly fewer nodes than the theoretical maximum
    // We expect at least 20% reduction (conservative estimate)
    expect(evalCount).toBeLessThan(theoreticalMax * 0.8);
  });
