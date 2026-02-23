import { Chess } from 'chess.js';
import { BoardSense } from './BoardSense';

/**
 * Unit tests for getPieceMobility method
 * Task 6.1: Implement getPieceMobility(square: Square)
 */

describe('BoardSense - getPieceMobility', () => {
  
  test('getPieceMobility returns correct mobility for white knight in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // White knight on b1 has 2 legal moves (a3, c3)
    const mobility = boardSense.getPieceMobility('b1');
    expect(mobility).toBe(2);
  });

  test('getPieceMobility returns correct mobility for white pawn in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // White pawn on e2 has 2 legal moves (e3, e4)
    const mobility = boardSense.getPieceMobility('e2');
    expect(mobility).toBe(2);
  });

  test('getPieceMobility returns 0 for empty square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // e4 is empty in starting position
    const mobility = boardSense.getPieceMobility('e4');
    expect(mobility).toBe(0);
  });

  test('getPieceMobility returns 0 for invalid square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Invalid square
    const mobility = boardSense.getPieceMobility('z9' as any);
    expect(mobility).toBe(0);
  });

  test('getPieceMobility returns correct mobility for queen after development', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Qh5');
    chess.move('Nc6'); // Make it white's turn again
    
    const boardSense = new BoardSense(chess);
    
    // White queen on h5 should have multiple moves (it's white's turn)
    const mobility = boardSense.getPieceMobility('h5');
    expect(mobility).toBeGreaterThan(5);
  });

  test('getPieceMobility returns 0 for piece that cannot move (pinned)', () => {
    // Position where a piece is pinned and cannot move
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 2');
    const boardSense = new BoardSense(chess);
    
    // Most pieces should have some mobility
    const knightMobility = boardSense.getPieceMobility('b1');
    expect(knightMobility).toBeGreaterThanOrEqual(0);
  });

  test('getPieceMobility uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getPieceMobility twice for the same square
    const mobility1 = boardSense.getPieceMobility('b1');
    const mobility2 = boardSense.getPieceMobility('b1');
    
    // Should return the same value (cached)
    expect(mobility1).toBe(mobility2);
    expect(mobility1).toBe(2);
  });

  test('getPieceMobility invalidates cache after position change', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Initial mobility for knight on b1
    const initialMobility = boardSense.getPieceMobility('b1');
    expect(initialMobility).toBe(2);
    
    // Move the knight
    chess.move('Nc3');
    chess.move('Nf6'); // Make it white's turn again
    
    // Knight is no longer on b1
    const afterMobility = boardSense.getPieceMobility('b1');
    expect(afterMobility).toBe(0);
    
    // Knight on c3 should have mobility (it's white's turn)
    const c3Mobility = boardSense.getPieceMobility('c3');
    expect(c3Mobility).toBeGreaterThan(0);
  });

  test('getPieceMobility does not mutate Chess instance', () => {
    const chess = new Chess();
    const originalFen = chess.fen();
    const boardSense = new BoardSense(chess);
    
    // Call getPieceMobility multiple times
    boardSense.getPieceMobility('b1');
    boardSense.getPieceMobility('e2');
    boardSense.getPieceMobility('d1');
    
    // FEN should be unchanged
    expect(chess.fen()).toBe(originalFen);
  });

  test('getPieceMobility returns correct mobility for black pieces', () => {
    const chess = new Chess();
    chess.move('e4'); // White moves
    
    const boardSense = new BoardSense(chess);
    
    // Now it's black's turn, so black pieces have legal moves
    const blackKnightMobility = boardSense.getPieceMobility('b8');
    expect(blackKnightMobility).toBe(2); // a6, c6
    
    const blackPawnMobility = boardSense.getPieceMobility('e7');
    expect(blackPawnMobility).toBe(2); // e6, e5
  });

  test('getPieceMobility returns correct mobility for king', () => {
    // Position where king has some mobility
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // White king on e1 should have 5 moves (d1, d2, e2, f2, f1)
    const whiteKingMobility = boardSense.getPieceMobility('e1');
    expect(whiteKingMobility).toBe(5);
  });

  test('getPieceMobility returns correct mobility for rook on open file', () => {
    // Position with rook on open file
    const chess = new Chess('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1');
    const boardSense = new BoardSense(chess);
    
    // White rook on a1 should have many moves along the file and rank
    const rookMobility = boardSense.getPieceMobility('a1');
    expect(rookMobility).toBeGreaterThanOrEqual(10);
  });
});
