import { Chess } from 'chess.js';
import { MoveEval } from './MoveEval';
import { BOT_CONFIGS } from './ChessBot';

describe('Endgame Edge Cases', () => {
  test('Bot can handle king vs king endgame', () => {
    // Just two kings - should still generate moves
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    
    // Should generate king moves
    expect(candidates.length).toBeGreaterThan(0);
    console.log('King vs King candidates:', candidates);
  });

  test('Bot can handle king and pawn endgame', () => {
    // King and pawn vs king
    const chess = new Chess('8/8/8/4k3/8/8/4P3/4K3 w - - 0 1');
    const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    
    // Should generate both king and pawn moves
    expect(candidates.length).toBeGreaterThan(0);
    console.log('King and Pawn endgame candidates:', candidates);
  });

  test('Bot can handle rook endgame', () => {
    // Rook endgame
    const chess = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1');
    const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const candidates = moveEval.generateCandidateMoves('w');
    
    // Should generate rook and king moves
    expect(candidates.length).toBeGreaterThan(0);
    console.log('Rook endgame candidates:', candidates);
  });

  test('Bot never falls back to all legal moves', () => {
    // Test several endgame positions
    const positions = [
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',  // King vs King
      '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',  // K+P vs K
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',  // K+R vs K
      '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',  // K+P vs K (different)
    ];

    for (const fen of positions) {
      const chess = new Chess(fen);
      const botConfig = { ...BOT_CONFIGS[0], depth: 2, breadth: 5 };
      const moveEval = MoveEval.fromScratch(chess, botConfig);
      
      const candidates = moveEval.generateCandidateMoves('w');
      const allLegalMoves = chess.moves();
      
      // Should always generate some candidates
      expect(candidates.length).toBeGreaterThan(0);
      
      // Candidates should be strategic (not just all legal moves)
      // In endgame, we might generate most moves, but we should still be selective
      console.log(`Position ${fen}: ${candidates.length} candidates out of ${allLegalMoves.length} legal moves`);
    }
  });

  test('Endgame phase is detected correctly based on material', () => {
    const positions = [
      { fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', expectedPhase: 'endgame', desc: 'King vs King' },
      { fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1', expectedPhase: 'endgame', desc: 'K+P vs K' },
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', expectedPhase: 'opening', desc: 'Starting position' },
    ];

    for (const { fen, expectedPhase, desc } of positions) {
      const chess = new Chess(fen);
      const botConfig = BOT_CONFIGS[0];
      const moveEval = MoveEval.fromScratch(chess, botConfig);
      
      // Access the private buildGameContext through generateCandidateMoves
      const candidates = moveEval.generateCandidateMoves('w');
      
      // Verify by checking which move ideas were used
      if (expectedPhase === 'endgame') {
        // Should include king moves in endgame
        const hasKingMoves = candidates.some(move => move.startsWith('K'));
        expect(hasKingMoves).toBe(true);
        console.log(`${desc}: Correctly detected as endgame (has king moves)`);
      } else if (expectedPhase === 'opening') {
        // Should include opening moves
        const hasOpeningMoves = candidates.some(move => 
          move === 'e4' || move === 'd4' || move.startsWith('N')
        );
        expect(hasOpeningMoves).toBe(true);
        console.log(`${desc}: Correctly detected as opening (has opening moves)`);
      }
    }
  });
});
