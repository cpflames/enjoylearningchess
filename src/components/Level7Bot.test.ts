import { Chess } from 'chess.js';
import { BOT_CONFIGS, botMove } from './ChessBot';
import { MoveEval } from './MoveEval';

describe('Level 7 Bot', () => {
  test('Level 7 bot can make a move', () => {
    const game = new Chess();
    const result = botMove(game, 7);
    
    expect(result.moveString).toBeTruthy();
    expect(result.chatMessage).toBeTruthy();
    expect(result.logsMessage).toBeTruthy();
    
    console.log('Level 7 move:', result.moveString);
    console.log('Chat message:', result.chatMessage);
  });

  test('Level 7 bot has correct configuration', () => {
    const config = BOT_CONFIGS[7];
    
    expect(config.depth).toBe(4);
    expect(config.breadthPerDepth).toEqual([10, 7, 5, 3]);
    expect(config.depthStrategy.strategyName).toBe('Quiescence');
    expect(config.moveGenStrategy.strategyName).toBe('Goal-Based');
    expect(config.evalStrategy.strategyName).toBe('BoardSense Enhanced + Concepts');
  });

  test('Level 7 bot searches deeper than Level 6', () => {
    const level6Config = BOT_CONFIGS[6];
    const level7Config = BOT_CONFIGS[7];
    
    expect(level7Config.depth).toBeGreaterThan(level6Config.depth);
    expect(level7Config.depth).toBe(4);
    expect(level6Config.depth).toBe(3);
  });

  test('Level 7 bot can handle complex positions', () => {
    // Middle game position
    const game = new Chess('r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    const result = botMove(game, 7);
    
    expect(result.moveString).toBeTruthy();
    console.log('Level 7 move in complex position:', result.moveString);
  });

  test('Level 7 bot can handle endgame positions', () => {
    // Endgame position
    const game = new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const result = botMove(game, 7);
    
    expect(result.moveString).toBeTruthy();
    console.log('Level 7 move in endgame:', result.moveString);
  });

  test('Level 7 bot uses goal-based move generation', () => {
    const game = new Chess();
    const botConfig = BOT_CONFIGS[7];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    const allLegalMoves = game.moves();
    
    // Should generate strategic candidates
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(allLegalMoves.length);
    
    console.log(`Level 7 generated ${candidates.length} strategic moves out of ${allLegalMoves.length} legal moves`);
  });
});
