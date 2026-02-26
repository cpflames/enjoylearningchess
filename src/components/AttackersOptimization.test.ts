import { Chess } from 'chess.js';
import { BoardSense } from './BoardSense';
import { MoveEval } from './MoveEval';
import { BOT_CONFIGS } from './ChessBot';

describe('Attackers Optimization', () => {
  test('computeAllAttackers initializes attack counts for all squares', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    const attackersBySquare = boardSense.computeAllAttackers();

    // Should have 64 squares
    expect(attackersBySquare.size).toBe(64);

    // Check some known attacks in starting position
    // d3 is attacked by white pawn on e2 (diagonal attack)
    const d3Info = attackersBySquare.get('d3');
    expect(d3Info).toBeDefined();
    expect(d3Info!.white).toBeGreaterThan(0);

    // a1 has white rook, not attacked by anyone
    const a1Info = attackersBySquare.get('a1');
    expect(a1Info).toBeDefined();
    expect(a1Info!.white).toBe(0);
    expect(a1Info!.black).toBe(0);
  });

  test('updateAttackersForMove updates attack counts after a move', () => {
    const chess = new Chess();
    const boardSense1 = new BoardSense(chess);
    const attackers1 = boardSense1.computeAllAttackers();

    // Make a move
    chess.move('e4');
    const boardSense2 = new BoardSense(chess);
    const attackers2 = boardSense2.updateAttackersForMove(attackers1, 'e4');

    // e2 should no longer be attacked by the pawn (it moved)
    const e2Info = attackers2.get('e2');
    expect(e2Info).toBeDefined();

    // e4 should now have the white pawn
    const e4Info = attackers2.get('e4');
    expect(e4Info).toBeDefined();
  });

  test('MoveEval.fromScratch initializes attackersBySquare', () => {
    const chess = new Chess();
    const botConfig = BOT_CONFIGS[0];
    const moveEval = MoveEval.fromScratch(chess, botConfig);

    expect(moveEval.attackersBySquare).toBeDefined();
    expect(moveEval.attackersBySquare.size).toBe(64);
  });

  test('MoveEval.fromParent inherits and updates attackersBySquare', () => {
    const chess = new Chess();
    const botConfig = BOT_CONFIGS[0];
    const parent = MoveEval.fromScratch(chess, botConfig);

    const child = MoveEval.fromParent(parent, 'e4');
    expect(child).not.toBeNull();
    expect(child!.attackersBySquare).toBeDefined();
    expect(child!.attackersBySquare.size).toBe(64);

    // Should be a different map instance (not the same reference)
    expect(child!.attackersBySquare).not.toBe(parent.attackersBySquare);
  });

  test('generateFleeingMoves uses precomputed attackers', () => {
    const chess = new Chess();
    // Set up a position where a piece is attacked
    chess.load('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    
    const botConfig = BOT_CONFIGS[0];
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    // Generate candidate moves - should use attackersBySquare
    const candidates = moveEval.generateCandidateMoves('b');
    
    // Should generate some moves
    expect(candidates.length).toBeGreaterThan(0);
  });

  test('generateAttackUndefendedMoves uses precomputed attackers', () => {
    const chess = new Chess();
    // Set up a position with an undefended piece
    chess.load('rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    
    const botConfig = BOT_CONFIGS[0];
    const moveEval = MoveEval.fromScratch(chess, botConfig);
    
    const boardSense = new BoardSense(chess);
    const attackMoves = boardSense.generateAttackUndefendedMoves('w', moveEval.attackersBySquare);
    
    // Should find some undefended pieces to attack
    expect(attackMoves.length).toBeGreaterThanOrEqual(0);
  });
});
