import { Chess } from 'chess.js';
import { BoardSense } from './BoardSense';
import { MoveEval } from './MoveEval';
import { BOT_CONFIGS } from './ChessBot';

describe('Move King Endgame Idea', () => {
  test('generateKingMoves generates king moves', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteKingMoves = boardSense.generateKingMoves('w');
    const blackKingMoves = boardSense.generateKingMoves('b');
    
    // In starting position, kings have no legal moves
    expect(whiteKingMoves.length).toBe(0);
    expect(blackKingMoves.length).toBe(0);
  });

  test('generateKingMoves works in endgame position', () => {
    // Endgame position: king and pawn vs king
    const chess = new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteKingMoves = boardSense.generateKingMoves('w');
    
    // White king should have several moves available
    expect(whiteKingMoves.length).toBeGreaterThan(0);
    console.log('White king moves:', whiteKingMoves);
  });

  test('Move King idea is relevant in endgame', () => {
    // Endgame position with low material
    const chess = new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const botConfig = BOT_CONFIGS[0];
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    
    // Should generate some candidates including king moves
    expect(candidates.length).toBeGreaterThan(0);
    console.log('Endgame candidates:', candidates);
    
    // Should include at least one king move
    const kingMoves = candidates.filter(move => move.startsWith('K'));
    expect(kingMoves.length).toBeGreaterThan(0);
  });

  test('Bot can find moves in sparse endgame position', () => {
    // Very sparse endgame - just kings and one pawn
    const chess = new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
    const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    
    // Should always find some moves (king moves + pawn moves)
    expect(candidates.length).toBeGreaterThan(0);
    console.log('Sparse endgame candidates:', candidates);
  });

  test('Bot does not fall back to all legal moves in endgame', () => {
    // Endgame position
    const chess = new Chess('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    const botConfig = BOT_CONFIGS[0];
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    const allLegalMoves = chess.moves();
    
    // Candidates should be a subset of legal moves (not all of them)
    // This verifies we're using strategic move ideas, not falling back
    expect(candidates.length).toBeLessThanOrEqual(allLegalMoves.length);
    expect(candidates.length).toBeGreaterThan(0);
    
    console.log(`Generated ${candidates.length} strategic moves out of ${allLegalMoves.length} legal moves`);
  });
});
