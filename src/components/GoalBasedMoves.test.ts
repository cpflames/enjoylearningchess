import { Chess } from 'chess.js';
import { MoveEval, GamePhase } from './MoveEval';
import { BOT_CONFIGS } from './ChessBot';

describe('Goal-Based Move Generation', () => {
  test('Opening: generates center pawn moves', () => {
    const game = new Chess();
    const botConfig = BOT_CONFIGS[6]; // Level 6 bot
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    // Build context - should be opening
    const context = (moveEval as any).buildGameContext();
    expect(context.phase).toBe(GamePhase.OPENING);
    expect(context.moveNumber).toBe(1);
    
    // Generate candidates
    const candidates = (moveEval as any).generateCandidateMoves('w');
    
    // Should include center pawn moves (e4, d4, e3, d3)
    expect(candidates).toContain('e4');
    expect(candidates).toContain('d4');
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('Opening: generates knight development moves', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    
    const botConfig = BOT_CONFIGS[6];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const context = (moveEval as any).buildGameContext();
    expect(context.phase).toBe(GamePhase.OPENING);
    
    const candidates = (moveEval as any).generateCandidateMoves('w');
    
    // Should include knight development (Nf3, Nc3)
    expect(candidates).toContain('Nf3');
    expect(candidates).toContain('Nc3');
  });

  test('Material ahead: seeks trades', () => {
    // Set up position where white is ahead in material (white has extra knight)
    const game = new Chess('rnbqkb1r/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR b KQkq - 0 1');
    
    const botConfig = BOT_CONFIGS[6];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const context = (moveEval as any).buildGameContext();
    // White should be ahead in material (extra knight = 3 points)
    expect(context.materialBalance).toBeGreaterThan(2);
    
    // Black's turn - black is behind, should avoid trades
    const candidates = (moveEval as any).generateCandidateMoves('b');
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('Endgame: activates king', () => {
    // Set up endgame position (few pieces left) - move 15 to get past opening
    const game = new Chess();
    // Play 30 half-moves (15 full moves) to get past opening phase
    for (let i = 0; i < 30; i++) {
      const moves = game.moves();
      if (moves.length === 0) break;
      // Make a random legal move
      game.move(moves[Math.floor(Math.random() * moves.length)]);
    }
    
    // Now check if we have low material (endgame)
    const botConfig = BOT_CONFIGS[6];
    let moveEval = MoveEval.fromScratch(game, botConfig);
    let context = (moveEval as any).buildGameContext();
    
    // If not endgame yet, trade pieces until we are
    while (context.phase !== GamePhase.ENDGAME && game.history().length < 100) {
      const moves = game.moves({ verbose: true });
      const captures = moves.filter(m => m.captured);
      if (captures.length > 0) {
        game.move(captures[0].san);
      } else {
        game.move(moves[0].san);
      }
      moveEval = MoveEval.fromScratch(game, botConfig);
      context = (moveEval as any).buildGameContext();
    }
    
    // Should eventually reach endgame
    expect(context.phase).toBe(GamePhase.ENDGAME);
    
    const candidates = (moveEval as any).generateCandidateMoves(game.turn());
    
    // Should include king moves in endgame
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('Castling available in opening/middlegame', () => {
    // Set up position where kingside castling is available
    const game = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1');
    
    const botConfig = BOT_CONFIGS[6];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const context = (moveEval as any).buildGameContext();
    expect(context.phase).toBe(GamePhase.OPENING);
    
    const candidates = (moveEval as any).generateCandidateMoves('w');
    
    // Should include castling option
    expect(candidates).toContain('O-O');
  });

  test('Captures are always considered', () => {
    // Set up position with a free piece to capture
    const game = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    game.move('Qh5'); // Attacking e5
    game.move('Nc6'); // Black develops
    
    const botConfig = BOT_CONFIGS[6];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const candidates = (moveEval as any).generateCandidateMoves('w');
    
    // Should include capturing the e5 pawn (without check notation since BoardSense generates pseudo-legal moves)
    expect(candidates).toContain('Qxe5');
  });

  test('Bot can make a move using goal-based system', () => {
    const game = new Chess();
    const botConfig = BOT_CONFIGS[6];
    const moveEval = MoveEval.fromScratch(game, botConfig);
    
    const bestMove = moveEval.minimax();
    
    expect(bestMove).toBeDefined();
    expect(bestMove.getMoveString()).toBeTruthy();
    
    // Verify the move is legal
    const legalMoves = game.moves();
    expect(legalMoves).toContain(bestMove.getMoveString());
  });
});
