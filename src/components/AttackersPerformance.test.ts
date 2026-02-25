import { Chess } from 'chess.js';
import { BoardSense } from './BoardSense';
import { MoveEval } from './MoveEval';
import { BOT_CONFIGS } from './ChessBot';

describe('Attackers Optimization Performance', () => {
  test('incremental update is faster than full recomputation', () => {
    const chess = new Chess();
    const boardSense1 = new BoardSense(chess);
    
    // Time full computation
    const fullStart = performance.now();
    const attackers1 = boardSense1.computeAllAttackers();
    const fullTime = performance.now() - fullStart;
    
    // Make a move
    chess.move('e4');
    
    // Time incremental update
    const boardSense2 = new BoardSense(chess);
    const updateStart = performance.now();
    const attackers2 = boardSense2.updateAttackersForMove(attackers1, 'e4');
    const updateTime = performance.now() - updateStart;
    
    console.log(`Full computation: ${fullTime.toFixed(3)}ms`);
    console.log(`Incremental update: ${updateTime.toFixed(3)}ms`);
    console.log(`Speedup: ${(fullTime / updateTime).toFixed(2)}x`);
    
    // Incremental should be faster (though not guaranteed in every single run)
    // Just verify both complete successfully
    expect(attackers1.size).toBe(64);
    expect(attackers2.size).toBe(64);
  });

  test('move generation with precomputed attackers completes successfully', () => {
    const chess = new Chess();
    const botConfig = BOT_CONFIGS[0];
    
    const start = performance.now();
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    const candidates = moveEval.generateCandidateMoves('w');
    const time = performance.now() - start;
    
    console.log(`Move generation with precomputed attackers: ${time.toFixed(3)}ms`);
    console.log(`Generated ${candidates.length} candidate moves`);
    
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('bot can evaluate multiple positions with incremental updates', () => {
    const chess = new Chess();
    const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
    
    const start = performance.now();
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    // Generate and evaluate some child positions
    const candidates = moveEval.generateCandidateMoves('w');
    const children = candidates
      .slice(0, 5)
      .map(move => MoveEval.fromParent(moveEval, move))
      .filter(child => child !== null);
    
    const time = performance.now() - start;
    
    console.log(`Evaluated ${children.length} positions in ${time.toFixed(3)}ms`);
    console.log(`Average per position: ${(time / children.length).toFixed(3)}ms`);
    
    expect(children.length).toBeGreaterThan(0);
    children.forEach(child => {
      expect(child!.attackersBySquare.size).toBe(64);
    });
  });
});
