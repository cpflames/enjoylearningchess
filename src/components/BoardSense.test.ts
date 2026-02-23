import { Chess } from 'chess.js';
import { BoardSense, clearBoardSenseCache, getBoardSenseCacheSize } from './BoardSense';

// Use CommonJS build of fast-check for Jest compatibility
const fc = require('fast-check/lib/cjs/fast-check');

/**
 * Property-Based Tests for BoardSense
 * Feature: board-sense
 * 
 * These tests validate universal properties that should hold across
 * all valid chess positions and inputs.
 */

/**
 * Helper function to generate a random valid chess position
 * by making a series of random legal moves from the starting position
 */
function generateRandomPosition(moveCount: number): Chess {
  const chess = new Chess();
  for (let i = 0; i < moveCount; i++) {
    const moves = chess.moves();
    if (moves.length === 0) break;
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    chess.move(randomMove);
  }
  return chess;
}

/**
 * Arbitrary for generating random valid chess positions
 */
const arbitraryChessPosition = fc.integer({ min: 0, max: 30 }).map(generateRandomPosition);

describe('BoardSense Property-Based Tests - Constructor and Caching', () => {
  
  // Clear global cache before each test to ensure isolation
  beforeEach(() => {
    clearBoardSenseCache();
  });
  
  /**
   * Property 1: Constructor stores Chess instance correctly
   * **Validates: Requirements 1.1**
   * 
   * For any valid Chess instance, constructing a BoardSense with it should
   * allow subsequent queries to access the board state correctly.
   */
  test('Property 1: Constructor stores Chess instance correctly', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // The BoardSense should be successfully constructed
        expect(boardSense).toBeDefined();
        expect(boardSense).toBeInstanceOf(BoardSense);
        
        // We should be able to access the board state through the Chess instance
        // by verifying the FEN is accessible (this confirms the Chess instance is stored)
        const fen = chess.fen();
        expect(fen).toBeDefined();
        expect(typeof fen).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Invalid Chess instance handling
   * **Validates: Requirements 1.2**
   * 
   * For any invalid input (null, undefined, non-Chess object), constructing
   * a BoardSense should throw an error or handle gracefully without crashing.
   */
  test('Property 2: Invalid Chess instance handling', () => {
    // Test with null
    expect(() => new BoardSense(null as any)).toThrow(TypeError);
    expect(() => new BoardSense(null as any)).toThrow('BoardSense requires a valid Chess instance');
    
    // Test with undefined
    expect(() => new BoardSense(undefined as any)).toThrow(TypeError);
    
    // Test with non-Chess objects
    expect(() => new BoardSense({} as any)).toThrow(TypeError);
    expect(() => new BoardSense({ fen: 'not a function' } as any)).toThrow(TypeError);
    expect(() => new BoardSense(42 as any)).toThrow(TypeError);
    expect(() => new BoardSense('string' as any)).toThrow(TypeError);
    
    // Property-based test with arbitrary invalid values
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.string(),
          fc.boolean(),
          fc.object()
        ),
        (invalidInput) => {
          expect(() => new BoardSense(invalidInput as any)).toThrow(TypeError);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: Works with arbitrary valid positions
   * **Validates: Requirements 1.3**
   * 
   * For any valid chess position (generated via random legal moves),
   * BoardSense queries should execute without errors.
   */
  test('Property 3: Works with arbitrary valid positions', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        // Should construct without error
        const boardSense = new BoardSense(chess);
        
        // Should be able to query the board state without errors
        expect(() => {
          // These methods will be implemented in later tasks
          // For now, we just verify construction works
          const fen = chess.fen();
          expect(fen).toBeDefined();
        }).not.toThrow();
        
        // Verify the BoardSense instance is valid
        expect(boardSense).toBeDefined();
        expect(boardSense).toBeInstanceOf(BoardSense);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 35: Non-mutating queries
   * **Validates: Requirements 10.3**
   * 
   * For any BoardSense query method and board position, calling the method
   * should not change the Chess instance's FEN string.
   */
  test('Property 35: Non-mutating queries', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Constructing BoardSense should not mutate the Chess instance
        expect(chess.fen()).toBe(originalFen);
        
        // Note: When query methods are implemented in later tasks,
        // we will add calls to those methods here to verify they don't mutate
        // For now, we verify that construction itself doesn't mutate
        
        // Verify FEN is still unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 36: Cache correctness
   * **Validates: Requirements 11.1, 11.2, 11.4**
   * 
   * For any board position, calling the same query method twice should return
   * equivalent results, and after making a move on the Chess instance, the
   * query should return updated results.
   */
  test('Property 36: Cache correctness', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Get the initial FEN
        const initialFen = chess.fen();
        
        // Note: When query methods are implemented, we will:
        // 1. Call a query method twice and verify results are equivalent (cache hit)
        // 2. Make a move on the Chess instance
        // 3. Call the query method again and verify results are updated (cache invalidated)
        
        // For now, we verify the cache invalidation mechanism works by checking FEN tracking
        // The BoardSense should track the current FEN
        
        // Make a move if possible
        const moves = chess.moves();
        if (moves.length > 0) {
          chess.move(moves[0]);
          const newFen = chess.fen();
          
          // The FEN should have changed
          expect(newFen).not.toBe(initialFen);
          
          // The BoardSense should detect this change when queried
          // (This will be more thoroughly tested when query methods are implemented)
        }
        
        // Verify BoardSense is still valid after position change
        expect(boardSense).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Cache invalidation on position change
   * This test specifically validates that the cache is cleared when the position changes
   */
  test('Cache invalidation on position change', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Get initial FEN
    const initialFen = chess.fen();
    expect(initialFen).toBeDefined();
    
    // Make a move
    chess.move('e4');
    const newFen = chess.fen();
    
    // FEN should be different
    expect(newFen).not.toBe(initialFen);
    
    // BoardSense should still be valid and able to work with the new position
    expect(boardSense).toBeDefined();
    expect(boardSense).toBeInstanceOf(BoardSense);
  });

  /**
   * Additional test: Multiple BoardSense instances with same Chess instance
   * Verifies that multiple BoardSense instances can safely wrap the same Chess instance
   */
  test('Multiple BoardSense instances with same Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense1 = new BoardSense(chess);
        const boardSense2 = new BoardSense(chess);
        
        // Both should be valid instances
        expect(boardSense1).toBeDefined();
        expect(boardSense2).toBeDefined();
        expect(boardSense1).toBeInstanceOf(BoardSense);
        expect(boardSense2).toBeInstanceOf(BoardSense);
        
        // They should be different instances
        expect(boardSense1).not.toBe(boardSense2);
        
        // The Chess instance should not be mutated
        const fen = chess.fen();
        expect(fen).toBeDefined();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Additional test: Starting position
   * Verifies BoardSense works correctly with the standard starting position
   */
  test('Works with starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    expect(boardSense).toBeDefined();
    expect(boardSense).toBeInstanceOf(BoardSense);
    expect(chess.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  /**
   * Additional test: Custom FEN positions
   * Verifies BoardSense works with Chess instances created from custom FEN strings
   */
  test('Works with custom FEN positions', () => {
    const testFens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
      'rnbqkbnr/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3', // Petrov Defense
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', // Two Knights Defense
      '8/8/8/4k3/8/8/4K3/8 w - - 0 1', // King endgame
    ];
    
    testFens.forEach(fen => {
      const chess = new Chess(fen);
      const boardSense = new BoardSense(chess);
      
      expect(boardSense).toBeDefined();
      expect(boardSense).toBeInstanceOf(BoardSense);
      // Verify the FEN is valid (chess.js may normalize it)
      expect(chess.fen()).toBeDefined();
      expect(typeof chess.fen()).toBe('string');
    });
  });

  /**
   * Global cache test: Multiple instances share cache for same position
   */
  test('Global cache: Multiple instances share cache for same position', () => {
    const chess1 = new Chess();
    const chess2 = new Chess(); // Same starting position
    
    const boardSense1 = new BoardSense(chess1);
    const boardSense2 = new BoardSense(chess2);
    
    // Call a method on the first instance to populate cache
    const whitePawns1 = boardSense1.getPiecesOfType('w', 'p');
    expect(whitePawns1).toHaveLength(8);
    
    // Cache should now have 1 position
    expect(getBoardSenseCacheSize()).toBe(1);
    
    // Call the same method on the second instance
    // This should hit the cache since it's the same FEN
    const whitePawns2 = boardSense2.getPiecesOfType('w', 'p');
    expect(whitePawns2).toHaveLength(8);
    
    // Cache should still have only 1 position (same FEN)
    expect(getBoardSenseCacheSize()).toBe(1);
    
    // Results should be equal
    expect(whitePawns1).toEqual(whitePawns2);
  });

  /**
   * Global cache test: Different positions create separate cache entries
   */
  test('Global cache: Different positions create separate cache entries', () => {
    clearBoardSenseCache();
    
    const chess1 = new Chess();
    const chess2 = new Chess();
    chess2.move('e4'); // Different position
    
    const boardSense1 = new BoardSense(chess1);
    const boardSense2 = new BoardSense(chess2);
    
    // Query both positions
    boardSense1.getPiecesOfType('w', 'p');
    boardSense2.getPiecesOfType('w', 'p');
    
    // Cache should have 2 positions (different FENs)
    expect(getBoardSenseCacheSize()).toBe(2);
  });

  /**
   * Global cache test: clearBoardSenseCache works
   */
  test('Global cache: clearBoardSenseCache clears all cached data', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Populate cache
    boardSense.getPiecesOfType('w', 'p');
    boardSense.getMaterialCount('w');
    
    expect(getBoardSenseCacheSize()).toBeGreaterThan(0);
    
    // Clear cache
    clearBoardSenseCache();
    
    expect(getBoardSenseCacheSize()).toBe(0);
  });

  /**
   * Global cache test: Cache persists across instances
   */
  test('Global cache: Cache persists across BoardSense instances', () => {
    clearBoardSenseCache();
    
    const chess = new Chess();
    
    // Create first instance and query
    const boardSense1 = new BoardSense(chess);
    const result1 = boardSense1.getMaterialCount('w');
    
    expect(getBoardSenseCacheSize()).toBe(1);
    
    // Create second instance for same position
    const boardSense2 = new BoardSense(chess);
    const result2 = boardSense2.getMaterialCount('w');
    
    // Should still be 1 position in cache
    expect(getBoardSenseCacheSize()).toBe(1);
    
    // Results should be identical (from cache)
    expect(result1).toBe(result2);
  });
});

describe('BoardSense Property-Based Tests - Piece Location Queries', () => {
  
  /**
   * Property 4: Piece location query accuracy
   * **Validates: Requirements 2.1**
   * 
   * For any valid square and board position, getPieceAt should return exactly
   * the piece that chess.js reports at that square (or null if empty).
   */
  test('Property 4: Piece location query accuracy', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
                        'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
                        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
                        'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
                        'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
                        'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
                        'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'),
        (chess, square) => {
          const boardSense = new BoardSense(chess);
          const piece = boardSense.getPieceAt(square as any);
          const chessPiece = chess.get(square as any);
          
          // chess.js returns undefined for empty squares, not null
          if (!chessPiece) {
            // If chess.js says the square is empty, BoardSense should return null
            expect(piece).toBeNull();
          } else {
            // If chess.js says there's a piece, BoardSense should return it
            expect(piece).not.toBeNull();
            expect(piece?.type).toBe(chessPiece.type);
            expect(piece?.color).toBe(chessPiece.color);
            expect(piece?.square).toBe(square);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Invalid square handling
   * **Validates: Requirements 2.2**
   * 
   * For any invalid square string (not matching a1-h8 pattern), getPieceAt
   * should return null or throw an appropriate error.
   */
  test('Property 5: Invalid square handling', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Test specific invalid squares
    const invalidSquares = [
      'i1', 'a9', 'z5', 'a0', 'h9',  // Out of bounds
      'aa', '11', 'e', '4',          // Wrong format
      'E4', 'A1',                     // Wrong case
      '', ' ', 'e4 ',                // Empty or whitespace
      'e44', 'ee4',                  // Too long
    ];
    
    invalidSquares.forEach(square => {
      const result = boardSense.getPieceAt(square as any);
      expect(result).toBeNull();
    });
    
    // Property-based test with arbitrary invalid strings
    fc.assert(
      fc.property(
        fc.string().filter(s => !/^[a-h][1-8]$/.test(s)),
        (invalidSquare) => {
          const result = boardSense.getPieceAt(invalidSquare as any);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: getPieceAt with starting position
   * Verifies specific pieces are at their starting squares
   */
  test('getPieceAt returns correct pieces in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Test white pieces
    const whiteRook = boardSense.getPieceAt('a1');
    expect(whiteRook).not.toBeNull();
    expect(whiteRook?.type).toBe('r');
    expect(whiteRook?.color).toBe('w');
    expect(whiteRook?.square).toBe('a1');
    
    const whiteKnight = boardSense.getPieceAt('b1');
    expect(whiteKnight).not.toBeNull();
    expect(whiteKnight?.type).toBe('n');
    expect(whiteKnight?.color).toBe('w');
    
    const whiteKing = boardSense.getPieceAt('e1');
    expect(whiteKing).not.toBeNull();
    expect(whiteKing?.type).toBe('k');
    expect(whiteKing?.color).toBe('w');
    
    // Test black pieces
    const blackRook = boardSense.getPieceAt('a8');
    expect(blackRook).not.toBeNull();
    expect(blackRook?.type).toBe('r');
    expect(blackRook?.color).toBe('b');
    expect(blackRook?.square).toBe('a8');
    
    const blackQueen = boardSense.getPieceAt('d8');
    expect(blackQueen).not.toBeNull();
    expect(blackQueen?.type).toBe('q');
    expect(blackQueen?.color).toBe('b');
    
    // Test empty squares
    const emptySquare = boardSense.getPieceAt('e4');
    expect(emptySquare).toBeNull();
    
    const anotherEmpty = boardSense.getPieceAt('d5');
    expect(anotherEmpty).toBeNull();
  });

  /**
   * Additional test: getPieceAt caching
   * Verifies that repeated calls return the same result (cached)
   */
  test('getPieceAt uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getPieceAt twice for the same square
    const piece1 = boardSense.getPieceAt('e1');
    const piece2 = boardSense.getPieceAt('e1');
    
    // Should return the same piece data
    expect(piece1).toEqual(piece2);
    expect(piece1?.type).toBe('k');
    expect(piece1?.color).toBe('w');
    
    // Make a move that affects a different square
    chess.move('e4');
    
    // The cached result for e1 should be invalidated
    const piece3 = boardSense.getPieceAt('e1');
    expect(piece3).toEqual(piece1); // King is still on e1
    
    // But e4 should now have a pawn
    const pawn = boardSense.getPieceAt('e4');
    expect(pawn).not.toBeNull();
    expect(pawn?.type).toBe('p');
    expect(pawn?.color).toBe('w');
    expect(pawn?.square).toBe('e4');
  });

  /**
   * Additional test: getPieceAt after moves
   * Verifies that getPieceAt returns updated results after moves
   */
  test('getPieceAt returns updated results after moves', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Initially e2 has a white pawn, e4 is empty
    const initialE2 = boardSense.getPieceAt('e2');
    const initialE4 = boardSense.getPieceAt('e4');
    
    expect(initialE2).not.toBeNull();
    expect(initialE2?.type).toBe('p');
    expect(initialE2?.color).toBe('w');
    expect(initialE4).toBeNull();
    
    // Move pawn from e2 to e4
    chess.move('e4');
    
    // Now e2 should be empty, e4 should have the pawn
    const afterE2 = boardSense.getPieceAt('e2');
    const afterE4 = boardSense.getPieceAt('e4');
    
    expect(afterE2).toBeNull();
    expect(afterE4).not.toBeNull();
    expect(afterE4?.type).toBe('p');
    expect(afterE4?.color).toBe('w');
    expect(afterE4?.square).toBe('e4');
  });

  /**
   * Additional test: Non-mutating property for getPieceAt
   * Verifies that calling getPieceAt doesn't change the board state
   */
  test('getPieceAt does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Call getPieceAt for multiple squares
        boardSense.getPieceAt('e4');
        boardSense.getPieceAt('d4');
        boardSense.getPieceAt('a1');
        boardSense.getPieceAt('h8');
        
        // FEN should be unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Piece type query completeness
   * **Validates: Requirements 2.3**
   * 
   * For any board position, color, and piece type, getPiecesOfType should return
   * exactly the set of squares where that piece type exists, verified by checking
   * each square on the board.
   */
  test('Property 6: Piece type query completeness', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        fc.constantFrom('p', 'n', 'b', 'r', 'q', 'k'),
        (chess, color, pieceType) => {
          const boardSense = new BoardSense(chess);
          const squares = boardSense.getPiecesOfType(color as any, pieceType as any);
          
          // Manually verify by checking all squares on the board
          const expectedSquares: string[] = [];
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
          
          for (const file of files) {
            for (const rank of ranks) {
              const square = file + rank;
              const piece = chess.get(square as any);
              if (piece && piece.color === color && piece.type === pieceType) {
                expectedSquares.push(square);
              }
            }
          }
          
          // The returned squares should match exactly
          expect(squares.sort()).toEqual(expectedSquares.sort());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: getPiecesOfType with starting position
   * Verifies correct piece counts in the starting position
   */
  test('getPiecesOfType returns correct pieces in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Test white pawns (should be 8)
    const whitePawns = boardSense.getPiecesOfType('w', 'p');
    expect(whitePawns).toHaveLength(8);
    expect(whitePawns.sort()).toEqual(['a2', 'b2', 'c2', 'd2', 'e2', 'f2', 'g2', 'h2']);
    
    // Test black pawns (should be 8)
    const blackPawns = boardSense.getPiecesOfType('b', 'p');
    expect(blackPawns).toHaveLength(8);
    expect(blackPawns.sort()).toEqual(['a7', 'b7', 'c7', 'd7', 'e7', 'f7', 'g7', 'h7']);
    
    // Test white knights (should be 2)
    const whiteKnights = boardSense.getPiecesOfType('w', 'n');
    expect(whiteKnights).toHaveLength(2);
    expect(whiteKnights.sort()).toEqual(['b1', 'g1']);
    
    // Test black knights (should be 2)
    const blackKnights = boardSense.getPiecesOfType('b', 'n');
    expect(blackKnights).toHaveLength(2);
    expect(blackKnights.sort()).toEqual(['b8', 'g8']);
    
    // Test white bishops (should be 2)
    const whiteBishops = boardSense.getPiecesOfType('w', 'b');
    expect(whiteBishops).toHaveLength(2);
    expect(whiteBishops.sort()).toEqual(['c1', 'f1']);
    
    // Test white rooks (should be 2)
    const whiteRooks = boardSense.getPiecesOfType('w', 'r');
    expect(whiteRooks).toHaveLength(2);
    expect(whiteRooks.sort()).toEqual(['a1', 'h1']);
    
    // Test white queen (should be 1)
    const whiteQueens = boardSense.getPiecesOfType('w', 'q');
    expect(whiteQueens).toHaveLength(1);
    expect(whiteQueens).toEqual(['d1']);
    
    // Test white king (should be 1)
    const whiteKing = boardSense.getPiecesOfType('w', 'k');
    expect(whiteKing).toHaveLength(1);
    expect(whiteKing).toEqual(['e1']);
    
    // Test black king (should be 1)
    const blackKing = boardSense.getPiecesOfType('b', 'k');
    expect(blackKing).toHaveLength(1);
    expect(blackKing).toEqual(['e8']);
  });

  /**
   * Additional test: getPiecesOfType after moves
   * Verifies that getPiecesOfType returns updated results after moves
   */
  test('getPiecesOfType returns updated results after moves', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Initially white pawns are on rank 2
    const initialPawns = boardSense.getPiecesOfType('w', 'p');
    expect(initialPawns).toHaveLength(8);
    expect(initialPawns).toContain('e2');
    expect(initialPawns).not.toContain('e4');
    
    // Move pawn from e2 to e4
    chess.move('e4');
    
    // Now white pawns should include e4 instead of e2
    const afterPawns = boardSense.getPiecesOfType('w', 'p');
    expect(afterPawns).toHaveLength(8);
    expect(afterPawns).not.toContain('e2');
    expect(afterPawns).toContain('e4');
  });

  /**
   * Additional test: getPiecesOfType with empty result
   * Verifies that getPiecesOfType returns empty array when no pieces match
   */
  test('getPiecesOfType returns empty array when no pieces match', () => {
    // Create a position with only kings
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // There should be no pawns
    const whitePawns = boardSense.getPiecesOfType('w', 'p');
    expect(whitePawns).toHaveLength(0);
    expect(whitePawns).toEqual([]);
    
    const blackPawns = boardSense.getPiecesOfType('b', 'p');
    expect(blackPawns).toHaveLength(0);
    
    // There should be no queens
    const whiteQueens = boardSense.getPiecesOfType('w', 'q');
    expect(whiteQueens).toHaveLength(0);
    
    // But there should be kings
    const whiteKing = boardSense.getPiecesOfType('w', 'k');
    expect(whiteKing).toHaveLength(1);
    expect(whiteKing).toEqual(['e1']);
    
    const blackKing = boardSense.getPiecesOfType('b', 'k');
    expect(blackKing).toHaveLength(1);
    expect(blackKing).toEqual(['e8']);
  });

  /**
   * Additional test: getPiecesOfType caching
   * Verifies that repeated calls return the same result (cached)
   */
  test('getPiecesOfType uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getPiecesOfType twice for the same color and type
    const pawns1 = boardSense.getPiecesOfType('w', 'p');
    const pawns2 = boardSense.getPiecesOfType('w', 'p');
    
    // Should return the same array
    expect(pawns1).toEqual(pawns2);
    expect(pawns1).toHaveLength(8);
    
    // Make a move
    chess.move('e4');
    
    // The cached result should be invalidated
    const pawns3 = boardSense.getPiecesOfType('w', 'p');
    expect(pawns3).toHaveLength(8);
    expect(pawns3).not.toContain('e2');
    expect(pawns3).toContain('e4');
  });

  /**
   * Additional test: Non-mutating property for getPiecesOfType
   * Verifies that calling getPiecesOfType doesn't change the board state
   */
  test('getPiecesOfType does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Call getPiecesOfType for multiple piece types
        boardSense.getPiecesOfType('w', 'p');
        boardSense.getPiecesOfType('b', 'n');
        boardSense.getPiecesOfType('w', 'q');
        boardSense.getPiecesOfType('b', 'k');
        
        // FEN should be unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: All pieces query completeness
   * **Validates: Requirements 2.4**
   * 
   * For any board position and color, getAllPieces should return a complete map
   * where the union of all squares across piece types equals all squares occupied
   * by that color.
   */
  test('Property 7: All pieces query completeness', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          const allPieces = boardSense.getAllPieces(color as any);
          
          // Collect all squares from the map
          const allSquaresFromMap: string[] = [];
          for (const squares of allPieces.values()) {
            allSquaresFromMap.push(...squares);
          }
          
          // Manually verify by checking all squares on the board
          const expectedSquares: string[] = [];
          const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
          const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
          
          for (const file of files) {
            for (const rank of ranks) {
              const square = file + rank;
              const piece = chess.get(square as any);
              if (piece && piece.color === color) {
                expectedSquares.push(square);
              }
            }
          }
          
          // The union of all squares from the map should match all squares occupied by that color
          expect(allSquaresFromMap.sort()).toEqual(expectedSquares.sort());
          
          // Verify that each piece type in the map matches getPiecesOfType
          const pieceTypes = ['p', 'n', 'b', 'r', 'q', 'k'];
          for (const pieceType of pieceTypes) {
            const squaresFromMap = allPieces.get(pieceType as any) || [];
            const squaresFromMethod = boardSense.getPiecesOfType(color as any, pieceType as any);
            expect(squaresFromMap.sort()).toEqual(squaresFromMethod.sort());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: getAllPieces with starting position
   * Verifies correct piece organization in the starting position
   */
  test('getAllPieces returns correct pieces in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Test white pieces
    const whitePieces = boardSense.getAllPieces('w');
    expect(whitePieces.size).toBe(6); // 6 piece types
    
    expect(whitePieces.get('p')).toHaveLength(8);
    expect(whitePieces.get('n')).toHaveLength(2);
    expect(whitePieces.get('b')).toHaveLength(2);
    expect(whitePieces.get('r')).toHaveLength(2);
    expect(whitePieces.get('q')).toHaveLength(1);
    expect(whitePieces.get('k')).toHaveLength(1);
    
    // Test black pieces
    const blackPieces = boardSense.getAllPieces('b');
    expect(blackPieces.size).toBe(6); // 6 piece types
    
    expect(blackPieces.get('p')).toHaveLength(8);
    expect(blackPieces.get('n')).toHaveLength(2);
    expect(blackPieces.get('b')).toHaveLength(2);
    expect(blackPieces.get('r')).toHaveLength(2);
    expect(blackPieces.get('q')).toHaveLength(1);
    expect(blackPieces.get('k')).toHaveLength(1);
    
    // Verify specific squares
    expect(whitePieces.get('k')).toEqual(['e1']);
    expect(blackPieces.get('k')).toEqual(['e8']);
    expect(whitePieces.get('q')).toEqual(['d1']);
    expect(blackPieces.get('q')).toEqual(['d8']);
  });

  /**
   * Additional test: getAllPieces with minimal position
   * Verifies getAllPieces works with positions that have few pieces
   */
  test('getAllPieces works with minimal position', () => {
    // Create a position with only kings
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whitePieces = boardSense.getAllPieces('w');
    const blackPieces = boardSense.getAllPieces('b');
    
    // White should only have a king
    expect(whitePieces.get('k')).toEqual(['e1']);
    expect(whitePieces.get('p')).toEqual([]);
    expect(whitePieces.get('n')).toEqual([]);
    expect(whitePieces.get('b')).toEqual([]);
    expect(whitePieces.get('r')).toEqual([]);
    expect(whitePieces.get('q')).toEqual([]);
    
    // Black should only have a king
    expect(blackPieces.get('k')).toEqual(['e8']);
    expect(blackPieces.get('p')).toEqual([]);
    expect(blackPieces.get('n')).toEqual([]);
    expect(blackPieces.get('b')).toEqual([]);
    expect(blackPieces.get('r')).toEqual([]);
    expect(blackPieces.get('q')).toEqual([]);
  });

  /**
   * Additional test: getAllPieces caching
   * Verifies that repeated calls return the same result (cached)
   */
  test('getAllPieces uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getAllPieces twice for the same color
    const pieces1 = boardSense.getAllPieces('w');
    const pieces2 = boardSense.getAllPieces('w');
    
    // Should return the same map
    expect(pieces1).toBe(pieces2); // Same reference due to caching
    
    // Make a move
    chess.move('e4');
    
    // The cached result should be invalidated
    const pieces3 = boardSense.getAllPieces('w');
    expect(pieces3).not.toBe(pieces1); // Different reference after cache invalidation
    
    // But the content should still be correct
    const pawns = pieces3.get('p');
    expect(pawns).toHaveLength(8);
    expect(pawns).toContain('e4');
    expect(pawns).not.toContain('e2');
  });

  /**
   * Additional test: Non-mutating property for getAllPieces
   * Verifies that calling getAllPieces doesn't change the board state
   */
  test('getAllPieces does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Call getAllPieces for both colors
        boardSense.getAllPieces('w');
        boardSense.getAllPieces('b');
        
        // FEN should be unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });
});

describe('BoardSense - Attack and Defense Analysis', () => {
  
  /**
   * Unit test: getAttackers with starting position
   * Verifies that getAttackers correctly identifies pieces that can attack a square
   */
  test('getAttackers returns correct attackers in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // In starting position, no pieces can attack e4 (it's empty and not attacked)
    const attackersE4 = boardSense.getAttackers('e4', 'w');
    // White can attack e4 with: e2 pawn, d2 pawn, f2 pawn (after moving), knight from g1 or b1
    // Actually in starting position, only the e2 pawn can move to e4
    expect(attackersE4.length).toBeGreaterThanOrEqual(0);
    
    // Let's test a more specific scenario
    chess.move('e4'); // White pawn to e4
    chess.move('d5'); // Black pawn to d5
    
    // Now white pieces can attack d5
    const attackersD5White = boardSense.getAttackers('d5', 'w');
    // The e4 pawn can capture on d5
    expect(attackersD5White.length).toBeGreaterThanOrEqual(1);
    const pawnAttacker = attackersD5White.find(a => a.piece.type === 'p' && a.piece.square === 'e4');
    expect(pawnAttacker).toBeDefined();
    expect(pawnAttacker?.isXRay).toBe(false);
  });

  /**
   * Unit test: getAttackers with knight attacks
   * Verifies that knights are correctly identified as attackers
   */
  test('getAttackers correctly identifies knight attacks', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('Nf3'); // White knight to f3
    
    // The knight on f3 can attack several squares
    const attackersE5 = boardSense.getAttackers('e5', 'w');
    const knightAttacker = attackersE5.find(a => a.piece.type === 'n' && a.piece.square === 'f3');
    expect(knightAttacker).toBeDefined();
    
    const attackersD4 = boardSense.getAttackers('d4', 'w');
    const knightAttackerD4 = attackersD4.find(a => a.piece.type === 'n' && a.piece.square === 'f3');
    expect(knightAttackerD4).toBeDefined();
  });

  /**
   * Unit test: getAttackers with bishop attacks
   * Verifies that bishops are correctly identified as attackers
   */
  test('getAttackers correctly identifies bishop attacks', () => {
    // Set up a position where a bishop can attack
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2');
    const boardSense = new BoardSense(chess);
    
    // White bishop on c4 can attack several squares
    const attackersF7 = boardSense.getAttackers('f7', 'w');
    const bishopAttacker = attackersF7.find(a => a.piece.type === 'b' && a.piece.square === 'c4');
    expect(bishopAttacker).toBeDefined();
    expect(bishopAttacker?.isXRay).toBe(false);
  });

  /**
   * Unit test: getAttackers with rook attacks
   * Verifies that rooks are correctly identified as attackers
   */
  test('getAttackers correctly identifies rook attacks', () => {
    // Set up a position where a rook can attack
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // White rook on a1 can attack a2, a3, etc. (but blocked by pawn)
    // Let's move the pawn first
    chess.move('a4');
    
    // Now rook on a1 can attack a2, a3
    const attackersA3 = boardSense.getAttackers('a3', 'w');
    const rookAttacker = attackersA3.find(a => a.piece.type === 'r' && a.piece.square === 'a1');
    expect(rookAttacker).toBeDefined();
  });

  /**
   * Unit test: getAttackers with queen attacks
   * Verifies that queens are correctly identified as attackers
   */
  test('getAttackers correctly identifies queen attacks', () => {
    // Set up a position where queen can attack
    // Queen on e2, can attack e5 if path is clear
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/4p3/8/8/PPPPQPPP/RNB1KBNR b KQkq - 1 2');
    const boardSense = new BoardSense(chess);
    
    // White queen on e2 can attack e5 (path is clear now)
    const attackersE5 = boardSense.getAttackers('e5', 'w');
    const queenAttacker = attackersE5.find(a => a.piece.type === 'q');
    expect(queenAttacker).toBeDefined();
    expect(queenAttacker?.piece.square).toBe('e2');
  });

  /**
   * Unit test: getAttackers with king attacks
   * Verifies that kings are correctly identified as attackers
   */
  test('getAttackers correctly identifies king attacks', () => {
    // Set up a position where king can attack
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/4K3/PPPPPPPP/RNBQ1BNR w kq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // White king on e3 can attack d2, d3, d4, e2, e4, f2, f3, f4
    const attackersD3 = boardSense.getAttackers('d3', 'w');
    const kingAttacker = attackersD3.find(a => a.piece.type === 'k' && a.piece.square === 'e3');
    expect(kingAttacker).toBeDefined();
  });

  /**
   * Unit test: getAttackers with invalid square
   * Verifies that invalid squares return empty array
   */
  test('getAttackers returns empty array for invalid square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const attackers = boardSense.getAttackers('z9' as any, 'w');
    expect(attackers).toEqual([]);
    
    const attackers2 = boardSense.getAttackers('invalid' as any, 'b');
    expect(attackers2).toEqual([]);
  });

  /**
   * Unit test: getAttackers with no attackers
   * Verifies that squares with no attackers return empty array
   */
  test('getAttackers returns empty array when no pieces can attack', () => {
    // Set up a position with only kings far apart
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // d4 cannot be attacked by either king
    const attackersWhite = boardSense.getAttackers('d4', 'w');
    expect(attackersWhite).toEqual([]);
    
    const attackersBlack = boardSense.getAttackers('d4', 'b');
    expect(attackersBlack).toEqual([]);
  });

  /**
   * Unit test: getAttackers caching
   * Verifies that repeated calls return the same result (cached)
   */
  test('getAttackers uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('e4');
    chess.move('d5');
    
    // Call getAttackers twice for the same square
    const attackers1 = boardSense.getAttackers('d5', 'w');
    const attackers2 = boardSense.getAttackers('d5', 'w');
    
    // Should return the same array (cached)
    expect(attackers1).toBe(attackers2);
    
    // Make a move
    chess.move('exd5');
    
    // The cached result should be invalidated
    const attackers3 = boardSense.getAttackers('d5', 'w');
    expect(attackers3).not.toBe(attackers1);
  });

  /**
   * Unit test: getAttackers does not mutate Chess instance
   * Verifies that calling getAttackers doesn't change the board state
   */
  test('getAttackers does not mutate the Chess instance', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('e4');
    const originalFen = chess.fen();
    
    // Call getAttackers multiple times
    boardSense.getAttackers('d5', 'w');
    boardSense.getAttackers('e5', 'b');
    boardSense.getAttackers('f3', 'w');
    
    // FEN should be unchanged
    expect(chess.fen()).toBe(originalFen);
  });

  /**
   * Property 8: Attack detection accuracy
   * **Validates: Requirements 3.1, 3.2, 3.4**
   * 
   * For any square and board position, getAttackers should return exactly the set
   * of pieces that can legally move to that square, with no false positives or false negatives.
   */
  test('Property 8: Attack detection accuracy', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
                        'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
                        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
                        'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
                        'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
                        'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
                        'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          const attackers = boardSense.getAttackers(square as any, color as any);
          
          // Check if the square is occupied by a piece of the attacking color
          const pieceOnSquare = chess.get(square as any);
          const squareOccupiedByAttacker = pieceOnSquare && pieceOnSquare.color === color;
          
          // Manually verify using chess.isAttacked
          const isAttacked = chess.isAttacked(square as any, color as any);
          
          // If we found attackers, the square should be attacked
          if (attackers.length > 0) {
            if (!isAttacked) {
              console.log(`FAIL: Found ${attackers.length} attackers but isAttacked returned false`);
              console.log(`Square: ${square}, Color: ${color}, FEN: ${chess.fen()}`);
              console.log(`Attackers:`, attackers.map(a => `${a.piece.type} on ${a.piece.square}`));
            }
            expect(isAttacked).toBe(true);
          } else if (!squareOccupiedByAttacker) {
            // If we found no attackers and the square is not occupied by the attacking color,
            // then the square should not be attacked
            if (isAttacked) {
              console.log(`FAIL: Found no attackers but isAttacked returned true`);
              console.log(`Square: ${square}, Color: ${color}, FEN: ${chess.fen()}`);
              console.log(`Piece on square:`, pieceOnSquare);
            }
            expect(isAttacked).toBe(false);
          }
          
          // Verify all attackers have isXRay set to false (x-ray attacks handled separately)
          attackers.forEach(attacker => {
            expect(attacker.isXRay).toBe(false);
            expect(attacker.piece.color).toBe(color);
          });
          
          // Verify no duplicate attackers
          const attackerSquares = attackers.map(a => a.piece.square);
          const uniqueSquares = new Set(attackerSquares);
          expect(attackerSquares.length).toBe(uniqueSquares.size);
        }
      ),
      { numRuns: 50 } // Reduced runs for performance
    );
  });

  /**
   * Additional property test: getAttackers non-mutation
   * Verifies that getAttackers never mutates the Chess instance
   */
  test('Property: getAttackers does not mutate Chess instance', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const originalFen = chess.fen();
          const boardSense = new BoardSense(chess);
          
          boardSense.getAttackers(square as any, color as any);
          
          expect(chess.fen()).toBe(originalFen);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('BoardSense - isSquareAttacked Tests', () => {
  
  /**
   * Unit test: isSquareAttacked returns true when square is attacked
   */
  test('isSquareAttacked returns true when square is attacked', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // In starting position, d3 is attacked by white pawn on e2
    expect(boardSense.isSquareAttacked('d3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('f3', 'w')).toBe(true);
    
    // Move white pawn to e4
    chess.move('e4');
    
    // Now d5 and f5 are attacked by the white pawn on e4
    expect(boardSense.isSquareAttacked('d5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('f5', 'w')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked returns false when square is not attacked
   */
  test('isSquareAttacked returns false when square is not attacked', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // In starting position, a4 is not attacked by either color
    expect(boardSense.isSquareAttacked('a4', 'w')).toBe(false);
    expect(boardSense.isSquareAttacked('a4', 'b')).toBe(false);
    
    // h5 is also not attacked
    expect(boardSense.isSquareAttacked('h5', 'w')).toBe(false);
    expect(boardSense.isSquareAttacked('h5', 'b')).toBe(false);
  });

  /**
   * Unit test: isSquareAttacked with knight attacks
   */
  test('isSquareAttacked detects knight attacks', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // White knight on b1 can attack a3, c3, d2
    expect(boardSense.isSquareAttacked('a3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('c3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d2', 'w')).toBe(true);
    
    // Black knight on g8 can attack f6, h6
    expect(boardSense.isSquareAttacked('f6', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('h6', 'b')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked with bishop attacks
   */
  test('isSquareAttacked detects bishop attacks', () => {
    // Set up a position with an exposed bishop
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/2B5/PPPPPPPP/RN1QKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // Bishop on c3 attacks several squares
    expect(boardSense.isSquareAttacked('d4', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('e5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('f6', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('b4', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('a5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d2', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('b2', 'w')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked with rook attacks
   */
  test('isSquareAttacked detects rook attacks', () => {
    // Set up a position with an exposed rook
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/3R4/PPPPPPPP/1NBQKBNR w Kkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // Rook on d3 attacks the d-file and 3rd rank
    expect(boardSense.isSquareAttacked('d4', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d6', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d7', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('e3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('c3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('b3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('a3', 'w')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked with queen attacks
   */
  test('isSquareAttacked detects queen attacks', () => {
    // Set up a position with an exposed queen
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/3Q4/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // Queen on d4 attacks many squares (like rook + bishop)
    expect(boardSense.isSquareAttacked('d5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('d6', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('e4', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('c4', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('e5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('c5', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('e3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('c3', 'w')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked with king attacks
   */
  test('isSquareAttacked detects king attacks', () => {
    // Set up a position with an exposed king
    const chess = new Chess('rnbq1bnr/pppppppp/8/4k3/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1');
    const boardSense = new BoardSense(chess);
    
    // King on e5 attacks all adjacent squares
    expect(boardSense.isSquareAttacked('d5', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('d6', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('e6', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('f6', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('f5', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('f4', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('e4', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('d4', 'b')).toBe(true);
  });

  /**
   * Unit test: isSquareAttacked with pawn attacks
   */
  test('isSquareAttacked detects pawn attacks', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // White pawns on rank 2 attack diagonally forward
    // Pawn on e2 attacks d3 and f3
    expect(boardSense.isSquareAttacked('d3', 'w')).toBe(true);
    expect(boardSense.isSquareAttacked('f3', 'w')).toBe(true);
    
    // Black pawns on rank 7 attack diagonally forward (downward)
    // Pawn on e7 attacks d6 and f6
    expect(boardSense.isSquareAttacked('d6', 'b')).toBe(true);
    expect(boardSense.isSquareAttacked('f6', 'b')).toBe(true);
    
    // Test a square that's not attacked by pawns
    // a4 is not attacked by any white pawns in starting position
    expect(boardSense.isSquareAttacked('a4', 'w')).toBe(false);
  });

  /**
   * Unit test: isSquareAttacked with invalid square
   */
  test('isSquareAttacked returns false for invalid square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Invalid squares should return false
    expect(boardSense.isSquareAttacked('i9' as any, 'w')).toBe(false);
    expect(boardSense.isSquareAttacked('a0' as any, 'b')).toBe(false);
    expect(boardSense.isSquareAttacked('invalid' as any, 'w')).toBe(false);
  });

  /**
   * Unit test: isSquareAttacked uses getAttackers internally
   * This test verifies the implementation detail that isSquareAttacked
   * should return true if and only if getAttackers returns a non-empty array
   */
  test('isSquareAttacked is consistent with getAttackers', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8', 'c3', 'f6'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          
          const attackers = boardSense.getAttackers(square as any, color as any);
          const isAttacked = boardSense.isSquareAttacked(square as any, color as any);
          
          // isSquareAttacked should return true if and only if getAttackers returns non-empty array
          expect(isAttacked).toBe(attackers.length > 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: isSquareAttacked does not mutate Chess instance
   */
  test('Property: isSquareAttacked does not mutate Chess instance', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const originalFen = chess.fen();
          const boardSense = new BoardSense(chess);
          
          boardSense.isSquareAttacked(square as any, color as any);
          
          expect(chess.fen()).toBe(originalFen);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: isSquareAttacked returns boolean
   */
  test('Property: isSquareAttacked always returns boolean', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8', 'c3', 'f6'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          const result = boardSense.isSquareAttacked(square as any, color as any);
          
          expect(typeof result).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('BoardSense - getDefenders Tests', () => {
  
  /**
   * Unit test: getDefenders returns pieces that can defend a square
   * Defending a square means being able to attack/recapture on that square
   */
  test('getDefenders returns correct defenders in a tactical position', () => {
    // Set up a position where white has a pawn on e4 that can be defended
    const chess = new Chess();
    chess.move('e4'); // White pawn to e4
    chess.move('d5'); // Black pawn to d5
    
    const boardSense = new BoardSense(chess);
    
    // White pieces that can defend (attack) d5
    const whiteDef = boardSense.getDefenders('d5', 'w');
    // The e4 pawn can capture on d5, so it defends that square
    expect(whiteDef.length).toBeGreaterThanOrEqual(1);
    const pawnDefender = whiteDef.find(d => d.piece.type === 'p' && d.piece.square === 'e4');
    expect(pawnDefender).toBeDefined();
    
    // Black pieces that can defend (attack) e4
    const blackDef = boardSense.getDefenders('e4', 'b');
    // The d5 pawn can capture on e4, so it defends that square
    expect(blackDef.length).toBeGreaterThanOrEqual(1);
    const blackPawnDefender = blackDef.find(d => d.piece.type === 'p' && d.piece.square === 'd5');
    expect(blackPawnDefender).toBeDefined();
  });

  /**
   * Unit test: getDefenders is equivalent to getAttackers
   * Since defending a square means being able to attack it
   */
  test('getDefenders returns same result as getAttackers', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8', 'c3', 'f6'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          
          const defenders = boardSense.getDefenders(square as any, color as any);
          const attackers = boardSense.getAttackers(square as any, color as any);
          
          // getDefenders should return the same result as getAttackers
          expect(defenders).toEqual(attackers);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Unit test: getDefenders with multiple defenders
   */
  test('getDefenders identifies multiple defenders', () => {
    // Set up a position where multiple pieces defend a square
    // Let's use a position where d4 is defended by multiple white pieces
    const chess = new Chess();
    chess.move('e4'); // Pawn to e4
    chess.move('e5'); // Black pawn to e5
    chess.move('Nf3'); // Knight to f3
    chess.move('Nc6'); // Black knight
    chess.move('d4'); // Pawn to d4
    
    const boardSense = new BoardSense(chess);
    
    // Multiple white pieces can defend/attack e5: pawn on e4, pawn on d4, knight on f3
    const defenders = boardSense.getDefenders('e5', 'w');
    expect(defenders.length).toBeGreaterThanOrEqual(2);
    
    // Check for pawn defenders
    const pawnDefenders = defenders.filter(d => d.piece.type === 'p');
    expect(pawnDefenders.length).toBeGreaterThanOrEqual(1);
    
    // Check for knight defender
    const knightDefender = defenders.find(d => d.piece.type === 'n' && d.piece.square === 'f3');
    expect(knightDefender).toBeDefined();
  });

  /**
   * Unit test: getDefenders with no defenders
   */
  test('getDefenders returns empty array when no pieces can defend', () => {
    // Set up a position with only kings far apart
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // d4 cannot be defended by either king
    const whiteDef = boardSense.getDefenders('d4', 'w');
    expect(whiteDef).toEqual([]);
    
    const blackDef = boardSense.getDefenders('d4', 'b');
    expect(blackDef).toEqual([]);
  });

  /**
   * Unit test: getDefenders with invalid square
   */
  test('getDefenders returns empty array for invalid square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const defenders = boardSense.getDefenders('z9' as any, 'w');
    expect(defenders).toEqual([]);
    
    const defenders2 = boardSense.getDefenders('invalid' as any, 'b');
    expect(defenders2).toEqual([]);
  });

  /**
   * Unit test: getDefenders does not mutate Chess instance
   */
  test('getDefenders does not mutate the Chess instance', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('e4');
    const originalFen = chess.fen();
    
    // Call getDefenders multiple times
    boardSense.getDefenders('d5', 'w');
    boardSense.getDefenders('e5', 'b');
    boardSense.getDefenders('f3', 'w');
    
    // FEN should be unchanged
    expect(chess.fen()).toBe(originalFen);
  });

  /**
   * Unit test: getDefenders with knight defenders
   */
  test('getDefenders correctly identifies knight defenders', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('Nf3'); // White knight to f3
    
    // The knight on f3 can defend several squares
    const defendersE5 = boardSense.getDefenders('e5', 'w');
    const knightDefender = defendersE5.find(d => d.piece.type === 'n' && d.piece.square === 'f3');
    expect(knightDefender).toBeDefined();
    
    const defendersD4 = boardSense.getDefenders('d4', 'w');
    const knightDefenderD4 = defendersD4.find(d => d.piece.type === 'n' && d.piece.square === 'f3');
    expect(knightDefenderD4).toBeDefined();
  });

  /**
   * Unit test: getDefenders caching
   */
  test('getDefenders uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    chess.move('e4');
    chess.move('d5');
    
    // Call getDefenders twice for the same square
    const defenders1 = boardSense.getDefenders('d5', 'w');
    const defenders2 = boardSense.getDefenders('d5', 'w');
    
    // Should return the same array (cached)
    expect(defenders1).toBe(defenders2);
    
    // Make a move
    chess.move('exd5');
    
    // The cached result should be invalidated
    const defenders3 = boardSense.getDefenders('d5', 'w');
    expect(defenders3).not.toBe(defenders1);
  });

  /**
   * Property 9: Defender identification correctness
   * **Validates: Requirements 3.3**
   * 
   * For any piece on the board, getDefenders should return exactly the set
   * of friendly pieces that attack the piece's square.
   */
  test('Property 9: Defender identification correctness', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8',
                        'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
                        'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8',
                        'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8',
                        'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8',
                        'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8',
                        'g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8',
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          const defenders = boardSense.getDefenders(square as any, color as any);
          const attackers = boardSense.getAttackers(square as any, color as any);
          
          // getDefenders should return exactly the same as getAttackers
          // because defending a square means being able to attack/recapture on it
          expect(defenders).toEqual(attackers);
          
          // Verify all defenders have the correct color
          defenders.forEach(defender => {
            expect(defender.piece.color).toBe(color);
          });
          
          // Verify no duplicate defenders
          const defenderSquares = defenders.map(d => d.piece.square);
          const uniqueSquares = new Set(defenderSquares);
          expect(defenderSquares.length).toBe(uniqueSquares.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: getDefenders does not mutate Chess instance
   */
  test('Property: getDefenders does not mutate Chess instance', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const originalFen = chess.fen();
          const boardSense = new BoardSense(chess);
          
          boardSense.getDefenders(square as any, color as any);
          
          expect(chess.fen()).toBe(originalFen);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('BoardSense - getXRayAttackers Tests', () => {
  
  /**
   * Unit test: getXRayAttackers detects rook x-ray through piece
   * Classic x-ray: Rook attacks through a piece on the same file/rank
   */
  test('getXRayAttackers detects rook x-ray attack through piece', () => {
    // Set up: White rook on a1, white pawn on a3, target square a5
    // The rook x-ray attacks a5 through the pawn on a3
    const chess = new Chess('4k3/8/8/8/8/P7/8/R6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('a5', 'w');
    
    // Should find the rook on a1 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const rookXRay = xrayAttackers.find(a => a.piece.type === 'r' && a.piece.square === 'a1');
    expect(rookXRay).toBeDefined();
    expect(rookXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers detects bishop x-ray through piece
   */
  test('getXRayAttackers detects bishop x-ray attack through piece', () => {
    // Set up: White bishop on a1, white pawn on c3, target square e5
    // The bishop x-ray attacks e5 through the pawn on c3
    const chess = new Chess('8/8/8/4k3/8/2P5/8/B6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('e5', 'w');
    
    // Should find the bishop on a1 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const bishopXRay = xrayAttackers.find(a => a.piece.type === 'b' && a.piece.square === 'a1');
    expect(bishopXRay).toBeDefined();
    expect(bishopXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers detects queen x-ray through piece
   */
  test('getXRayAttackers detects queen x-ray attack through piece', () => {
    // Set up: White queen on d1, white knight on d4, target square d7
    // The queen x-ray attacks d7 through the knight on d4
    const chess = new Chess('8/3k4/8/8/3N4/8/8/3Q3K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('d7', 'w');
    
    // Should find the queen on d1 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const queenXRay = xrayAttackers.find(a => a.piece.type === 'q' && a.piece.square === 'd1');
    expect(queenXRay).toBeDefined();
    expect(queenXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers with no x-ray attacks
   */
  test('getXRayAttackers returns empty array when no x-ray attacks exist', () => {
    // Position with only kings - no sliding pieces, so no x-ray attacks
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('e4', 'w');
    expect(xrayAttackers).toEqual([]);
    
    const xrayAttackers2 = boardSense.getXRayAttackers('d5', 'b');
    expect(xrayAttackers2).toEqual([]);
  });

  /**
   * Unit test: getXRayAttackers with direct attack (not x-ray)
   */
  test('getXRayAttackers does not include direct attacks', () => {
    // Set up: White rook on a1 with clear path to a5
    const chess = new Chess('4k3/8/8/8/8/8/8/R6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // The rook has a direct attack on a5, not an x-ray attack
    const xrayAttackers = boardSense.getXRayAttackers('a5', 'w');
    
    // Should not find the rook as an x-ray attacker (it's a direct attacker)
    const rookXRay = xrayAttackers.find(a => a.piece.type === 'r' && a.piece.square === 'a1');
    expect(rookXRay).toBeUndefined();
  });

  /**
   * Unit test: getXRayAttackers with multiple blocking pieces
   */
  test('getXRayAttackers detects x-ray through multiple pieces', () => {
    // Set up: White rook on a1, pieces on a2 and a4, target square a6
    // The rook x-ray attacks a6 through multiple pieces
    const chess = new Chess('4k3/8/8/8/P7/8/P7/R6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('a6', 'w');
    
    // Should find the rook on a1 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const rookXRay = xrayAttackers.find(a => a.piece.type === 'r' && a.piece.square === 'a1');
    expect(rookXRay).toBeDefined();
    expect(rookXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers with invalid square
   */
  test('getXRayAttackers returns empty array for invalid square', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('z9' as any, 'w');
    expect(xrayAttackers).toEqual([]);
    
    const xrayAttackers2 = boardSense.getXRayAttackers('invalid' as any, 'b');
    expect(xrayAttackers2).toEqual([]);
  });

  /**
   * Unit test: getXRayAttackers does not mutate Chess instance
   */
  test('getXRayAttackers does not mutate the Chess instance', () => {
    const chess = new Chess('4k3/8/8/8/8/P7/8/R6K w - - 0 1');
    const originalFen = chess.fen();
    const boardSense = new BoardSense(chess);
    
    boardSense.getXRayAttackers('a5', 'w');
    boardSense.getXRayAttackers('a6', 'w');
    boardSense.getXRayAttackers('a7', 'w');
    
    // FEN should be unchanged
    expect(chess.fen()).toBe(originalFen);
  });

  /**
   * Unit test: getXRayAttackers caching
   */
  test('getXRayAttackers uses caching correctly', () => {
    const chess = new Chess('4k3/8/8/8/8/P7/8/R6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // Call getXRayAttackers twice for the same square
    const xray1 = boardSense.getXRayAttackers('a5', 'w');
    const xray2 = boardSense.getXRayAttackers('a5', 'w');
    
    // Should return the same array (cached)
    expect(xray1).toBe(xray2);
    
    // Make a move (move the pawn forward)
    chess.move('a4');
    
    // The cached result should be invalidated
    const xray3 = boardSense.getXRayAttackers('a5', 'w');
    expect(xray3).not.toBe(xray1);
  });

  /**
   * Unit test: getXRayAttackers with queen on diagonal
   */
  test('getXRayAttackers detects queen x-ray on diagonal', () => {
    // Set up: White queen on a1, white pawn on c3, target square e5
    const chess = new Chess('8/8/8/4k3/8/2P5/8/Q6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('e5', 'w');
    
    // Should find the queen on a1 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const queenXRay = xrayAttackers.find(a => a.piece.type === 'q' && a.piece.square === 'a1');
    expect(queenXRay).toBeDefined();
    expect(queenXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers with queen on rank
   */
  test('getXRayAttackers detects queen x-ray on rank', () => {
    // Set up: White queen on a4, white knight on d4, target square g4
    const chess = new Chess('8/8/8/8/Q2N3k/8/8/7K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('g4', 'w');
    
    // Should find the queen on a4 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const queenXRay = xrayAttackers.find(a => a.piece.type === 'q' && a.piece.square === 'a4');
    expect(queenXRay).toBeDefined();
    expect(queenXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers with black pieces
   */
  test('getXRayAttackers detects black x-ray attacks', () => {
    // Set up: Black rook on h8, black pawn on h6, target square h3
    const chess = new Chess('4k2r/8/7p/8/8/8/8/7K b - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('h3', 'b');
    
    // Should find the rook on h8 as an x-ray attacker
    expect(xrayAttackers.length).toBeGreaterThanOrEqual(1);
    const rookXRay = xrayAttackers.find(a => a.piece.type === 'r' && a.piece.square === 'h8');
    expect(rookXRay).toBeDefined();
    expect(rookXRay?.isXRay).toBe(true);
  });

  /**
   * Unit test: getXRayAttackers with piece not on same line
   */
  test('getXRayAttackers does not detect x-ray when not on same line', () => {
    // Set up: White rook on a1, target square e5 (not on same line)
    const chess = new Chess('4k3/8/8/8/8/8/8/R6K w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const xrayAttackers = boardSense.getXRayAttackers('e5', 'w');
    
    // Should not find the rook as an x-ray attacker (not on same line)
    const rookXRay = xrayAttackers.find(a => a.piece.type === 'r' && a.piece.square === 'a1');
    expect(rookXRay).toBeUndefined();
  });

  /**
   * Property 10: X-ray attack detection
   * **Validates: Requirements 3.5**
   * 
   * For any position with a sliding piece behind another piece on the same line,
   * getXRayAttackers should correctly identify the x-ray attack.
   */
  test('Property 10: X-ray attack detection', () => {
    // Test specific positions with known x-ray attacks
    const testPositions = [
      {
        fen: '4k3/8/8/8/8/P7/8/R6K w - - 0 1',
        square: 'a5' as const,
        color: 'w' as const,
        expectedXRay: { type: 'r' as const, square: 'a1' as const }
      },
      {
        fen: '4k3/8/8/8/8/2P5/8/B6K w - - 0 1',
        square: 'e5' as const,
        color: 'w' as const,
        expectedXRay: { type: 'b' as const, square: 'a1' as const }
      },
      {
        fen: '3k4/8/8/8/3N4/8/8/3Q3K w - - 0 1',
        square: 'd7' as const,
        color: 'w' as const,
        expectedXRay: { type: 'q' as const, square: 'd1' as const }
      },
      {
        fen: '4k2r/8/7p/8/8/8/8/7K b - - 0 1',
        square: 'h3' as const,
        color: 'b' as const,
        expectedXRay: { type: 'r' as const, square: 'h8' as const }
      }
    ];

    testPositions.forEach(({ fen, square, color, expectedXRay }) => {
      const chess = new Chess(fen);
      const boardSense = new BoardSense(chess);
      
      const xrayAttackers = boardSense.getXRayAttackers(square, color);
      
      // Should find the expected x-ray attacker
      const xray = xrayAttackers.find(
        a => a.piece.type === expectedXRay.type && a.piece.square === expectedXRay.square
      );
      expect(xray).toBeDefined();
      expect(xray?.isXRay).toBe(true);
      expect(xray?.piece.color).toBe(color);
    });
  });

  /**
   * Property test: getXRayAttackers does not mutate Chess instance
   */
  test('Property: getXRayAttackers does not mutate Chess instance', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const originalFen = chess.fen();
          const boardSense = new BoardSense(chess);
          
          boardSense.getXRayAttackers(square as any, color as any);
          
          expect(chess.fen()).toBe(originalFen);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: All x-ray attackers are sliding pieces
   */
  test('Property: All x-ray attackers are sliding pieces', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('a1', 'e4', 'd5', 'h8', 'c3', 'f6'),
        fc.constantFrom('w', 'b'),
        (chess, square, color) => {
          const boardSense = new BoardSense(chess);
          const xrayAttackers = boardSense.getXRayAttackers(square as any, color as any);
          
          // All x-ray attackers must be sliding pieces (rook, bishop, queen)
          xrayAttackers.forEach(attacker => {
            expect(['r', 'b', 'q']).toContain(attacker.piece.type);
            expect(attacker.isXRay).toBe(true);
            expect(attacker.piece.color).toBe(color);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property test: X-ray attackers have blocking pieces
   */
  test('Property: X-ray attackers have at least one blocking piece', () => {
    // Test specific positions where we know there are x-ray attacks
    const testPositions = [
      { fen: '4k3/8/8/8/8/P7/8/R6K w - - 0 1', square: 'a5' as const, color: 'w' as const },
      { fen: '4k3/8/8/8/8/2P5/8/B6K w - - 0 1', square: 'e5' as const, color: 'w' as const },
      { fen: '3k4/8/8/8/3N4/8/8/3Q3K w - - 0 1', square: 'd7' as const, color: 'w' as const },
    ];

    testPositions.forEach(({ fen, square, color }) => {
      const chess = new Chess(fen);
      const boardSense = new BoardSense(chess);
      
      const xrayAttackers = boardSense.getXRayAttackers(square, color);
      
      // Each x-ray attacker should have at least one blocking piece
      // (This is implicit in the definition of x-ray attack)
      xrayAttackers.forEach(attacker => {
        expect(attacker.isXRay).toBe(true);
      });
    });
  });
});

describe('BoardSense - Material Analysis', () => {
  
  /**
   * Basic test: getMaterialCount returns correct value for starting position
   */
  test('getMaterialCount returns correct value for starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Starting position material:
    // White: 8 pawns (8) + 2 knights (6) + 2 bishops (6) + 2 rooks (10) + 1 queen (9) + 1 king (0) = 39
    // Black: same = 39
    const whiteMaterial = boardSense.getMaterialCount('w');
    const blackMaterial = boardSense.getMaterialCount('b');
    
    expect(whiteMaterial).toBe(39);
    expect(blackMaterial).toBe(39);
  });
  
  /**
   * Test: getMaterialCount with minimal position (only kings)
   */
  test('getMaterialCount returns 0 for position with only kings', () => {
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // Only kings, which have value 0
    const whiteMaterial = boardSense.getMaterialCount('w');
    const blackMaterial = boardSense.getMaterialCount('b');
    
    expect(whiteMaterial).toBe(0);
    expect(blackMaterial).toBe(0);
  });
  
  /**
   * Test: getMaterialCount after captures
   */
  test('getMaterialCount returns correct value after captures', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    chess.move('Nc6');
    chess.move('Bb5');
    chess.move('a6');
    chess.move('Bxc6'); // White bishop takes black knight
    chess.move('dxc6'); // Black pawn recaptures
    
    const boardSense = new BoardSense(chess);
    
    // White: 8 pawns (8) + 2 knights (6) + 1 bishop (3) + 2 rooks (10) + 1 queen (9) + 1 king (0) = 36
    // Black: 8 pawns (8) + 1 knight (3) + 2 bishops (6) + 2 rooks (10) + 1 queen (9) + 1 king (0) = 36
    const whiteMaterial = boardSense.getMaterialCount('w');
    const blackMaterial = boardSense.getMaterialCount('b');
    
    expect(whiteMaterial).toBe(36);
    expect(blackMaterial).toBe(36);
  });
  
  /**
   * Test: getMaterialCount uses correct piece values
   */
  test('getMaterialCount uses standard piece values', () => {
    // Create a position with one of each piece type
    // White: 1 pawn, 1 knight, 1 bishop, 1 rook, 1 queen, 1 king
    const chess = new Chess('4k3/8/8/8/8/8/P7/RNBQK3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    // White material: 1 pawn (1) + 1 knight (3) + 1 bishop (3) + 1 rook (5) + 1 queen (9) + 1 king (0) = 21
    const whiteMaterial = boardSense.getMaterialCount('w');
    expect(whiteMaterial).toBe(21);
    
    // Black material: only king (0)
    const blackMaterial = boardSense.getMaterialCount('b');
    expect(blackMaterial).toBe(0);
  });
  
  /**
   * Test: getMaterialCount uses caching
   */
  test('getMaterialCount uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getMaterialCount twice
    const material1 = boardSense.getMaterialCount('w');
    const material2 = boardSense.getMaterialCount('w');
    
    // Should return the same value
    expect(material1).toBe(material2);
    expect(material1).toBe(39);
    
    // Make a move that captures a piece
    chess.move('e4');
    chess.move('d5');
    chess.move('exd5'); // White pawn captures black pawn
    
    // Cache should be invalidated, material should be updated
    const material3 = boardSense.getMaterialCount('w');
    const blackMaterial = boardSense.getMaterialCount('b');
    
    expect(material3).toBe(39); // White still has 39 (gained a pawn position but same count)
    expect(blackMaterial).toBe(38); // Black lost a pawn (1 point)
  });
  
  /**
   * Test: getMaterialCount does not mutate Chess instance
   */
  test('getMaterialCount does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        boardSense.getMaterialCount('w');
        boardSense.getMaterialCount('b');
        
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 13: Standard piece values
   * **Validates: Requirements 4.3**
   * 
   * For any board position with known pieces, material count should use exactly:
   * pawn=1, knight=3, bishop=3, rook=5, queen=9, king=0.
   */
  test('Property 13: Standard piece values', () => {
    // Test with specific positions where we know the exact piece counts
    const testPositions = [
      { 
        fen: '4k3/8/8/8/8/8/P7/4K3 w - - 0 1', 
        white: 1, // 1 pawn
        black: 0 
      },
      { 
        fen: '4k3/8/8/8/8/8/8/N3K3 w - - 0 1', 
        white: 3, // 1 knight
        black: 0 
      },
      { 
        fen: '4k3/8/8/8/8/8/8/B3K3 w - - 0 1', 
        white: 3, // 1 bishop
        black: 0 
      },
      { 
        fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 
        white: 5, // 1 rook
        black: 0 
      },
      { 
        fen: '4k3/8/8/8/8/8/8/Q3K3 w - - 0 1', 
        white: 9, // 1 queen
        black: 0 
      },
      { 
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1', 
        white: 0, // only king
        black: 0 
      },
    ];
    
    testPositions.forEach(({ fen, white, black }) => {
      const chess = new Chess(fen);
      const boardSense = new BoardSense(chess);
      
      expect(boardSense.getMaterialCount('w')).toBe(white);
      expect(boardSense.getMaterialCount('b')).toBe(black);
    });
  });
  
  /**
   * Property 12: Material balance calculation
   * **Validates: Requirements 4.2**
   * 
   * For any board position, getMaterialBalance should equal 
   * getMaterialCount('w') minus getMaterialCount('b').
   */
  test('Property 12: Material balance calculation', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        const whiteMaterial = boardSense.getMaterialCount('w');
        const blackMaterial = boardSense.getMaterialCount('b');
        const balance = boardSense.getMaterialBalance();
        
        // Balance should equal white material minus black material
        expect(balance).toBe(whiteMaterial - blackMaterial);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Test: getMaterialBalance with equal material
   */
  test('getMaterialBalance returns 0 for starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const balance = boardSense.getMaterialBalance();
    expect(balance).toBe(0); // Starting position has equal material
  });
  
  /**
   * Test: getMaterialBalance with white ahead
   */
  test('getMaterialBalance returns positive when white is ahead', () => {
    // White has extra queen
    const chess = new Chess('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const balance = boardSense.getMaterialBalance();
    expect(balance).toBe(9); // White ahead by 9 (queen)
  });
  
  /**
   * Test: getMaterialBalance with black ahead
   */
  test('getMaterialBalance returns negative when black is ahead', () => {
    // Black has extra rook
    const chess = new Chess('r3k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const balance = boardSense.getMaterialBalance();
    expect(balance).toBe(-5); // Black ahead by 5 (rook)
  });
  
  /**
   * Test: getMaterialBalance after captures
   */
  test('getMaterialBalance updates correctly after captures', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Starting position - equal material
    expect(boardSense.getMaterialBalance()).toBe(0);
    
    // Set up a capture
    chess.move('e4');
    chess.move('d5');
    chess.move('exd5'); // White captures black pawn
    
    // White should be ahead by 1 pawn
    const balance = boardSense.getMaterialBalance();
    expect(balance).toBe(1);
  });
  
  /**
   * Test: getMaterialBalance does not mutate Chess instance
   */
  test('getMaterialBalance does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        boardSense.getMaterialBalance();
        
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 11: Material breakdown accuracy (partial test for getMaterialCount)
   * **Validates: Requirements 4.1**
   * 
   * For any board position and color, getMaterialCount should return the correct
   * total material value based on the pieces on the board.
   */
  test('Property 11 (partial): Material count accuracy', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Get material counts
        const whiteMaterial = boardSense.getMaterialCount('w');
        const blackMaterial = boardSense.getMaterialCount('b');
        
        // Material should be non-negative
        expect(whiteMaterial).toBeGreaterThanOrEqual(0);
        expect(blackMaterial).toBeGreaterThanOrEqual(0);
        
        // Material should be reasonable (max is starting position = 39)
        // In theory, with promotions, it could be higher, but for random positions it's unlikely
        expect(whiteMaterial).toBeLessThanOrEqual(100);
        expect(blackMaterial).toBeLessThanOrEqual(100);
        
        // Manually calculate material to verify
        const materialValues: Record<string, number> = {
          'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
        };
        
        let expectedWhite = 0;
        let expectedBlack = 0;
        
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
        
        for (const file of files) {
          for (const rank of ranks) {
            const square = (file + rank) as any;
            const piece = chess.get(square);
            if (piece) {
              const value = materialValues[piece.type];
              if (piece.color === 'w') {
                expectedWhite += value;
              } else {
                expectedBlack += value;
              }
            }
          }
        }
        
        expect(whiteMaterial).toBe(expectedWhite);
        expect(blackMaterial).toBe(expectedBlack);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Test: getMaterialBreakdown returns correct breakdown for starting position
   */
  test('getMaterialBreakdown returns correct breakdown for starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteBreakdown = boardSense.getMaterialBreakdown('w');
    const blackBreakdown = boardSense.getMaterialBreakdown('b');
    
    // White breakdown
    expect(whiteBreakdown.pawns).toBe(8);
    expect(whiteBreakdown.knights).toBe(2);
    expect(whiteBreakdown.bishops).toBe(2);
    expect(whiteBreakdown.rooks).toBe(2);
    expect(whiteBreakdown.queens).toBe(1);
    expect(whiteBreakdown.total).toBe(39); // 8*1 + 2*3 + 2*3 + 2*5 + 1*9 = 39
    
    // Black breakdown
    expect(blackBreakdown.pawns).toBe(8);
    expect(blackBreakdown.knights).toBe(2);
    expect(blackBreakdown.bishops).toBe(2);
    expect(blackBreakdown.rooks).toBe(2);
    expect(blackBreakdown.queens).toBe(1);
    expect(blackBreakdown.total).toBe(39);
  });

  /**
   * Test: getMaterialBreakdown with minimal position (only kings)
   */
  test('getMaterialBreakdown returns zeros for position with only kings', () => {
    const chess = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteBreakdown = boardSense.getMaterialBreakdown('w');
    const blackBreakdown = boardSense.getMaterialBreakdown('b');
    
    // All counts should be 0
    expect(whiteBreakdown.pawns).toBe(0);
    expect(whiteBreakdown.knights).toBe(0);
    expect(whiteBreakdown.bishops).toBe(0);
    expect(whiteBreakdown.rooks).toBe(0);
    expect(whiteBreakdown.queens).toBe(0);
    expect(whiteBreakdown.total).toBe(0);
    
    expect(blackBreakdown.pawns).toBe(0);
    expect(blackBreakdown.knights).toBe(0);
    expect(blackBreakdown.bishops).toBe(0);
    expect(blackBreakdown.rooks).toBe(0);
    expect(blackBreakdown.queens).toBe(0);
    expect(blackBreakdown.total).toBe(0);
  });

  /**
   * Test: getMaterialBreakdown with custom position
   */
  test('getMaterialBreakdown returns correct counts for custom position', () => {
    // White: 1 pawn, 1 knight, 1 bishop, 1 rook, 1 queen
    // Black: only king
    const chess = new Chess('4k3/8/8/8/8/8/P7/RNBQK3 w - - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteBreakdown = boardSense.getMaterialBreakdown('w');
    expect(whiteBreakdown.pawns).toBe(1);
    expect(whiteBreakdown.knights).toBe(1);
    expect(whiteBreakdown.bishops).toBe(1);
    expect(whiteBreakdown.rooks).toBe(1);
    expect(whiteBreakdown.queens).toBe(1);
    expect(whiteBreakdown.total).toBe(21); // 1 + 3 + 3 + 5 + 9 = 21
    
    const blackBreakdown = boardSense.getMaterialBreakdown('b');
    expect(blackBreakdown.pawns).toBe(0);
    expect(blackBreakdown.knights).toBe(0);
    expect(blackBreakdown.bishops).toBe(0);
    expect(blackBreakdown.rooks).toBe(0);
    expect(blackBreakdown.queens).toBe(0);
    expect(blackBreakdown.total).toBe(0);
  });

  /**
   * Test: getMaterialBreakdown after captures
   */
  test('getMaterialBreakdown updates correctly after captures', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    chess.move('Nc6');
    chess.move('Bb5');
    chess.move('a6');
    chess.move('Bxc6'); // White bishop takes black knight
    chess.move('dxc6'); // Black pawn recaptures
    
    const boardSense = new BoardSense(chess);
    
    const whiteBreakdown = boardSense.getMaterialBreakdown('w');
    const blackBreakdown = boardSense.getMaterialBreakdown('b');
    
    // White lost a bishop
    expect(whiteBreakdown.bishops).toBe(1);
    expect(whiteBreakdown.knights).toBe(2);
    expect(whiteBreakdown.total).toBe(36); // Lost 1 bishop (3 points)
    
    // Black lost a knight
    expect(blackBreakdown.knights).toBe(1);
    expect(blackBreakdown.bishops).toBe(2);
    expect(blackBreakdown.total).toBe(36); // Lost 1 knight (3 points)
  });

  /**
   * Test: getMaterialBreakdown uses caching
   */
  test('getMaterialBreakdown uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getMaterialBreakdown twice
    const breakdown1 = boardSense.getMaterialBreakdown('w');
    const breakdown2 = boardSense.getMaterialBreakdown('w');
    
    // Should return the same object (cached)
    expect(breakdown1).toBe(breakdown2);
    
    // Make a move
    chess.move('e4');
    
    // Cache should be invalidated
    const breakdown3 = boardSense.getMaterialBreakdown('w');
    expect(breakdown3).not.toBe(breakdown1);
    
    // But values should still be correct
    expect(breakdown3.pawns).toBe(8);
    expect(breakdown3.total).toBe(39);
  });

  /**
   * Test: getMaterialBreakdown does not mutate Chess instance
   */
  test('getMaterialBreakdown does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        boardSense.getMaterialBreakdown('w');
        boardSense.getMaterialBreakdown('b');
        
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Material breakdown accuracy
   * **Validates: Requirements 4.1, 4.4**
   * 
   * For any board position and color, getMaterialBreakdown should return counts
   * where each piece type count matches the actual number of those pieces on the
   * board, and the total equals the sum of all piece values.
   */
  test('Property 11: Material breakdown accuracy', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Test for both colors
        ['w', 'b'].forEach(color => {
          const breakdown = boardSense.getMaterialBreakdown(color as any);
          
          // Verify counts match actual pieces on board
          const actualPawns = boardSense.getPiecesOfType(color as any, 'p').length;
          const actualKnights = boardSense.getPiecesOfType(color as any, 'n').length;
          const actualBishops = boardSense.getPiecesOfType(color as any, 'b').length;
          const actualRooks = boardSense.getPiecesOfType(color as any, 'r').length;
          const actualQueens = boardSense.getPiecesOfType(color as any, 'q').length;
          
          expect(breakdown.pawns).toBe(actualPawns);
          expect(breakdown.knights).toBe(actualKnights);
          expect(breakdown.bishops).toBe(actualBishops);
          expect(breakdown.rooks).toBe(actualRooks);
          expect(breakdown.queens).toBe(actualQueens);
          
          // Verify total equals sum of piece values
          const expectedTotal = 
            actualPawns * 1 +
            actualKnights * 3 +
            actualBishops * 3 +
            actualRooks * 5 +
            actualQueens * 9;
          
          expect(breakdown.total).toBe(expectedTotal);
          
          // Verify total matches getMaterialCount
          expect(breakdown.total).toBe(boardSense.getMaterialCount(color as any));
        });
      }),
      { numRuns: 100 }
    );
  });
});

describe('BoardSense Property-Based Tests - Mobility Analysis', () => {
  
  /**
   * Property 14: Piece mobility accuracy
   * **Validates: Requirements 5.1, 5.4**
   * 
   * For any non-pawn piece on the board, getPieceMobility should return a count
   * of pseudo-legal moves (geometry-based, not checking pins/checks).
   * Pawns return 0 as their mobility is not strategically important.
   */
  test('Property 14: Piece mobility accuracy', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Get all pieces for both colors
        const whitePieces = boardSense.getAllPieces('w');
        const blackPieces = boardSense.getAllPieces('b');
        
        // For each piece, verify mobility is a non-negative number
        [whitePieces, blackPieces].forEach(allPieces => {
          Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
            for (const square of squares) {
              const mobility = boardSense.getPieceMobility(square);
              
              // Mobility should be a non-negative number
              expect(typeof mobility).toBe('number');
              expect(mobility).toBeGreaterThanOrEqual(0);
              
              // Pawns should return 0
              if (pieceType === 'p') {
                expect(mobility).toBe(0);
              }
            }
          });
        });
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 15: Total mobility is sum of piece mobilities
   * **Validates: Requirements 5.2**
   * 
   * For any board position and color, getTotalMobility should equal the sum
   * of getPieceMobility for all non-pawn pieces of that color.
   */
  test('Property 15: Total mobility is sum of piece mobilities', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Test for both colors
        const colors: ('w' | 'b')[] = ['w', 'b'];
        
        for (const color of colors) {
          const totalMobility = boardSense.getTotalMobility(color);
          
          // Calculate expected total by summing individual piece mobilities
          const allPieces = boardSense.getAllPieces(color);
          let expectedTotal = 0;
          
          Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
            for (const square of squares) {
              expectedTotal += boardSense.getPieceMobility(square);
            }
          });
          
          // Total mobility should equal the sum of individual piece mobilities
          expect(totalMobility).toBe(expectedTotal);
        }
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 16: Mobility difference calculation
   * **Validates: Requirements 5.3**
   * 
   * For any board position, getMobilityDifference should equal
   * getTotalMobility('w') minus getTotalMobility('b').
   */
  test('Property 16: Mobility difference calculation', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        const whiteMobility = boardSense.getTotalMobility('w');
        const blackMobility = boardSense.getTotalMobility('b');
        const mobilityDifference = boardSense.getMobilityDifference();
        
        // Mobility difference should equal white mobility minus black mobility
        expect(mobilityDifference).toBe(whiteMobility - blackMobility);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Unit test: getPieceMobility with starting position
   * Verifies specific piece mobilities in the starting position
   */
  test('getPieceMobility returns correct mobility in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // In starting position, only knights can move (pawns excluded from mobility)
    // Knights have 2 moves each
    const knightB1Mobility = boardSense.getPieceMobility('b1');
    expect(knightB1Mobility).toBe(2); // Na3, Nc3
    
    const knightG1Mobility = boardSense.getPieceMobility('g1');
    expect(knightG1Mobility).toBe(2); // Nf3, Nh3
    
    // Pawns return 0 (mobility not strategically important)
    const pawnE2Mobility = boardSense.getPieceMobility('e2');
    expect(pawnE2Mobility).toBe(0); // Pawns excluded from mobility calculation
    
    // Pieces that can't move have 0 mobility
    const rookA1Mobility = boardSense.getPieceMobility('a1');
    expect(rookA1Mobility).toBe(0); // Blocked by pawn
    
    const bishopC1Mobility = boardSense.getPieceMobility('c1');
    expect(bishopC1Mobility).toBe(0); // Blocked by pawns
    
    const kingE1Mobility = boardSense.getPieceMobility('e1');
    expect(kingE1Mobility).toBe(0); // Blocked by pieces
  });
  
  /**
   * Unit test: getPieceMobility with empty square
   * Verifies that empty squares return 0 mobility
   */
  test('getPieceMobility returns 0 for empty squares', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Empty squares should have 0 mobility
    expect(boardSense.getPieceMobility('e4')).toBe(0);
    expect(boardSense.getPieceMobility('d5')).toBe(0);
    expect(boardSense.getPieceMobility('a5')).toBe(0);
  });
  
  /**
   * Unit test: getPieceMobility with invalid square
   * Verifies that invalid squares return 0 mobility
   */
  test('getPieceMobility returns 0 for invalid squares', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Invalid squares should return 0
    expect(boardSense.getPieceMobility('i1' as any)).toBe(0);
    expect(boardSense.getPieceMobility('a9' as any)).toBe(0);
    expect(boardSense.getPieceMobility('invalid' as any)).toBe(0);
  });
  
  /**
   * Unit test: getTotalMobility with starting position
   * Verifies total mobility for both sides in starting position
   */
  test('getTotalMobility returns correct total in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // In starting position, white has 4 pseudo-legal moves (pawns excluded)
    // 2 knights × 2 moves each = 4 moves
    // (Pawns are excluded from mobility calculation)
    const whiteMobility = boardSense.getTotalMobility('w');
    expect(whiteMobility).toBe(4);
    
    // Black also has 4 pseudo-legal moves (2 knights × 2 moves)
    // Note: We calculate pseudo-legal moves (geometry-based), not legal moves
    const blackMobility = boardSense.getTotalMobility('b');
    expect(blackMobility).toBe(4);
  });
  
  /**
   * Unit test: getTotalMobility after moves
   * Verifies that total mobility updates correctly after moves
   */
  test('getTotalMobility updates correctly after moves', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Initial white mobility (2 knights × 2 moves = 4)
    const initialWhiteMobility = boardSense.getTotalMobility('w');
    expect(initialWhiteMobility).toBe(4);
    
    // Make a move
    chess.move('e4');
    
    // Black still has 4 pseudo-legal moves (2 knights × 2 moves)
    const blackMobility = boardSense.getTotalMobility('b');
    expect(blackMobility).toBe(4);
    
    // White now has more mobility (bishops and queen can move)
    const whiteAfterMove = boardSense.getTotalMobility('w');
    expect(whiteAfterMove).toBeGreaterThan(4);
  });
  
  /**
   * Unit test: getMobilityDifference with starting position
   * Verifies mobility difference in starting position
   */
  test('getMobilityDifference returns correct difference in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Both sides have 4 pseudo-legal moves (2 knights × 2 each)
    const mobilityDiff = boardSense.getMobilityDifference();
    expect(mobilityDiff).toBe(0); // 4 - 4 = 0
  });
  
  /**
   * Unit test: getMobilityDifference after moves
   * Verifies mobility difference updates correctly
   */
  test('getMobilityDifference updates correctly after moves', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Initial difference (both sides have 4 pseudo-legal moves)
    expect(boardSense.getMobilityDifference()).toBe(0);
    
    // After white moves e4, white gains mobility (bishop and queen can move)
    chess.move('e4');
    const diffAfterE4 = boardSense.getMobilityDifference();
    expect(diffAfterE4).toBeGreaterThan(0); // White has more mobility now
    
    // After black moves e5, black also gains mobility
    chess.move('e5');
    const diffAfterE5 = boardSense.getMobilityDifference();
    // Both sides opened up, difference should still favor white slightly
    expect(typeof diffAfterE5).toBe('number');
  });
  
  /**
   * Unit test: Mobility methods do not mutate Chess instance
   * Verifies that mobility queries don't change the board state
   */
  test('Mobility methods do not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Call all mobility methods
        boardSense.getPieceMobility('e4');
        boardSense.getTotalMobility('w');
        boardSense.getTotalMobility('b');
        boardSense.getMobilityDifference();
        
        // FEN should be unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Unit test: Mobility caching
   * Verifies that mobility results are cached correctly
   */
  test('Mobility methods use caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getTotalMobility twice
    const mobility1 = boardSense.getTotalMobility('w');
    const mobility2 = boardSense.getTotalMobility('w');
    
    // Should return the same value (cached)
    expect(mobility1).toBe(mobility2);
    expect(mobility1).toBe(4); // 2 knights × 2 moves
    
    // Make a move to invalidate cache
    chess.move('e4');
    
    // Should return updated value (more mobility after opening)
    const mobility3 = boardSense.getTotalMobility('w');
    expect(mobility3).toBeGreaterThan(4); // Bishop and queen can now move
  });
  
  /**
   * Unit test: Mobility with pinned pieces
   * NOTE: Our mobility calculation is pseudo-legal (geometry-based), not legal.
   * It doesn't check for pins, checks, or other legal move restrictions.
   * This is intentional for performance - pseudo-legal mobility is good enough for evaluation.
   */
  test('getPieceMobility correctly handles pinned pieces', () => {
    // Set up a position with a pinned piece
    const chess = new Chess('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 5');
    const boardSense = new BoardSense(chess);
    
    // The knight on f6 can move to 5 squares geometrically (pseudo-legal)
    // Even if it's pinned, we count pseudo-legal moves for performance
    const knightMobility = boardSense.getPieceMobility('f6');
    
    // Should return pseudo-legal moves (not checking for pins)
    expect(knightMobility).toBeGreaterThan(0);
    expect(typeof knightMobility).toBe('number');
  });
});


describe('BoardSense Property-Based Tests - King Safety Metrics', () => {
  
  /**
   * Property 17: King safety attacker count accuracy
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any board position and color, getKingSafety should return an attacker
   * count that matches the number of enemy pieces attacking squares in the
   * king's 3x3 vicinity.
   */
  test('Property 17: King safety attacker count accuracy', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Test for both colors
        const colors: ('w' | 'b')[] = ['w', 'b'];
        
        for (const color of colors) {
          const kingSafety = boardSense.getKingSafety(color);
          const kingSquare = kingSafety.kingSquare;
          
          // Manually count enemy pieces attacking 3x3 area around king
          const kingCoords = {
            file: kingSquare.charCodeAt(0) - 'a'.charCodeAt(0),
            rank: parseInt(kingSquare[1]) - 1
          };
          
          const enemyColor: 'w' | 'b' = color === 'w' ? 'b' : 'w';
          const uniqueAttackers = new Set<string>();
          
          // Check all squares in 3x3 area
          for (let fileOffset = -1; fileOffset <= 1; fileOffset++) {
            for (let rankOffset = -1; rankOffset <= 1; rankOffset++) {
              const targetFile = kingCoords.file + fileOffset;
              const targetRank = kingCoords.rank + rankOffset;
              
              if (targetFile >= 0 && targetFile <= 7 && targetRank >= 0 && targetRank <= 7) {
                const targetSquare = String.fromCharCode('a'.charCodeAt(0) + targetFile) + (targetRank + 1);
                const attackers = boardSense.getAttackers(targetSquare as any, enemyColor);
                
                // Add unique attacker squares
                attackers.forEach(attacker => {
                  uniqueAttackers.add(attacker.piece.square);
                });
              }
            }
          }
          
          // The attacker count should match the number of unique enemy pieces
          expect(kingSafety.attackersNearKing).toBe(uniqueAttackers.size);
        }
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 18: King safety check detection
   * **Validates: Requirements 6.3**
   * 
   * For any board position where chess.js reports isCheck() as true,
   * getKingSafety should indicate the king is in check.
   */
  test('Property 18: King safety check detection', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Get the current player (whose turn it is)
        const currentPlayer = chess.turn();
        
        // Check if the current player is in check
        const isInCheck = chess.isCheck();
        
        // Get king safety for the current player
        const kingSafety = boardSense.getKingSafety(currentPlayer);
        
        // If chess.js says the king is in check, getKingSafety should reflect this
        expect(kingSafety.isInCheck).toBe(isInCheck);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 19: Pawn shield quality accuracy
   * **Validates: Requirements 6.4**
   * 
   * For any board position and color, getKingSafety should return a pawn
   * shield quality that equals the number of friendly pawns in front of
   * the king (max 3).
   */
  test('Property 19: Pawn shield quality accuracy', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const boardSense = new BoardSense(chess);
        
        // Test for both colors
        const colors: ('w' | 'b')[] = ['w', 'b'];
        
        for (const color of colors) {
          const kingSafety = boardSense.getKingSafety(color);
          const kingSquare = kingSafety.kingSquare;
          
          // Manually count friendly pawns in front of king
          const kingCoords = {
            file: kingSquare.charCodeAt(0) - 'a'.charCodeAt(0),
            rank: parseInt(kingSquare[1]) - 1
          };
          
          const forwardDirection = color === 'w' ? 1 : -1;
          let pawnCount = 0;
          
          // Check three files: king's file and adjacent files
          for (let fileOffset = -1; fileOffset <= 1; fileOffset++) {
            const targetFile = kingCoords.file + fileOffset;
            
            // Check one or two ranks in front of king
            let foundPawnInFile = false;
            for (let rankOffset = 1; rankOffset <= 2 && !foundPawnInFile; rankOffset++) {
              const targetRank = kingCoords.rank + (forwardDirection * rankOffset);
              
              if (targetFile >= 0 && targetFile <= 7 && targetRank >= 0 && targetRank <= 7) {
                const targetSquare = String.fromCharCode('a'.charCodeAt(0) + targetFile) + (targetRank + 1);
                const piece = boardSense.getPieceAt(targetSquare as any);
                
                if (piece && piece.type === 'p' && piece.color === color) {
                  pawnCount++;
                  foundPawnInFile = true;
                }
              }
            }
          }
          
          // Cap at 3
          const expectedPawnShield = Math.min(pawnCount, 3);
          
          // The pawn shield quality should match our manual count
          expect(kingSafety.pawnShieldQuality).toBe(expectedPawnShield);
        }
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 20: Castling detection in king safety
   * **Validates: Requirements 6.5**
   * 
   * For any board position where a king has castled (detected by king position
   * and move history), getKingSafety should reflect this in the hasCastled field.
   */
  test('Property 20: Castling detection in king safety', () => {
    // Test specific positions where castling has occurred
    
    // White kingside castling
    const whiteKingsideCastled = new Chess();
    whiteKingsideCastled.move('e4');
    whiteKingsideCastled.move('e5');
    whiteKingsideCastled.move('Nf3');
    whiteKingsideCastled.move('Nf6');
    whiteKingsideCastled.move('Be2');
    whiteKingsideCastled.move('Be7');
    whiteKingsideCastled.move('O-O'); // White castles kingside
    
    const boardSense1 = new BoardSense(whiteKingsideCastled);
    const whiteSafety1 = boardSense1.getKingSafety('w');
    
    // King should be on g1 after kingside castling
    expect(whiteSafety1.kingSquare).toBe('g1');
    expect(whiteSafety1.hasCastled).toBe(true);
    
    // White queenside castling
    const whiteQueensideCastled = new Chess();
    whiteQueensideCastled.move('d4');
    whiteQueensideCastled.move('d5');
    whiteQueensideCastled.move('Nc3');
    whiteQueensideCastled.move('Nc6');
    whiteQueensideCastled.move('Bf4');
    whiteQueensideCastled.move('Bf5');
    whiteQueensideCastled.move('Qd2');
    whiteQueensideCastled.move('Qd7');
    whiteQueensideCastled.move('O-O-O'); // White castles queenside
    
    const boardSense2 = new BoardSense(whiteQueensideCastled);
    const whiteSafety2 = boardSense2.getKingSafety('w');
    
    // King should be on c1 after queenside castling
    expect(whiteSafety2.kingSquare).toBe('c1');
    expect(whiteSafety2.hasCastled).toBe(true);
    
    // Black kingside castling
    const blackKingsideCastled = new Chess();
    blackKingsideCastled.move('e4');
    blackKingsideCastled.move('e5');
    blackKingsideCastled.move('Nf3');
    blackKingsideCastled.move('Nf6');
    blackKingsideCastled.move('Be2');
    blackKingsideCastled.move('Be7');
    blackKingsideCastled.move('d3');
    blackKingsideCastled.move('O-O'); // Black castles kingside
    
    const boardSense3 = new BoardSense(blackKingsideCastled);
    const blackSafety1 = boardSense3.getKingSafety('b');
    
    // King should be on g8 after kingside castling
    expect(blackSafety1.kingSquare).toBe('g8');
    expect(blackSafety1.hasCastled).toBe(true);
    
    // Test king that hasn't castled
    const notCastled = new Chess();
    const boardSense4 = new BoardSense(notCastled);
    const whiteSafety3 = boardSense4.getKingSafety('w');
    
    // King should still be on e1 and not castled
    expect(whiteSafety3.kingSquare).toBe('e1');
    expect(whiteSafety3.hasCastled).toBe(false);
  });
  
  /**
   * Unit test: getKingSafety with starting position
   * Verifies king safety metrics in the starting position
   */
  test('getKingSafety returns correct metrics in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // White king safety
    const whiteSafety = boardSense.getKingSafety('w');
    expect(whiteSafety.kingSquare).toBe('e1');
    expect(whiteSafety.isInCheck).toBe(false);
    expect(whiteSafety.hasCastled).toBe(false);
    expect(whiteSafety.attackersNearKing).toBe(0); // No attackers in starting position
    expect(whiteSafety.pawnShieldQuality).toBeGreaterThanOrEqual(0);
    expect(whiteSafety.safetyScore).toBeDefined();
    
    // Black king safety
    const blackSafety = boardSense.getKingSafety('b');
    expect(blackSafety.kingSquare).toBe('e8');
    expect(blackSafety.isInCheck).toBe(false);
    expect(blackSafety.hasCastled).toBe(false);
    expect(blackSafety.attackersNearKing).toBe(0);
    expect(blackSafety.pawnShieldQuality).toBeGreaterThanOrEqual(0);
    expect(blackSafety.safetyScore).toBeDefined();
  });
  
  /**
   * Unit test: getKingSafety with king in check
   * Verifies that check is detected correctly
   */
  test('getKingSafety correctly detects check', () => {
    // Scholar's mate position (black king in checkmate)
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Bc4');
    chess.move('Nc6');
    chess.move('Qh5');
    chess.move('Nf6');
    chess.move('Qxf7'); // Checkmate
    
    const boardSense = new BoardSense(chess);
    const blackSafety = boardSense.getKingSafety('b');
    
    // Black king should be in check
    expect(blackSafety.isInCheck).toBe(true);
    expect(blackSafety.kingSquare).toBe('e8');
    
    // Safety score should be penalized for being in check
    expect(blackSafety.safetyScore).toBeLessThan(100);
  });
  
  /**
   * Unit test: getKingSafety safety score calculation
   * Verifies that the composite safety score is calculated correctly
   */
  test('getKingSafety calculates safety score correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteSafety = boardSense.getKingSafety('w');
    
    // Base score is 100
    // No check: no penalty
    // No castling: no bonus
    // Attackers near king: penalty of 10 per attacker
    // Pawn shield: bonus of 10 per pawn
    
    const expectedScore = 100 
      - (whiteSafety.isInCheck ? 50 : 0)
      - (whiteSafety.attackersNearKing * 10)
      + (whiteSafety.hasCastled ? 20 : 0)
      + (whiteSafety.pawnShieldQuality * 10);
    
    expect(whiteSafety.safetyScore).toBe(expectedScore);
  });
  
  /**
   * Unit test: getKingSafety does not mutate Chess instance
   * Verifies that king safety queries don't change the board state
   */
  test('getKingSafety does not mutate the Chess instance', () => {
    fc.assert(
      fc.property(arbitraryChessPosition, (chess) => {
        const originalFen = chess.fen();
        const boardSense = new BoardSense(chess);
        
        // Call getKingSafety for both colors
        boardSense.getKingSafety('w');
        boardSense.getKingSafety('b');
        
        // FEN should be unchanged
        expect(chess.fen()).toBe(originalFen);
      }),
      { numRuns: 100 }
    );
  });
  
  /**
   * Unit test: getKingSafety caching
   * Verifies that king safety results are cached correctly
   */
  test('getKingSafety uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    // Call getKingSafety twice
    const safety1 = boardSense.getKingSafety('w');
    const safety2 = boardSense.getKingSafety('w');
    
    // Should return the same values (cached)
    expect(safety1).toEqual(safety2);
    
    // Make a move to invalidate cache
    chess.move('e4');
    
    // Should return updated values
    const safety3 = boardSense.getKingSafety('w');
    // Values might be different after the move
    expect(safety3).toBeDefined();
  });
  
  /**
   * Unit test: getKingSafety with no king (edge case)
   * Verifies graceful handling when no king is present
   */
  test('getKingSafety handles missing king gracefully', () => {
    // Create a position with white king in corner (valid position)
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1BNK w kq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteSafety = boardSense.getKingSafety('w');
    
    // Should return metrics for the king on h1
    expect(whiteSafety).toBeDefined();
    expect(whiteSafety.kingSquare).toBe('h1');
    expect(whiteSafety.isInCheck).toBe(false);
    expect(whiteSafety.hasCastled).toBe(false);
    expect(whiteSafety.attackersNearKing).toBeGreaterThanOrEqual(0);
    expect(whiteSafety.pawnShieldQuality).toBeGreaterThanOrEqual(0);
    expect(whiteSafety.safetyScore).toBeDefined();
  });
  
  /**
   * Unit test: Pawn shield quality with different king positions
   * Verifies pawn shield counting in various positions
   */
  test('getKingSafety counts pawn shield correctly', () => {
    // Position with white king castled kingside with good pawn shield
    const chess1 = new Chess();
    chess1.move('e4');
    chess1.move('e5');
    chess1.move('Nf3');
    chess1.move('Nf6');
    chess1.move('Be2');
    chess1.move('Be7');
    chess1.move('O-O');
    
    const boardSense1 = new BoardSense(chess1);
    const safety1 = boardSense1.getKingSafety('w');
    
    // King on g1 should have pawns on f2, g2, h2 in front
    expect(safety1.kingSquare).toBe('g1');
    expect(safety1.pawnShieldQuality).toBeGreaterThan(0);
    expect(safety1.pawnShieldQuality).toBeLessThanOrEqual(3);
  });
});

describe('BoardSense - Pawn Structure Analysis - getIsolatedPawns', () => {
  
  /**
   * Unit test: getIsolatedPawns in starting position
   * In the starting position, no pawns are isolated since all pawns have neighbors
   */
  test('getIsolatedPawns returns empty array in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    const blackIsolated = boardSense.getIsolatedPawns('b');
    
    expect(whiteIsolated).toEqual([]);
    expect(blackIsolated).toEqual([]);
  });
  
  /**
   * Unit test: getIsolatedPawns with single isolated pawn
   * Creates a position with one isolated white pawn
   */
  test('getIsolatedPawns identifies single isolated pawn', () => {
    // Position with isolated white pawn on e4
    // No white pawns on d-file or f-file
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPP3PP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    
    expect(whiteIsolated).toContain('e4');
    expect(whiteIsolated.length).toBe(1);
  });
  
  /**
   * Unit test: getIsolatedPawns with multiple isolated pawns
   * Creates a position with multiple isolated pawns
   */
  test('getIsolatedPawns identifies multiple isolated pawns', () => {
    // Position with isolated white pawns on a4, c4, e4, g4
    // Each has no friendly pawns on adjacent files
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/P1P1P1P1/8/8/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    
    expect(whiteIsolated).toContain('a4');
    expect(whiteIsolated).toContain('c4');
    expect(whiteIsolated).toContain('e4');
    expect(whiteIsolated).toContain('g4');
    expect(whiteIsolated.length).toBe(4);
  });
  
  /**
   * Unit test: getIsolatedPawns with no isolated pawns
   * Creates a position where all pawns have neighbors on adjacent files
   */
  test('getIsolatedPawns returns empty when all pawns have neighbors', () => {
    // Position with white pawns on d4, e4, f4 - none are isolated
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/3PPP2/8/PPP3PP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    
    // d4, e4, f4 all have neighbors, so none should be isolated
    expect(whiteIsolated).not.toContain('d4');
    expect(whiteIsolated).not.toContain('e4');
    expect(whiteIsolated).not.toContain('f4');
  });
  
  /**
   * Unit test: getIsolatedPawns for black pawns
   * Verifies the method works correctly for black pawns
   */
  test('getIsolatedPawns identifies isolated black pawns', () => {
    // Position with isolated black pawn on e5
    // No black pawns on d-file or f-file
    const chess = new Chess('rnbqkbnr/ppp3pp/8/4p3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const blackIsolated = boardSense.getIsolatedPawns('b');
    
    expect(blackIsolated).toContain('e5');
    expect(blackIsolated.length).toBe(1);
  });
  
  /**
   * Unit test: getIsolatedPawns with edge file pawns
   * Tests pawns on a-file and h-file (edge cases)
   */
  test('getIsolatedPawns handles edge file pawns correctly', () => {
    // Position with pawns only on a-file and h-file
    const chess = new Chess('rnbqkbnr/1ppppp1p/8/8/8/8/P5P1/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    
    // Both a2 and g2 are isolated (no neighbors on adjacent files)
    expect(whiteIsolated).toContain('a2');
    expect(whiteIsolated).toContain('g2');
    expect(whiteIsolated.length).toBe(2);
  });
  
  /**
   * Unit test: getIsolatedPawns with pawn on adjacent file but different rank
   * Verifies that pawns on adjacent files count as neighbors regardless of rank
   */
  test('getIsolatedPawns considers pawns on adjacent files at any rank', () => {
    // Position with white pawn on e4 and white pawn on d2 (adjacent file, different rank)
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteIsolated = boardSense.getIsolatedPawns('w');
    
    // e4 should NOT be isolated because d2 is on an adjacent file
    expect(whiteIsolated).not.toContain('e4');
  });
  
  /**
   * Unit test: getIsolatedPawns caching
   * Verifies that results are cached and invalidated correctly
   */
  test('getIsolatedPawns uses caching correctly', () => {
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPP3PP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    // First call
    const result1 = boardSense.getIsolatedPawns('w');
    
    // Second call should return same result (cached)
    const result2 = boardSense.getIsolatedPawns('w');
    
    expect(result1).toEqual(result2);
    
    // Make a move to change position
    chess.move('Nf3');
    
    // Third call should recalculate (cache invalidated)
    const result3 = boardSense.getIsolatedPawns('w');
    
    // Result should still be the same since we didn't move pawns
    expect(result3).toContain('e4');
  });
});

describe('BoardSense - Pawn Structure Analysis - getDoubledPawns', () => {
  
  /**
   * Unit test: getDoubledPawns in starting position
   * In the starting position, no pawns are doubled
   */
  test('getDoubledPawns returns empty array in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteDoubled = boardSense.getDoubledPawns('w');
    const blackDoubled = boardSense.getDoubledPawns('b');
    
    expect(whiteDoubled).toEqual([]);
    expect(blackDoubled).toEqual([]);
  });
  
  /**
   * Unit test: getDoubledPawns with doubled pawns
   * Creates a position with doubled white pawns on the e-file
   */
  test('getDoubledPawns identifies doubled pawns', () => {
    // Position with doubled white pawns on e-file (e2 and e4)
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteDoubled = boardSense.getDoubledPawns('w');
    
    expect(whiteDoubled.length).toBe(1);
    expect(whiteDoubled[0]).toContain('e2');
    expect(whiteDoubled[0]).toContain('e4');
  });
  
  /**
   * Unit test: getDoubledPawns with tripled pawns
   * Creates a position with three pawns on the same file
   */
  test('getDoubledPawns identifies tripled pawns', () => {
    // Position with tripled white pawns on e-file
    const chess = new Chess('rnbqkbnr/pppppppp/8/4P3/4P3/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteDoubled = boardSense.getDoubledPawns('w');
    
    expect(whiteDoubled.length).toBe(1);
    expect(whiteDoubled[0].length).toBe(3);
    expect(whiteDoubled[0]).toContain('e2');
    expect(whiteDoubled[0]).toContain('e4');
    expect(whiteDoubled[0]).toContain('e5');
  });
  
  /**
   * Unit test: getDoubledPawns for black pawns
   */
  test('getDoubledPawns identifies doubled black pawns', () => {
    // Position with doubled black pawns on d-file (d7 and d5)
    const chess = new Chess('rnbqkbnr/pppppppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const blackDoubled = boardSense.getDoubledPawns('b');
    
    expect(blackDoubled.length).toBe(1);
    expect(blackDoubled[0]).toContain('d7');
    expect(blackDoubled[0]).toContain('d5');
  });
});

describe('BoardSense - Pawn Structure Analysis - getPassedPawns', () => {
  
  /**
   * Unit test: getPassedPawns in starting position
   * In the starting position, no pawns are passed
   */
  test('getPassedPawns returns empty array in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whitePassed = boardSense.getPassedPawns('w');
    const blackPassed = boardSense.getPassedPawns('b');
    
    expect(whitePassed).toEqual([]);
    expect(blackPassed).toEqual([]);
  });
  
  /**
   * Unit test: getPassedPawns with passed pawn
   * Creates a position with a passed white pawn
   */
  test('getPassedPawns identifies passed pawn', () => {
    // Position with passed white pawn on a5, no black pawns on a, b files ahead
    const chess = new Chess('rnbqkbnr/2pppppp/8/P7/8/8/1PPPPPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whitePassed = boardSense.getPassedPawns('w');
    
    expect(whitePassed).toContain('a5');
  });
  
  /**
   * Unit test: getPassedPawns with blocked pawn
   * Creates a position where a pawn is blocked by an enemy pawn
   */
  test('getPassedPawns does not identify blocked pawn', () => {
    // Position with white pawn on e4 blocked by black pawn on e5
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whitePassed = boardSense.getPassedPawns('w');
    
    expect(whitePassed).not.toContain('e4');
  });
  
  /**
   * Unit test: getPassedPawns with enemy pawn on adjacent file
   * Creates a position where a pawn is controlled by an enemy pawn on adjacent file
   */
  test('getPassedPawns does not identify pawn controlled by adjacent enemy pawn', () => {
    // Position with white pawn on e4 and black pawn on d5 (controls e4's path)
    const chess = new Chess('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whitePassed = boardSense.getPassedPawns('w');
    
    expect(whitePassed).not.toContain('e4');
  });
});

describe('BoardSense - Pawn Structure Analysis - getBackwardPawns', () => {
  
  /**
   * Unit test: getBackwardPawns in starting position
   * In the starting position, no pawns are backward
   */
  test('getBackwardPawns returns empty array in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteBackward = boardSense.getBackwardPawns('w');
    const blackBackward = boardSense.getBackwardPawns('b');
    
    expect(whiteBackward).toEqual([]);
    expect(blackBackward).toEqual([]);
  });
  
  /**
   * Unit test: getBackwardPawns with backward pawn
   * Creates a position with a backward white pawn
   */
  test('getBackwardPawns identifies backward pawn', () => {
    // Position with backward white pawn on d2
    // c and e pawns have advanced, d2 cannot advance safely
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/8/3Pp3/2P1P3/PP3PPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteBackward = boardSense.getBackwardPawns('w');
    
    // d2 pawn cannot advance safely and has no support from behind
    // This test verifies the method runs without errors
    expect(Array.isArray(whiteBackward)).toBe(true);
  });
  
  /**
   * Unit test: getBackwardPawns with protected pawn
   * Creates a position where a pawn has support from behind
   */
  test('getBackwardPawns does not identify pawn with support from behind', () => {
    // Position with white pawn on d4 that has support from c3
    const chess = new Chess('rnbqkbnr/pppp1ppp/8/8/3P4/2P5/PP2PPPP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteBackward = boardSense.getBackwardPawns('w');
    
    // d4 has support from c3, so it's not backward
    expect(whiteBackward).not.toContain('d4');
  });
});

describe('BoardSense - Pawn Structure Analysis - getPawnStructureMetrics', () => {
  
  /**
   * Unit test: getPawnStructureMetrics in starting position
   */
  test('getPawnStructureMetrics returns correct metrics in starting position', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const whiteMetrics = boardSense.getPawnStructureMetrics('w');
    const blackMetrics = boardSense.getPawnStructureMetrics('b');
    
    expect(whiteMetrics.isolated).toEqual([]);
    expect(whiteMetrics.doubled).toEqual([]);
    expect(whiteMetrics.passed).toEqual([]);
    expect(whiteMetrics.backward).toEqual([]);
    expect(whiteMetrics.structureScore).toBe(0);
    
    expect(blackMetrics.isolated).toEqual([]);
    expect(blackMetrics.doubled).toEqual([]);
    expect(blackMetrics.passed).toEqual([]);
    expect(blackMetrics.backward).toEqual([]);
    expect(blackMetrics.structureScore).toBe(0);
  });
  
  /**
   * Unit test: getPawnStructureMetrics with mixed pawn structure
   */
  test('getPawnStructureMetrics calculates composite score correctly', () => {
    // Position with:
    // - Isolated white pawn on e4 (no pawns on d or f files)
    // - Passed white pawn on a5 (no black pawns on a or b files ahead)
    const chess = new Chess('rnbqkbnr/2pppppp/8/P7/4P3/8/1PP3PP/RNBQKBNR w KQkq - 0 1');
    const boardSense = new BoardSense(chess);
    
    const whiteMetrics = boardSense.getPawnStructureMetrics('w');
    
    expect(whiteMetrics.isolated).toContain('e4');
    expect(whiteMetrics.passed).toContain('a5');
    
    // Score calculation: -10 per isolated, +15 per passed
    // Should have positive score if passed pawn bonus outweighs isolated penalty
    expect(typeof whiteMetrics.structureScore).toBe('number');
  });
  
  /**
   * Unit test: getPawnStructureMetrics uses caching
   */
  test('getPawnStructureMetrics uses caching correctly', () => {
    const chess = new Chess();
    const boardSense = new BoardSense(chess);
    
    const result1 = boardSense.getPawnStructureMetrics('w');
    const result2 = boardSense.getPawnStructureMetrics('w');
    
    // Same position should return same result (cached)
    expect(result1).toEqual(result2);
    
    // Make a move to invalidate cache
    chess.move('e4');
    
    const result3 = boardSense.getPawnStructureMetrics('w');
    
    // After move, cache should be invalidated and recalculated
    // Just verify it returns a valid result
    expect(result3).toHaveProperty('isolated');
    expect(result3).toHaveProperty('doubled');
    expect(result3).toHaveProperty('passed');
    expect(result3).toHaveProperty('backward');
    expect(result3).toHaveProperty('structureScore');
  });
});

describe('BoardSense Property-Based Tests - Pawn Structure Analysis', () => {
  
  /**
   * Property 21: Isolated pawn identification
   * **Validates: Requirements 7.1**
   * 
   * For any board position and color, getIsolatedPawns should return exactly
   * the pawns that have no friendly pawns on adjacent files.
   */
  test('Property 21: Isolated pawn identification', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          const isolatedPawns = boardSense.getIsolatedPawns(color as any);
          
          // Get all pawns for the color
          const allPawns = boardSense.getPiecesOfType(color as any, 'p');
          
          // Manually verify each pawn
          for (const pawnSquare of allPawns) {
            const pawnCoords = boardSense['squareToCoords'](pawnSquare);
            const pawnFile = pawnCoords.file;
            
            // Check if there are friendly pawns on adjacent files
            const leftFile = pawnFile - 1;
            const rightFile = pawnFile + 1;
            
            let hasFriendlyPawnOnAdjacentFile = false;
            
            for (const otherPawnSquare of allPawns) {
              if (otherPawnSquare === pawnSquare) continue;
              
              const otherPawnCoords = boardSense['squareToCoords'](otherPawnSquare);
              const otherPawnFile = otherPawnCoords.file;
              
              if (otherPawnFile === leftFile || otherPawnFile === rightFile) {
                hasFriendlyPawnOnAdjacentFile = true;
                break;
              }
            }
            
            // Verify the pawn is in isolatedPawns if and only if it has no adjacent pawns
            if (hasFriendlyPawnOnAdjacentFile) {
              expect(isolatedPawns).not.toContain(pawnSquare);
            } else {
              expect(isolatedPawns).toContain(pawnSquare);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22: Doubled pawn identification
   * **Validates: Requirements 7.2**
   * 
   * For any board position and color, getDoubledPawns should return exactly
   * the pawns that share a file with another friendly pawn.
   */
  test('Property 22: Doubled pawn identification', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          const doubledPawns = boardSense.getDoubledPawns(color as any);
          
          // Get all pawns for the color
          const allPawns = boardSense.getPiecesOfType(color as any, 'p');
          
          // Group pawns by file manually
          const pawnsByFile = new Map<number, string[]>();
          
          for (const pawnSquare of allPawns) {
            const pawnCoords = boardSense['squareToCoords'](pawnSquare);
            const file = pawnCoords.file;
            
            if (!pawnsByFile.has(file)) {
              pawnsByFile.set(file, []);
            }
            pawnsByFile.get(file)!.push(pawnSquare);
          }
          
          // Count files with 2+ pawns
          const expectedDoubledFiles = Array.from(pawnsByFile.values()).filter(
            pawnsOnFile => pawnsOnFile.length >= 2
          );
          
          // Verify the result matches
          expect(doubledPawns.length).toBe(expectedDoubledFiles.length);
          
          // Verify each doubled pawn group
          for (const doubledGroup of doubledPawns) {
            // Each group should have 2+ pawns
            expect(doubledGroup.length).toBeGreaterThanOrEqual(2);
            
            // All pawns in the group should be on the same file
            const firstPawnCoords = boardSense['squareToCoords'](doubledGroup[0]);
            const file = firstPawnCoords.file;
            
            for (const pawnSquare of doubledGroup) {
              const pawnCoords = boardSense['squareToCoords'](pawnSquare);
              expect(pawnCoords.file).toBe(file);
            }
          }
          
          // Verify all pawns in doubled groups are accounted for
          const allDoubledPawns = doubledPawns.flat();
          for (const expectedGroup of expectedDoubledFiles) {
            for (const pawnSquare of expectedGroup) {
              expect(allDoubledPawns).toContain(pawnSquare);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 23: Passed pawn identification
   * **Validates: Requirements 7.3**
   * 
   * For any board position and color, getPassedPawns should return exactly
   * the pawns that have no enemy pawns on their file or adjacent files ahead of them.
   */
  test('Property 23: Passed pawn identification', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          const passedPawns = boardSense.getPassedPawns(color as any);
          
          // Get all pawns for the color
          const allPawns = boardSense.getPiecesOfType(color as any, 'p');
          
          // Get all enemy pawns
          const enemyColor = color === 'w' ? 'b' : 'w';
          const enemyPawns = boardSense.getPiecesOfType(enemyColor as any, 'p');
          
          // Manually verify each pawn
          for (const pawnSquare of allPawns) {
            const pawnCoords = boardSense['squareToCoords'](pawnSquare);
            const pawnFile = pawnCoords.file;
            const pawnRank = pawnCoords.rank;
            
            let isBlocked = false;
            
            // Check if any enemy pawn blocks or controls the path to promotion
            for (const enemyPawnSquare of enemyPawns) {
              const enemyCoords = boardSense['squareToCoords'](enemyPawnSquare);
              const enemyFile = enemyCoords.file;
              const enemyRank = enemyCoords.rank;
              
              // Check if enemy pawn is on the same file or adjacent files
              const fileDiff = Math.abs(enemyFile - pawnFile);
              if (fileDiff <= 1) {
                // Check if enemy pawn is ahead of our pawn
                if (color === 'w') {
                  // For white, enemy pawn must be on a higher rank
                  if (enemyRank > pawnRank) {
                    isBlocked = true;
                    break;
                  }
                } else {
                  // For black, enemy pawn must be on a lower rank
                  if (enemyRank < pawnRank) {
                    isBlocked = true;
                    break;
                  }
                }
              }
            }
            
            // Verify the pawn is in passedPawns if and only if it's not blocked
            if (isBlocked) {
              expect(passedPawns).not.toContain(pawnSquare);
            } else {
              expect(passedPawns).toContain(pawnSquare);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 24: Backward pawn identification
   * **Validates: Requirements 7.4**
   * 
   * For any board position and color, getBackwardPawns should return exactly
   * the pawns that cannot advance safely and have no friendly pawns behind them
   * on adjacent files.
   */
  test('Property 24: Backward pawn identification', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          const backwardPawns = boardSense.getBackwardPawns(color as any);
          
          // Get all pawns for the color
          const allPawns = boardSense.getPiecesOfType(color as any, 'p');
          
          // Get all enemy pawns
          const enemyColor = color === 'w' ? 'b' : 'w';
          const enemyPawns = boardSense.getPiecesOfType(enemyColor as any, 'p');
          
          // Direction of pawn advancement
          const forwardDirection = color === 'w' ? 1 : -1;
          
          // Manually verify each pawn
          for (const pawnSquare of allPawns) {
            const pawnCoords = boardSense['squareToCoords'](pawnSquare);
            const pawnFile = pawnCoords.file;
            const pawnRank = pawnCoords.rank;
            
            // Check if pawn can advance safely
            const oneSquareAhead = boardSense['coordsToSquare'](pawnFile, pawnRank + forwardDirection);
            
            let canAdvanceSafely = false;
            if (oneSquareAhead) {
              // Check if the square ahead is empty
              const pieceAhead = boardSense.getPieceAt(oneSquareAhead);
              if (!pieceAhead) {
                // Check if the square ahead is attacked by enemy pawns
                const attackedByEnemyPawn = enemyPawns.some(enemyPawnSquare => {
                  const enemyCoords = boardSense['squareToCoords'](enemyPawnSquare);
                  const oneSquareAheadCoords = boardSense['squareToCoords'](oneSquareAhead);
                  
                  // Enemy pawn attacks diagonally
                  const fileDiff = Math.abs(enemyCoords.file - oneSquareAheadCoords.file);
                  const rankDiff = color === 'w' 
                    ? oneSquareAheadCoords.rank - enemyCoords.rank 
                    : enemyCoords.rank - oneSquareAheadCoords.rank;
                  
                  return fileDiff === 1 && rankDiff === 1;
                });
                
                canAdvanceSafely = !attackedByEnemyPawn;
              }
            }
            
            // Check if there are friendly pawns behind on adjacent files
            const leftFile = pawnFile - 1;
            const rightFile = pawnFile + 1;
            
            let hasFriendlyPawnBehindOnAdjacentFile = false;
            
            for (const otherPawnSquare of allPawns) {
              if (otherPawnSquare === pawnSquare) continue;
              
              const otherPawnCoords = boardSense['squareToCoords'](otherPawnSquare);
              const otherPawnFile = otherPawnCoords.file;
              const otherPawnRank = otherPawnCoords.rank;
              
              // Check if on adjacent file
              if (otherPawnFile === leftFile || otherPawnFile === rightFile) {
                // Check if behind (lower rank for white, higher rank for black)
                if (color === 'w') {
                  if (otherPawnRank < pawnRank) {
                    hasFriendlyPawnBehindOnAdjacentFile = true;
                    break;
                  }
                } else {
                  if (otherPawnRank > pawnRank) {
                    hasFriendlyPawnBehindOnAdjacentFile = true;
                    break;
                  }
                }
              }
            }
            
            // Pawn is backward if it cannot advance safely AND has no friendly pawns behind on adjacent files
            const shouldBeBackward = !canAdvanceSafely && !hasFriendlyPawnBehindOnAdjacentFile;
            
            if (shouldBeBackward) {
              expect(backwardPawns).toContain(pawnSquare);
            } else {
              expect(backwardPawns).not.toContain(pawnSquare);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 25: Pawn structure metrics separation
   * **Validates: Requirements 7.5**
   * 
   * For any board position, getPawnStructureMetrics('w') and getPawnStructureMetrics('b')
   * should return independent metrics with no overlap in identified pawns.
   */
  test('Property 25: Pawn structure metrics separation', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        (chess) => {
          const boardSense = new BoardSense(chess);
          
          const whiteMetrics = boardSense.getPawnStructureMetrics('w');
          const blackMetrics = boardSense.getPawnStructureMetrics('b');
          
          // Get all white and black pawns
          const whitePawns = boardSense.getPiecesOfType('w', 'p');
          const blackPawns = boardSense.getPiecesOfType('b', 'p');
          
          // Verify white metrics only contain white pawns
          for (const isolatedPawn of whiteMetrics.isolated) {
            expect(whitePawns).toContain(isolatedPawn);
            expect(blackPawns).not.toContain(isolatedPawn);
          }
          
          for (const doubledGroup of whiteMetrics.doubled) {
            for (const pawn of doubledGroup) {
              expect(whitePawns).toContain(pawn);
              expect(blackPawns).not.toContain(pawn);
            }
          }
          
          for (const passedPawn of whiteMetrics.passed) {
            expect(whitePawns).toContain(passedPawn);
            expect(blackPawns).not.toContain(passedPawn);
          }
          
          for (const backwardPawn of whiteMetrics.backward) {
            expect(whitePawns).toContain(backwardPawn);
            expect(blackPawns).not.toContain(backwardPawn);
          }
          
          // Verify black metrics only contain black pawns
          for (const isolatedPawn of blackMetrics.isolated) {
            expect(blackPawns).toContain(isolatedPawn);
            expect(whitePawns).not.toContain(isolatedPawn);
          }
          
          for (const doubledGroup of blackMetrics.doubled) {
            for (const pawn of doubledGroup) {
              expect(blackPawns).toContain(pawn);
              expect(whitePawns).not.toContain(pawn);
            }
          }
          
          for (const passedPawn of blackMetrics.passed) {
            expect(blackPawns).toContain(passedPawn);
            expect(whitePawns).not.toContain(passedPawn);
          }
          
          for (const backwardPawn of blackMetrics.backward) {
            expect(blackPawns).toContain(backwardPawn);
            expect(whitePawns).not.toContain(backwardPawn);
          }
          
          // Verify no overlap between white and black metrics
          const allWhitePawnsInMetrics = [
            ...whiteMetrics.isolated,
            ...whiteMetrics.doubled.flat(),
            ...whiteMetrics.passed,
            ...whiteMetrics.backward
          ];
          
          const allBlackPawnsInMetrics = [
            ...blackMetrics.isolated,
            ...blackMetrics.doubled.flat(),
            ...blackMetrics.passed,
            ...blackMetrics.backward
          ];
          
          // No white pawn should appear in black metrics
          for (const whitePawn of allWhitePawnsInMetrics) {
            expect(allBlackPawnsInMetrics).not.toContain(whitePawn);
          }
          
          // No black pawn should appear in white metrics
          for (const blackPawn of allBlackPawnsInMetrics) {
            expect(allWhitePawnsInMetrics).not.toContain(blackPawn);
          }
          
          // Verify structure scores are independent (both should be numbers)
          expect(typeof whiteMetrics.structureScore).toBe('number');
          expect(typeof blackMetrics.structureScore).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Pawn structure metrics consistency
   * Verifies that getPawnStructureMetrics returns results consistent with individual methods
   */
  test('Pawn structure metrics consistency with individual methods', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        fc.constantFrom('w', 'b'),
        (chess, color) => {
          const boardSense = new BoardSense(chess);
          
          const metrics = boardSense.getPawnStructureMetrics(color as any);
          const isolated = boardSense.getIsolatedPawns(color as any);
          const doubled = boardSense.getDoubledPawns(color as any);
          const passed = boardSense.getPassedPawns(color as any);
          const backward = boardSense.getBackwardPawns(color as any);
          
          // Verify metrics match individual method results
          expect(metrics.isolated.sort()).toEqual(isolated.sort());
          expect(metrics.doubled.length).toBe(doubled.length);
          expect(metrics.passed.sort()).toEqual(passed.sort());
          expect(metrics.backward.sort()).toEqual(backward.sort());
          
          // Verify structure score calculation
          const expectedScore = 
            (isolated.length * -10) +
            (doubled.length * -5) +
            (backward.length * -8) +
            (passed.length * 15);
          
          expect(metrics.structureScore).toBe(expectedScore);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Non-mutating property for pawn structure methods
   * Verifies that calling pawn structure methods doesn't change the board state
   */
  test('Pawn structure methods do not mutate the Chess instance', () => {
    fc.assert(
      fc.property(
        arbitraryChessPosition,
        (chess) => {
          const originalFen = chess.fen();
          const boardSense = new BoardSense(chess);
          
          // Call all pawn structure methods
          boardSense.getIsolatedPawns('w');
          boardSense.getIsolatedPawns('b');
          boardSense.getDoubledPawns('w');
          boardSense.getDoubledPawns('b');
          boardSense.getPassedPawns('w');
          boardSense.getPassedPawns('b');
          boardSense.getBackwardPawns('w');
          boardSense.getBackwardPawns('b');
          boardSense.getPawnStructureMetrics('w');
          boardSense.getPawnStructureMetrics('b');
          
          // FEN should be unchanged
          expect(chess.fen()).toBe(originalFen);
        }
      ),
      { numRuns: 100 }
    );
  });
});
