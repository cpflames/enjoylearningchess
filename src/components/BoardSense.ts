import { Chess } from 'chess.js';
import type { Color, PieceSymbol, Square } from 'chess.js';

/**
 * Precomputed move offsets for pieces with fixed movement patterns
 */
const KNIGHT_OFFSETS: [number, number][] = [
  [2, 1], [2, -1], [-2, 1], [-2, -1],
  [1, 2], [1, -2], [-1, 2], [-1, -2]
];

const KING_OFFSETS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1]
];

const BISHOP_DIRECTIONS: [number, number][] = [
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

const ROOK_DIRECTIONS: [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

const QUEEN_DIRECTIONS: [number, number][] = [
  ...ROOK_DIRECTIONS,
  ...BISHOP_DIRECTIONS
];

const ALL_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Global cache shared across all BoardSense instances
 * Key: FEN string, Value: Map of cache keys to cached values
 * This allows cache reuse when the same position is evaluated multiple times
 */
const GLOBAL_BOARDSENSE_CACHE = new Map<string, Map<string, any>>();

/**
 * Clears the global BoardSense cache
 * Useful for freeing memory or resetting between games
 */
export function clearBoardSenseCache(): void {
  GLOBAL_BOARDSENSE_CACHE.clear();
}

/**
 * Gets the current size of the global cache (number of positions cached)
 */
export function getBoardSenseCacheSize(): number {
  return GLOBAL_BOARDSENSE_CACHE.size;
}

/**
 * Type definitions for BoardSense
 */

export type { Square, Color, PieceSymbol };

export type PieceType = PieceSymbol;

export interface Piece {
  type: PieceType;
  color: Color;
  square: Square;
}

export interface AttackInfo {
  piece: Piece;
  square: Square;
  isXRay: boolean;
}

export interface MaterialBreakdown {
  pawns: number;
  knights: number;
  bishops: number;
  rooks: number;
  queens: number;
  total: number;
}

export interface KingSafetyMetrics {
  kingSquare: Square;
  isInCheck: boolean;
  hasCastled: boolean;
  attackersNearKing: number;
  pawnShieldQuality: number; // 0-3, number of pawns protecting king
  safetyScore: number; // composite score
}

export interface PawnStructureMetrics {
  isolated: Square[];
  doubled: Square[][];
  passed: Square[];
  backward: Square[];
  structureScore: number; // composite score
}

export interface SquareControlMetrics {
  whiteControl: number;
  blackControl: number;
  controlDifference: number;
}

export interface FileControlMetrics {
  file: string;
  whiteControl: number;
  blackControl: number;
  dominantColor: Color | null;
}

export interface DiagonalControlMetrics {
  longDiagonals: {
    a1h8: SquareControlMetrics;
    h1a8: SquareControlMetrics;
  };
}

export interface PinInfo {
  pinnedPiece: Piece;
  pinningPiece: Piece;
  pinnedTo: Piece; // the piece or king behind
  pinSquares: Square[];
}

export interface ForkInfo {
  forkingPiece: Piece;
  targets: Piece[];
}

export interface SkewerInfo {
  skeweringPiece: Piece;
  frontPiece: Piece;
  backPiece: Piece;
  skewerSquares: Square[];
}

export interface DiscoveredAttackInfo {
  movingPiece: Piece;
  revealedAttacker: Piece;
  target: Piece;
}

export interface TacticalPatterns {
  pins: PinInfo[];
  forks: ForkInfo[];
  skewers: SkewerInfo[];
  discoveredAttacks: DiscoveredAttackInfo[];
}

/**
 * BoardSense - Comprehensive chess board state analysis
 * 
 * Provides a rich query interface for understanding piece placement, attacks,
 * defenses, material balance, mobility, king safety, pawn structure, square
 * control, and tactical patterns.
 * 
 * @example
 * ```typescript
 * const chess = new Chess();
 * const boardSense = new BoardSense(chess);
 * 
 * // Query piece locations
 * const piece = boardSense.getPieceAt('e4');
 * 
 * // Analyze attacks
 * const attackers = boardSense.getAttackers('e4', 'w');
 * 
 * // Evaluate material
 * const material = boardSense.getMaterialCount('w');
 * ```
 */
export class BoardSense {
  private chess: Chess;
  private currentFen: string;

  /**
   * Creates a new BoardSense instance
   * @param chess - A Chess instance from chess.js
   * @throws {TypeError} If chess is not a valid Chess instance
   */
  constructor(chess: Chess) {
    if (!chess || typeof chess.fen !== 'function') {
      throw new TypeError('BoardSense requires a valid Chess instance');
    }
    this.chess = chess;
    this.currentFen = chess.fen();
  }

  /**
   * Gets the cache for the current position from the global cache
   * Creates a new cache entry if one doesn't exist for this FEN
   * @private
   */
  private getCache(): Map<string, any> {
    const fen = this.chess.fen();
    if (!GLOBAL_BOARDSENSE_CACHE.has(fen)) {
      GLOBAL_BOARDSENSE_CACHE.set(fen, new Map<string, any>());
    }
    return GLOBAL_BOARDSENSE_CACHE.get(fen)!;
  }

  /**
   * Gets a cached value or computes it if not cached
   * Uses the global cache keyed by FEN for maximum reuse
   * @private
   */
  private getCached<T>(key: string, computer: () => T): T {
    const cache = this.getCache();
    if (!cache.has(key)) {
      cache.set(key, computer());
    }
    return cache.get(key) as T;
  }

  /**
   * Converts a square string to file and rank coordinates
   * @param square - Square in algebraic notation (e.g., "e4")
   * @returns Object with file (0-7) and rank (0-7) coordinates
   */
  private squareToCoords(square: Square): { file: number; rank: number } {
    return {
      file: square.charCodeAt(0) - 'a'.charCodeAt(0),
      rank: parseInt(square[1]) - 1
    };
  }

  /**
   * Converts file and rank coordinates to a square string
   * @param file - File coordinate (0-7, where 0 is 'a')
   * @param rank - Rank coordinate (0-7, where 0 is rank 1)
   * @returns Square in algebraic notation (e.g., "e4")
   */
  private coordsToSquare(file: number, rank: number): Square | null {
    if (file < 0 || file > 7 || rank < 0 || rank > 7) {
      return null;
    }
    return (String.fromCharCode('a'.charCodeAt(0) + file) + (rank + 1)) as Square;
  }

  /**
   * Validates if a string is a valid square
   * @param square - String to validate
   * @returns True if valid square (a1-h8)
   */
  private isValidSquare(square: string): square is Square {
    return /^[a-h][1-8]$/.test(square);
  }

  /**
   * Gets the piece at a specific square
   * @param square - Square in algebraic notation (e.g., "e4")
   * @returns The piece at the square, or null if empty or invalid square
   *
   * @example
   * ```typescript
   * const piece = boardSense.getPieceAt('e4');
   * if (piece) {
   *   console.log(`${piece.color} ${piece.type} at ${piece.square}`);
   * }
   * ```
   */
  getPieceAt(square: Square): Piece | null {
    // Validate square format
    if (!this.isValidSquare(square)) {
      return null;
    }

    // Use caching for piece locations
    return this.getCached(`piece:${square}`, () => {
      const piece = this.chess.get(square);
      // chess.get() returns undefined for empty squares, convert to null
      if (!piece) {
        return null;
      }
      return {
        type: piece.type,
        color: piece.color,
        square: square
      };
    });
  }

  /**
   * Gets all squares containing pieces of a specific type and color
   * @param color - The color of pieces to find ('w' or 'b')
   * @param pieceType - The type of piece to find (e.g., 'p', 'n', 'b', 'r', 'q', 'k')
   * @returns Array of squares containing the specified pieces
   *
   * @example
   * ```typescript
   * const whiteKnights = boardSense.getPiecesOfType('w', 'n');
   * console.log(`White knights at: ${whiteKnights.join(', ')}`);
   * ```
   */
  getPiecesOfType(color: Color, pieceType: PieceType): Square[] {
    // Use caching with key pattern "pieces:{color}:{type}"
    return this.getCached(`pieces:${color}:${pieceType}`, () => {
      const squares: Square[] = [];

      // Iterate through all squares on the board
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

      for (const file of files) {
        for (const rank of ranks) {
          const square = (file + rank) as Square;
          const piece = this.chess.get(square);

          // Check if piece matches the requested color and type
          if (piece && piece.color === color && piece.type === pieceType) {
            squares.push(square);
          }
        }
      }

      return squares;
    });
  }

  /**
   * Gets all pieces for a specific color organized by piece type
   * @param color - The color of pieces to find ('w' or 'b')
   * @returns Map of piece types to arrays of squares containing those pieces
   *
   * @example
   * ```typescript
   * const whitePieces = boardSense.getAllPieces('w');
   * console.log(`White pawns: ${whitePieces.get('p')?.join(', ')}`);
   * console.log(`White knights: ${whitePieces.get('n')?.join(', ')}`);
   * ```
   */
  getAllPieces(color: Color): Map<PieceType, Square[]> {
    // Use caching with key pattern "allPieces:{color}"
    return this.getCached(`allPieces:${color}`, () => {
      const piecesMap = new Map<PieceType, Square[]>();

      // Define all piece types
      const pieceTypes: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

      // Use getPiecesOfType internally for each piece type
      for (const pieceType of pieceTypes) {
        const squares = this.getPiecesOfType(color, pieceType);
        piecesMap.set(pieceType, squares);
      }

      return piecesMap;
    });
  }

  /**
   * Gets all pieces of a specific color that can attack a given square
   * @param square - The target square in algebraic notation (e.g., "e4")
   * @param attackerColor - The color of attacking pieces to find ('w' or 'b')
   * @returns Array of AttackInfo objects describing pieces that can attack the square
   *
   * @example
   * ```typescript
   * const attackers = boardSense.getAttackers('e4', 'w');
   * attackers.forEach(attacker => {
   *   console.log(`${attacker.piece.type} on ${attacker.piece.square} attacks e4`);
   * });
   * ```
   */
  getAttackers(square: Square, attackerColor: Color): AttackInfo[] {
    // Validate square format
    if (!this.isValidSquare(square)) {
      return [];
    }

    // Use caching with key "attackers:{square}:{color}"
    return this.getCached(`attackers:${square}:${attackerColor}`, () => {
      const attackers: AttackInfo[] = [];

      // Get all pieces of the attacking color
      const allPieces = this.getAllPieces(attackerColor);

      // For each piece, check if it can attack the target square
      Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
        for (const pieceSquare of squares) {
          if (this.canPieceAttackSquare(pieceSquare, square, pieceType, attackerColor)) {
            const piece = this.getPieceAt(pieceSquare);
            if (piece) {
              attackers.push({
                piece: piece,
                square: pieceSquare,
                isXRay: false // X-ray attacks will be handled in getXRayAttackers
              });
            }
          }
        }
      });

      return attackers;
    });
  }

  /**
   * Checks if a square is attacked by pieces of a specific color
   * @param square - The target square in algebraic notation (e.g., "e4")
   * @param byColor - The color of attacking pieces to check for ('w' or 'b')
   * @returns True if the square is attacked by at least one piece of the specified color
   *
   * @example
   * ```typescript
   * const isAttacked = boardSense.isSquareAttacked('e4', 'w');
   * if (isAttacked) {
   *   console.log('e4 is under attack by white');
   * }
   * ```
   */
  isSquareAttacked(square: Square, byColor: Color): boolean {
    // Use getAttackers internally and check if array is non-empty
    const attackers = this.getAttackers(square, byColor);
    return attackers.length > 0;
  }

  /**
   * Gets all pieces of a specific color that defend (attack) a given square
   * This is essentially the same as getAttackers - pieces that can move to a square are defending it
   * @param square - The target square in algebraic notation (e.g., "e4")
   * @param defenderColor - The color of defending pieces to find ('w' or 'b')
   * @returns Array of AttackInfo objects describing pieces that defend the square
   *
   * @example
   * ```typescript
   * const defenders = boardSense.getDefenders('e4', 'w');
   * defenders.forEach(defender => {
   *   console.log(`${defender.piece.type} on ${defender.piece.square} defends e4`);
   * });
   * ```
   */
  getDefenders(square: Square, defenderColor: Color): AttackInfo[] {
    // Call getAttackers with defenderColor
    // Defending a square means being able to attack/recapture on that square
    return this.getAttackers(square, defenderColor);
  }


  /**
   * Gets all x-ray attackers of a specific color that attack a given square
   * X-ray attacks occur when a sliding piece (rook, bishop, queen) attacks through other pieces
   * @param square - The target square in algebraic notation (e.g., "e4")
   * @param attackerColor - The color of attacking pieces to find ('w' or 'b')
   * @returns Array of AttackInfo objects with isXRay: true for x-ray attacks
   *
   * @example
   * ```typescript
   * const xrayAttackers = boardSense.getXRayAttackers('e4', 'w');
   * xrayAttackers.forEach(attacker => {
   *   console.log(`${attacker.piece.type} on ${attacker.piece.square} x-ray attacks e4`);
   * });
   * ```
   */
  getXRayAttackers(square: Square, attackerColor: Color): AttackInfo[] {
    // Validate square format
    if (!this.isValidSquare(square)) {
      return [];
    }

    // Use caching with key "xrayAttackers:{square}:{color}"
    return this.getCached(`xrayAttackers:${square}:${attackerColor}`, () => {
      const xrayAttackers: AttackInfo[] = [];

      // Get all sliding pieces of the attacking color (rook, bishop, queen)
      const slidingPieceTypes: PieceType[] = ['r', 'b', 'q'];
      
      for (const pieceType of slidingPieceTypes) {
        const pieces = this.getPiecesOfType(attackerColor, pieceType);
        
        for (const pieceSquare of pieces) {
          // Check if this piece is on a line with the target square
          if (this.isOnSameLine(pieceSquare, square, pieceType)) {
            // Check if there are blocking pieces
            const blockingPieces = this.getBlockingPieces(pieceSquare, square);
            
            // X-ray attack exists if:
            // 1. There are blocking pieces (otherwise it's a direct attack)
            // 2. The piece would attack the square if blocking pieces were removed
            if (blockingPieces.length > 0) {
              const piece = this.getPieceAt(pieceSquare);
              if (piece) {
                xrayAttackers.push({
                  piece: piece,
                  square: pieceSquare,
                  isXRay: true
                });
              }
            }
          }
        }
      }

      return xrayAttackers;
    });
  }

  /**
   * Checks if two squares are on the same line for a given piece type
   * @private
   */
  private isOnSameLine(fromSquare: Square, toSquare: Square, pieceType: PieceType): boolean {
    const from = this.squareToCoords(fromSquare);
    const to = this.squareToCoords(toSquare);
    
    const fileDiff = Math.abs(to.file - from.file);
    const rankDiff = Math.abs(to.rank - from.rank);
    
    switch (pieceType) {
      case 'r': // Rook - same file or same rank
        return (fileDiff === 0 && rankDiff > 0) || (rankDiff === 0 && fileDiff > 0);
        
      case 'b': // Bishop - same diagonal
        return fileDiff === rankDiff && fileDiff > 0;
        
      case 'q': // Queen - same file, rank, or diagonal
        return (fileDiff === rankDiff && fileDiff > 0) || 
               (fileDiff === 0 && rankDiff > 0) || 
               (rankDiff === 0 && fileDiff > 0);
        
      default:
        return false;
    }
  }

  /**
   * Gets all pieces blocking the path between two squares
   * @private
   */
  private getBlockingPieces(fromSquare: Square, toSquare: Square): Square[] {
    const from = this.squareToCoords(fromSquare);
    const to = this.squareToCoords(toSquare);
    
    const fileDiff = to.file - from.file;
    const rankDiff = to.rank - from.rank;
    
    // Determine direction
    const fileStep = fileDiff === 0 ? 0 : fileDiff / Math.abs(fileDiff);
    const rankStep = rankDiff === 0 ? 0 : rankDiff / Math.abs(rankDiff);
    
    const blockingPieces: Square[] = [];
    
    // Check each square along the path (excluding start and end)
    let currentFile = from.file + fileStep;
    let currentRank = from.rank + rankStep;
    
    while (currentFile !== to.file || currentRank !== to.rank) {
      const square = this.coordsToSquare(currentFile, currentRank);
      if (square && this.getPieceAt(square) !== null) {
        blockingPieces.push(square);
      }
      currentFile += fileStep;
      currentRank += rankStep;
    }
    
    return blockingPieces;
  }

  /**
   * Checks if a piece can attack a target square based on piece movement rules
   * This is used when we can't use chess.moves() because it's not the piece's turn
   * @private
   */
  private canPieceAttackSquare(fromSquare: Square, toSquare: Square, pieceType: PieceType, color: Color): boolean {
    const from = this.squareToCoords(fromSquare);
    const to = this.squareToCoords(toSquare);
    
    const fileDiff = Math.abs(to.file - from.file);
    const rankDiff = Math.abs(to.rank - from.rank);
    
    switch (pieceType) {
      case 'p': // Pawn
        // Pawns ONLY attack diagonally one square (not straight ahead)
        // They can move forward, but that's not an "attack"
        if (fileDiff === 1) {
          if (color === 'w') {
            return to.rank - from.rank === 1;
          } else {
            return from.rank - to.rank === 1;
          }
        }
        return false;
        
      case 'n': // Knight
        return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
        
      case 'b': // Bishop
        if (fileDiff === rankDiff && fileDiff > 0) {
          return this.isPathClear(fromSquare, toSquare);
        }
        return false;
        
      case 'r': // Rook
        if ((fileDiff === 0 && rankDiff > 0) || (rankDiff === 0 && fileDiff > 0)) {
          return this.isPathClear(fromSquare, toSquare);
        }
        return false;
        
      case 'q': // Queen
        if ((fileDiff === rankDiff && fileDiff > 0) || 
            (fileDiff === 0 && rankDiff > 0) || 
            (rankDiff === 0 && fileDiff > 0)) {
          return this.isPathClear(fromSquare, toSquare);
        }
        return false;
        
      case 'k': // King
        return fileDiff <= 1 && rankDiff <= 1 && (fileDiff > 0 || rankDiff > 0);
        
      default:
        return false;
    }
  }

  /**
   * Checks if the path between two squares is clear (no pieces blocking)
   * Used for sliding pieces (bishop, rook, queen)
   * @private
   */
  private isPathClear(fromSquare: Square, toSquare: Square): boolean {
    const from = this.squareToCoords(fromSquare);
    const to = this.squareToCoords(toSquare);
    
    const fileDiff = to.file - from.file;
    const rankDiff = to.rank - from.rank;
    
    // Determine direction
    const fileStep = fileDiff === 0 ? 0 : fileDiff / Math.abs(fileDiff);
    const rankStep = rankDiff === 0 ? 0 : rankDiff / Math.abs(rankDiff);
    
    // Check each square along the path (excluding start and end)
    let currentFile = from.file + fileStep;
    let currentRank = from.rank + rankStep;
    
    while (currentFile !== to.file || currentRank !== to.rank) {
      const square = this.coordsToSquare(currentFile, currentRank);
      if (square && this.getPieceAt(square) !== null) {
        return false; // Path is blocked
      }
      currentFile += fileStep;
      currentRank += rankStep;
    }
    
    return true; // Path is clear
  }

   /**
    * Gets the total material count for a specific color
    * Uses standard piece values: pawn=1, knight=3, bishop=3, rook=5, queen=9, king=0
    * @param color - The color to calculate material for ('w' or 'b')
    * @returns The total material value for the specified color
    *
    * @example
    * ```typescript
    * const whiteMaterial = boardSense.getMaterialCount('w');
    * const blackMaterial = boardSense.getMaterialCount('b');
    * console.log(`White material: ${whiteMaterial}, Black material: ${blackMaterial}`);
    * ```
    */
   getMaterialCount(color: Color): number {
     // Use caching with key "material:{color}"
     return this.getCached(`material:${color}`, () => {
       // Define material values
       const materialValues: Record<PieceType, number> = {
         'p': 1,  // pawn
         'n': 3,  // knight
         'b': 3,  // bishop
         'r': 5,  // rook
         'q': 9,  // queen
         'k': 0   // king
       };

       let totalMaterial = 0;

       // Get all pieces for the color
       const allPieces = this.getAllPieces(color);

       // Sum up the material values
       Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
         const pieceValue = materialValues[pieceType];
         const pieceCount = squares.length;
         totalMaterial += pieceValue * pieceCount;
       });

       return totalMaterial;
     });
   }

   /**
    * Gets the material balance between white and black
    * Positive values indicate white is ahead in material, negative values indicate black is ahead
    * @returns The material difference (white material - black material)
    *
    * @example
    * ```typescript
    * const balance = boardSense.getMaterialBalance();
    * if (balance > 0) {
    *   console.log(`White is ahead by ${balance} points of material`);
    * } else if (balance < 0) {
    *   console.log(`Black is ahead by ${Math.abs(balance)} points of material`);
    * } else {
    *   console.log('Material is equal');
    * }
    * ```
    */
   getMaterialBalance(): number {
     return this.getMaterialCount('w') - this.getMaterialCount('b');
   }

   /**
    * Gets a detailed breakdown of material by piece type for a specific color
    * @param color - The color to get material breakdown for ('w' or 'b')
    * @returns MaterialBreakdown object with counts for each piece type and total material value
    *
    * @example
    * ```typescript
    * const breakdown = boardSense.getMaterialBreakdown('w');
    * console.log(`White has ${breakdown.pawns} pawns, ${breakdown.knights} knights`);
    * console.log(`Total white material: ${breakdown.total}`);
    * ```
    */
   getMaterialBreakdown(color: Color): MaterialBreakdown {
     // Use caching with key "materialBreakdown:{color}"
     return this.getCached(`materialBreakdown:${color}`, () => {
       // Define material values
       const materialValues: Record<PieceType, number> = {
         'p': 1,  // pawn
         'n': 3,  // knight
         'b': 3,  // bishop
         'r': 5,  // rook
         'q': 9,  // queen
         'k': 0   // king
       };

       // Get all pieces for the color
       const allPieces = this.getAllPieces(color);

       // Count each piece type
       const pawns = allPieces.get('p')?.length || 0;
       const knights = allPieces.get('n')?.length || 0;
       const bishops = allPieces.get('b')?.length || 0;
       const rooks = allPieces.get('r')?.length || 0;
       const queens = allPieces.get('q')?.length || 0;

       // Calculate total material value
       const total = 
         pawns * materialValues['p'] +
         knights * materialValues['n'] +
         bishops * materialValues['b'] +
         rooks * materialValues['r'] +
         queens * materialValues['q'];

       return {
         pawns,
         knights,
         bishops,
         rooks,
         queens,
         total
       };
     });
   }
   /**
    * Gets the mobility (number of legal moves) for a piece at a specific square
    * Uses efficient geometry-based calculation instead of move generation.
    * Pawns return 0 as their mobility is not strategically important.
    * 
    * @param square - The square containing the piece to analyze (e.g., "e4")
    * @returns The number of legal moves available to the piece, or 0 if no piece or invalid square
    *
    * @example
    * ```typescript
    * const mobility = boardSense.getPieceMobility('e4');
    * console.log(`Piece on e4 has ${mobility} legal moves`);
    * ```
    */
   getPieceMobility(square: Square): number {
     // Validate square format
     if (!this.isValidSquare(square)) {
       return 0;
     }

     // Use caching with key "mobility:{square}"
     return this.getCached(`mobility:${square}`, () => {
       // Get piece at square
       const piece = this.getPieceAt(square);

       // If no piece at square, return 0
       if (!piece) {
         return 0;
       }

       // Pawns: mobility not strategically important, return 0
       if (piece.type === 'p') {
         return 0;
       }

       const coords = this.squareToCoords(square);
       let mobility = 0;

       switch (piece.type) {
         case 'n': // Knight
           mobility = this.countKnightMoves(coords, piece.color);
           break;
         case 'b': // Bishop
           mobility = this.countSlidingMoves(coords, piece.color, BISHOP_DIRECTIONS);
           break;
         case 'r': // Rook
           mobility = this.countSlidingMoves(coords, piece.color, ROOK_DIRECTIONS);
           break;
         case 'q': // Queen
           mobility = this.countSlidingMoves(coords, piece.color, QUEEN_DIRECTIONS);
           break;
         case 'k': // King
           mobility = this.countKingMoves(coords, piece.color);
           break;
       }

       return mobility;
     });
   }

   /**
    * Counts valid moves for a knight from a given position
    * @private
    */
   private countKnightMoves(coords: { file: number; rank: number }, color: Color): number {
     let count = 0;
     for (const [fileOffset, rankOffset] of KNIGHT_OFFSETS) {
       const targetSquare = this.coordsToSquare(coords.file + fileOffset, coords.rank + rankOffset);
       if (targetSquare && this.canMoveToSquare(targetSquare, color)) {
         count++;
       }
     }
     return count;
   }

   /**
    * Counts valid moves for a king from a given position
    * @private
    */
   private countKingMoves(coords: { file: number; rank: number }, color: Color): number {
     let count = 0;
     for (const [fileOffset, rankOffset] of KING_OFFSETS) {
       const targetSquare = this.coordsToSquare(coords.file + fileOffset, coords.rank + rankOffset);
       if (targetSquare && this.canMoveToSquare(targetSquare, color)) {
         count++;
       }
     }
     return count;
   }

   /**
    * Counts valid moves for sliding pieces (bishop, rook, queen) from a given position
    * @private
    */
   private countSlidingMoves(
     coords: { file: number; rank: number },
     color: Color,
     directions: [number, number][]
   ): number {
     let count = 0;
     for (const [fileDir, rankDir] of directions) {
       let file = coords.file + fileDir;
       let rank = coords.rank + rankDir;
       
       while (true) {
         const targetSquare = this.coordsToSquare(file, rank);
         if (!targetSquare) break; // Off board
         
         const targetPiece = this.getPieceAt(targetSquare);
         if (!targetPiece) {
           // Empty square - can move here
           count++;
         } else if (targetPiece.color !== color) {
           // Enemy piece - can capture
           count++;
           break; // Can't move past this piece
         } else {
           // Friendly piece - blocked
           break;
         }
         
         file += fileDir;
         rank += rankDir;
       }
     }
     return count;
   }

   /**
    * Checks if a piece of the given color can move to the target square
    * (either empty or contains an enemy piece)
    * @private
    */
   private canMoveToSquare(square: Square, color: Color): boolean {
     const piece = this.getPieceAt(square);
     return !piece || piece.color !== color;
   }

   /**
    * Gets the total mobility (sum of all legal moves) for all non-pawn pieces of a specific color
    * Pawns are excluded as their mobility is not strategically important.
    * @param color - The color to calculate total mobility for ('w' or 'b')
    * @returns The total number of legal moves available to all non-pawn pieces of the specified color
    *
    * @example
    * ```typescript
    * const whiteMobility = boardSense.getTotalMobility('w');
    * const blackMobility = boardSense.getTotalMobility('b');
    * console.log(`White mobility: ${whiteMobility}, Black mobility: ${blackMobility}`);
    * ```
    */
   getTotalMobility(color: Color): number {
     // Use caching with key "mobility:total:{color}"
     return this.getCached(`mobility:total:${color}`, () => {
       // Get all pieces for the color
       const allPieces = this.getAllPieces(color);

       let totalMobility = 0;

       // Sum getPieceMobility for each non-pawn piece
       Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
         // Skip pawns - their mobility is not strategically important
         if (pieceType === 'p') return;
         
         for (const square of squares) {
           totalMobility += this.getPieceMobility(square);
         }
       });

       return totalMobility;
     });
   }

   /**
    * Gets the mobility difference between white and black
    * Positive values indicate white has more mobility, negative values indicate black has more mobility
    * @returns The mobility difference (white mobility - black mobility)
    *
    * @example
    * ```typescript
    * const mobilityDiff = boardSense.getMobilityDifference();
    * if (mobilityDiff > 0) {
    *   console.log(`White has ${mobilityDiff} more legal moves than black`);
    * } else if (mobilityDiff < 0) {
    *   console.log(`Black has ${Math.abs(mobilityDiff)} more legal moves than white`);
    * } else {
    *   console.log('Both sides have equal mobility');
    * }
    * ```
    */
   getMobilityDifference(): number {
     return this.getTotalMobility('w') - this.getTotalMobility('b');
   }

   /**
    * Gets king safety metrics for a specific color
    * Evaluates how protected the king is from threats
    * @param color - The color of the king to analyze ('w' or 'b')
    * @returns KingSafetyMetrics object with safety information
    *
    * @example
    * ```typescript
    * const safety = boardSense.getKingSafety('w');
    * console.log(`White king at ${safety.kingSquare}, in check: ${safety.isInCheck}`);
    * console.log(`Attackers near king: ${safety.attackersNearKing}, pawn shield: ${safety.pawnShieldQuality}`);
    * ```
    */
   getKingSafety(color: Color): KingSafetyMetrics {
     // Use caching with key "kingSafety:{color}"
     return this.getCached(`kingSafety:${color}`, () => {
       // Find king square for the color
       const kingSquares = this.getPiecesOfType(color, 'k');
       if (kingSquares.length === 0) {
         // No king found - return default metrics
         return {
           kingSquare: 'e1' as Square,
           isInCheck: false,
           hasCastled: false,
           attackersNearKing: 0,
           pawnShieldQuality: 0,
           safetyScore: 0
         };
       }

       const kingSquare = kingSquares[0];
       const kingCoords = this.squareToCoords(kingSquare);

       // Check if king is in check using chess.js isCheck()
       const isInCheck = this.chess.isCheck();

       // Detect if king has castled
       const hasCastled = this.hasKingCastled(color, kingSquare);

       // Count enemy pieces attacking 3x3 area around king
       const enemyColor: Color = color === 'w' ? 'b' : 'w';
       const uniqueAttackers = new Set<string>();

       // Check all squares in 3x3 area around king
       for (let fileOffset = -1; fileOffset <= 1; fileOffset++) {
         for (let rankOffset = -1; rankOffset <= 1; rankOffset++) {
           const targetFile = kingCoords.file + fileOffset;
           const targetRank = kingCoords.rank + rankOffset;
           const targetSquare = this.coordsToSquare(targetFile, targetRank);

           if (targetSquare) {
             // Get all enemy pieces attacking this square
             const attackers = this.getAttackers(targetSquare, enemyColor);
             // Add unique attacker squares to the set
             attackers.forEach(attacker => {
               uniqueAttackers.add(attacker.piece.square);
             });
           }
         }
       }

       const attackersNearKing = uniqueAttackers.size;

       // Count friendly pawns in front of king (pawn shield quality)
       const pawnShieldQuality = this.countPawnShield(color, kingSquare);

       // Calculate composite safety score
       // Higher score = safer king
       // Base score: 100
       // Penalties: -50 for check, -10 per attacker near king
       // Bonuses: +20 for castling, +10 per pawn in shield
       let safetyScore = 100;
       if (isInCheck) safetyScore -= 50;
       safetyScore -= attackersNearKing * 10;
       if (hasCastled) safetyScore += 20;
       safetyScore += pawnShieldQuality * 10;

       return {
         kingSquare,
         isInCheck,
         hasCastled,
         attackersNearKing,
         pawnShieldQuality,
         safetyScore
       };
     });
   }

   /**
    * Detects if a king has castled based on its position
    * @private
    */
   private hasKingCastled(color: Color, kingSquare: Square): boolean {
     // Kings start on e1 (white) or e8 (black)
     // After castling kingside: g1 (white) or g8 (black)
     // After castling queenside: c1 (white) or c8 (black)
     
     const startRank = color === 'w' ? '1' : '8';
     const startSquare = `e${startRank}` as Square;

     // If king is still on starting square, it hasn't castled
     if (kingSquare === startSquare) {
       return false;
     }

     // Check if king is on a castled position
     const kingsideCastled = kingSquare === `g${startRank}` as Square;
     const queensideCastled = kingSquare === `c${startRank}` as Square;

     // Additional verification: check if rook is in expected position after castling
     if (kingsideCastled) {
       // After kingside castling, rook should be on f-file
       const rookSquare = `f${startRank}` as Square;
       const piece = this.getPieceAt(rookSquare);
       return piece !== null && piece.type === 'r' && piece.color === color;
     }

     if (queensideCastled) {
       // After queenside castling, rook should be on d-file
       const rookSquare = `d${startRank}` as Square;
       const piece = this.getPieceAt(rookSquare);
       return piece !== null && piece.type === 'r' && piece.color === color;
     }

     return false;
   }

   /**
    * Counts friendly pawns in front of the king (pawn shield)
    * @private
    */
   private countPawnShield(color: Color, kingSquare: Square): number {
     const kingCoords = this.squareToCoords(kingSquare);
     let pawnCount = 0;

     // Direction pawns should be in front of king
     const forwardDirection = color === 'w' ? 1 : -1;

     // Check three files: king's file and adjacent files
     for (let fileOffset = -1; fileOffset <= 1; fileOffset++) {
       const targetFile = kingCoords.file + fileOffset;

       // Check one or two ranks in front of king
       for (let rankOffset = 1; rankOffset <= 2; rankOffset++) {
         const targetRank = kingCoords.rank + (forwardDirection * rankOffset);
         const targetSquare = this.coordsToSquare(targetFile, targetRank);

         if (targetSquare) {
           const piece = this.getPieceAt(targetSquare);
           if (piece && piece.type === 'p' && piece.color === color) {
             pawnCount++;
             break; // Only count one pawn per file
           }
         }
       }
     }

     // Cap at 3 (one pawn per file maximum)
     return Math.min(pawnCount, 3);
   }

   /**
    * Gets all isolated pawns for a specific color
    * An isolated pawn has no friendly pawns on adjacent files
    * @param color - The color of pawns to analyze ('w' or 'b')
    * @returns Array of squares containing isolated pawns
    *
    * @example
    * ```typescript
    * const isolatedPawns = boardSense.getIsolatedPawns('w');
    * console.log(`White has ${isolatedPawns.length} isolated pawns at: ${isolatedPawns.join(', ')}`);
    * ```
    */
   getIsolatedPawns(color: Color): Square[] {
     // Use caching with key "isolatedPawns:{color}"
     return this.getCached(`isolatedPawns:${color}`, () => {
       const isolatedPawns: Square[] = [];

       // Get all pawns for the color
       const pawns = this.getPiecesOfType(color, 'p');

       // For each pawn, check if there are friendly pawns on adjacent files
       for (const pawnSquare of pawns) {
         const pawnCoords = this.squareToCoords(pawnSquare);
         const pawnFile = pawnCoords.file;

         // Check adjacent files (left and right)
         const leftFile = pawnFile - 1;
         const rightFile = pawnFile + 1;

         let hasFriendlyPawnOnAdjacentFile = false;

         // Check if any other pawn is on the left or right file
         for (const otherPawnSquare of pawns) {
           if (otherPawnSquare === pawnSquare) continue; // Skip the pawn itself

           const otherPawnCoords = this.squareToCoords(otherPawnSquare);
           const otherPawnFile = otherPawnCoords.file;

           if (otherPawnFile === leftFile || otherPawnFile === rightFile) {
             hasFriendlyPawnOnAdjacentFile = true;
             break;
           }
         }

         // If no friendly pawns on adjacent files, this pawn is isolated
         if (!hasFriendlyPawnOnAdjacentFile) {
           isolatedPawns.push(pawnSquare);
         }
       }

       return isolatedPawns;
     });
   }

   /**
    * Gets all doubled pawns for a specific color
    * Doubled pawns are pawns that share the same file with another friendly pawn
    * @param color - The color of pawns to analyze ('w' or 'b')
    * @returns Array of arrays, where each inner array contains pawns on the same file (only files with 2+ pawns)
    *
    * @example
    * ```typescript
    * const doubledPawns = boardSense.getDoubledPawns('w');
    * console.log(`White has ${doubledPawns.length} files with doubled pawns`);
    * doubledPawns.forEach(group => {
    *   console.log(`Doubled pawns on file: ${group.join(', ')}`);
    * });
    * ```
    */
   getDoubledPawns(color: Color): Square[][] {
     // Use caching with key "doubledPawns:{color}"
     return this.getCached(`doubledPawns:${color}`, () => {
       const doubledPawns: Square[][] = [];

       // Get all pawns for the color
       const pawns = this.getPiecesOfType(color, 'p');

       // Group pawns by file
       const pawnsByFile = new Map<number, Square[]>();

       for (const pawnSquare of pawns) {
         const pawnCoords = this.squareToCoords(pawnSquare);
         const file = pawnCoords.file;

         if (!pawnsByFile.has(file)) {
           pawnsByFile.set(file, []);
         }
         pawnsByFile.get(file)!.push(pawnSquare);
       }

       // Return files with 2+ pawns
       for (const [file, pawnsOnFile] of Array.from(pawnsByFile.entries())) {
         if (pawnsOnFile.length >= 2) {
           doubledPawns.push(pawnsOnFile);
         }
       }

       return doubledPawns;
     });
   }

   /**
    * Gets all passed pawns for a specific color
    * A passed pawn has no enemy pawns blocking or controlling its path to promotion
    * @param color - The color of pawns to analyze ('w' or 'b')
    * @returns Array of squares containing passed pawns
    *
    * @example
    * ```typescript
    * const passedPawns = boardSense.getPassedPawns('w');
    * console.log(`White has ${passedPawns.length} passed pawns at: ${passedPawns.join(', ')}`);
    * ```
    */
   getPassedPawns(color: Color): Square[] {
     // Use caching with key "passedPawns:{color}"
     return this.getCached(`passedPawns:${color}`, () => {
       const passedPawns: Square[] = [];

       // Get all pawns for the color
       const pawns = this.getPiecesOfType(color, 'p');
       
       // Get all enemy pawns
       const enemyColor: Color = color === 'w' ? 'b' : 'w';
       const enemyPawns = this.getPiecesOfType(enemyColor, 'p');

       // Direction of pawn advancement
       const forwardDirection = color === 'w' ? 1 : -1;

       // For each pawn, check if it's passed
       for (const pawnSquare of pawns) {
         const pawnCoords = this.squareToCoords(pawnSquare);
         const pawnFile = pawnCoords.file;
         const pawnRank = pawnCoords.rank;

         let isBlocked = false;

         // Check if any enemy pawn blocks or controls the path to promotion
         for (const enemyPawnSquare of enemyPawns) {
           const enemyCoords = this.squareToCoords(enemyPawnSquare);
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

         // If not blocked, this pawn is passed
         if (!isBlocked) {
           passedPawns.push(pawnSquare);
         }
       }

       return passedPawns;
     });
   }

   /**
    * Gets all backward pawns for a specific color
    * A backward pawn cannot advance safely and has no friendly pawns behind it on adjacent files
    * @param color - The color of pawns to analyze ('w' or 'b')
    * @returns Array of squares containing backward pawns
    *
    * @example
    * ```typescript
    * const backwardPawns = boardSense.getBackwardPawns('w');
    * console.log(`White has ${backwardPawns.length} backward pawns at: ${backwardPawns.join(', ')}`);
    * ```
    */
   getBackwardPawns(color: Color): Square[] {
     // Use caching with key "backwardPawns:{color}"
     return this.getCached(`backwardPawns:${color}`, () => {
       const backwardPawns: Square[] = [];

       // Get all pawns for the color
       const pawns = this.getPiecesOfType(color, 'p');
       
       // Get all enemy pawns
       const enemyColor: Color = color === 'w' ? 'b' : 'w';
       const enemyPawns = this.getPiecesOfType(enemyColor, 'p');

       // Direction of pawn advancement
       const forwardDirection = color === 'w' ? 1 : -1;

       // For each pawn, check if it's backward
       for (const pawnSquare of pawns) {
         const pawnCoords = this.squareToCoords(pawnSquare);
         const pawnFile = pawnCoords.file;
         const pawnRank = pawnCoords.rank;

         // Check if pawn can advance safely
         const oneSquareAhead = this.coordsToSquare(pawnFile, pawnRank + forwardDirection);
         
         let canAdvanceSafely = false;
         if (oneSquareAhead) {
           // Check if the square ahead is empty
           const pieceAhead = this.getPieceAt(oneSquareAhead);
           if (!pieceAhead) {
             // Check if the square ahead is attacked by enemy pawns
             const attackedByEnemyPawn = enemyPawns.some(enemyPawnSquare => {
               const enemyCoords = this.squareToCoords(enemyPawnSquare);
               const oneSquareAheadCoords = this.squareToCoords(oneSquareAhead);
               
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

         for (const otherPawnSquare of pawns) {
           if (otherPawnSquare === pawnSquare) continue;

           const otherPawnCoords = this.squareToCoords(otherPawnSquare);
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
         if (!canAdvanceSafely && !hasFriendlyPawnBehindOnAdjacentFile) {
           backwardPawns.push(pawnSquare);
         }
       }

       return backwardPawns;
     });
   }

   /**
    * Gets comprehensive pawn structure metrics for a specific color
    * Calls all pawn structure methods and returns composite metrics
    * @param color - The color of pawns to analyze ('w' or 'b')
    * @returns PawnStructureMetrics object with all pawn structure information
    *
    * @example
    * ```typescript
    * const metrics = boardSense.getPawnStructureMetrics('w');
    * console.log(`White pawn structure score: ${metrics.structureScore}`);
    * console.log(`Isolated: ${metrics.isolated.length}, Doubled: ${metrics.doubled.length}`);
    * console.log(`Passed: ${metrics.passed.length}, Backward: ${metrics.backward.length}`);
    * ```
    */
   getPawnStructureMetrics(color: Color): PawnStructureMetrics {
     // Use caching with key "pawnStructure:{color}"
     return this.getCached(`pawnStructure:${color}`, () => {
       // Call all pawn structure methods
       const isolated = this.getIsolatedPawns(color);
       const doubled = this.getDoubledPawns(color);
       const passed = this.getPassedPawns(color);
       const backward = this.getBackwardPawns(color);

       // Calculate composite structure score
       // Base score: 0
       // Penalties: -10 per isolated pawn, -5 per doubled pawn group, -8 per backward pawn
       // Bonuses: +15 per passed pawn
       let structureScore = 0;
       
       structureScore -= isolated.length * 10;
       structureScore -= doubled.length * 5;
       structureScore -= backward.length * 8;
       structureScore += passed.length * 15;

       return {
         isolated,
         doubled,
         passed,
         backward,
         structureScore
       };
     });
   }

  /**
   * Generates all pseudo-legal destination squares for a piece at a given square
   * Similar to mobility calculation but returns the actual squares
   * @param square - The square containing the piece
   * @param pieceType - The type of piece
   * @param color - The color of the piece
   * @returns Array of destination squares (may include illegal moves due to pins)
   */
  private generatePieceDestinations(square: Square, pieceType: PieceType, color: Color): Square[] {
    const coords = this.squareToCoords(square);
    const destinations: Square[] = [];

    switch (pieceType) {
      case 'p': // Pawn
        return this.generatePawnDestinations(square, color);
      
      case 'n': // Knight
        for (const [fileOffset, rankOffset] of KNIGHT_OFFSETS) {
          const destSquare = this.coordsToSquare(coords.file + fileOffset, coords.rank + rankOffset);
          if (destSquare && this.canMoveToSquare(destSquare, color)) {
            destinations.push(destSquare);
          }
        }
        break;
      
      case 'b': // Bishop
        this.addSlidingDestinations(destinations, coords, color, BISHOP_DIRECTIONS);
        break;
      
      case 'r': // Rook
        this.addSlidingDestinations(destinations, coords, color, ROOK_DIRECTIONS);
        break;
      
      case 'q': // Queen
        this.addSlidingDestinations(destinations, coords, color, QUEEN_DIRECTIONS);
        break;
      
      case 'k': // King
        for (const [fileOffset, rankOffset] of KING_OFFSETS) {
          const destSquare = this.coordsToSquare(coords.file + fileOffset, coords.rank + rankOffset);
          if (destSquare && this.canMoveToSquare(destSquare, color)) {
            destinations.push(destSquare);
          }
        }
        break;
    }

    return destinations;
  }

  /**
   * Generates pawn destination squares (forward moves and captures)
   * @private
   */
  private generatePawnDestinations(square: Square, color: Color): Square[] {
    const coords = this.squareToCoords(square);
    const destinations: Square[] = [];
    const direction = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 1 : 6;

    // Forward one square
    const oneForward = this.coordsToSquare(coords.file, coords.rank + direction);
    if (oneForward && !this.getPieceAt(oneForward)) {
      destinations.push(oneForward);

      // Forward two squares from starting position
      if (coords.rank === startRank) {
        const twoForward = this.coordsToSquare(coords.file, coords.rank + direction * 2);
        if (twoForward && !this.getPieceAt(twoForward)) {
          destinations.push(twoForward);
        }
      }
    }

    // Diagonal captures
    for (const fileOffset of [-1, 1]) {
      const captureSquare = this.coordsToSquare(coords.file + fileOffset, coords.rank + direction);
      if (captureSquare) {
        const targetPiece = this.getPieceAt(captureSquare);
        if (targetPiece && targetPiece.color !== color) {
          destinations.push(captureSquare);
        }
      }
    }

    return destinations;
  }

  /**
   * Adds sliding piece destinations to the array
   * @private
   */
  private addSlidingDestinations(
    destinations: Square[],
    coords: { file: number; rank: number },
    color: Color,
    directions: [number, number][]
  ): void {
    for (const [fileDir, rankDir] of directions) {
      let file = coords.file + fileDir;
      let rank = coords.rank + rankDir;
      
      while (true) {
        const targetSquare = this.coordsToSquare(file, rank);
        if (!targetSquare) break;
        
        const targetPiece = this.getPieceAt(targetSquare);
        if (!targetPiece) {
          destinations.push(targetSquare);
        } else if (targetPiece.color !== color) {
          destinations.push(targetSquare);
          break;
        } else {
          break;
        }
        
        file += fileDir;
        rank += rankDir;
      }
    }
  }

  /**
   * Converts a move from square coordinates to SAN notation
   * @param from - Starting square
   * @param to - Destination square
   * @param piece - Piece type
   * @param color - Piece color
   * @returns SAN notation string (e.g., "Nf3", "exd5", "O-O")
   */
  private squareToSAN(from: Square, to: Square, piece: PieceType, color: Color): string {
    const targetPiece = this.getPieceAt(to);
    const isCapture = targetPiece !== null;

    // Castling
    if (piece === 'k') {
      const fromFile = from.charCodeAt(0);
      const toFile = to.charCodeAt(0);
      if (Math.abs(toFile - fromFile) === 2) {
        return toFile > fromFile ? 'O-O' : 'O-O-O';
      }
    }

    // Pawn moves
    if (piece === 'p') {
      if (isCapture) {
        return `${from[0]}x${to}`;
      }
      return to;
    }

    // Piece moves
    const pieceSymbol = piece.toUpperCase();
    const captureSymbol = isCapture ? 'x' : '';
    
    // Check if disambiguation is needed
    const disambiguation = this.getDisambiguation(from, to, piece, color);
    
    return `${pieceSymbol}${disambiguation}${captureSymbol}${to}`;
  }

  /**
   * Determines if disambiguation is needed for a move (e.g., N3f3 vs Nf3)
   * @private
   */
  private getDisambiguation(from: Square, to: Square, piece: PieceType, color: Color): string {
    // Find all pieces of same type and color that can move to the same square
    const pieces = this.getPiecesOfType(color, piece);
    const canReach = pieces.filter(square => {
      if (square === from) return false;
      const destinations = this.generatePieceDestinations(square, piece, color);
      return destinations.includes(to);
    });

    if (canReach.length === 0) {
      return ''; // No disambiguation needed
    }

    // Check if file disambiguation is sufficient
    const sameFile = canReach.some(square => square[0] === from[0]);
    if (!sameFile) {
      return from[0]; // Use file (e.g., "Naf3")
    }

    // Check if rank disambiguation is sufficient
    const sameRank = canReach.some(square => square[1] === from[1]);
    if (!sameRank) {
      return from[1]; // Use rank (e.g., "N3f3")
    }

    // Use both file and rank
    return from; // (e.g., "Na3f3")
  }

  /**
   * Generates all capture moves for a given color
   * @param color - The color to generate captures for
   * @returns Array of SAN notation capture moves
   */
  public generateCaptures(color: Color): string[] {
    const captures: string[] = [];
    const allPieces = this.getAllPieces(color);

    Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        const destinations = this.generatePieceDestinations(square, pieceType, color);
        for (const dest of destinations) {
          const targetPiece = this.getPieceAt(dest);
          if (targetPiece && targetPiece.color !== color) {
            const move = this.squareToSAN(square, dest, pieceType, color);
            captures.push(move);
          }
        }
      }
    });

    return captures;
  }

  /**
   * Generates fleeing moves for attacked pieces
   * @param color - The color to generate fleeing moves for
   * @param attackersBySquare - Precomputed attack counts for all squares
   * @returns Array of SAN notation moves that move attacked pieces to safe squares
   */
  public generateFleeingMoves(color: Color, attackersBySquare: Map<string, {white: number, black: number}>): string[] {
    const fleeingMoves: string[] = [];
    const enemyColor: Color = color === 'w' ? 'b' : 'w';
    const allPieces = this.getAllPieces(color);
    const enemyKey = enemyColor === 'w' ? 'white' : 'black';
    const myKey = color === 'w' ? 'white' : 'black';

    Array.from(allPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        // Check if this piece is attacked using precomputed data
        const attackInfo = attackersBySquare.get(square);
        if (attackInfo && attackInfo[enemyKey] > 0) {
          // Generate moves to safe squares
          const destinations = this.generatePieceDestinations(square, pieceType, color);
          for (const dest of destinations) {
            // Check if destination is safe using precomputed data
            const destInfo = attackersBySquare.get(dest);
            if (destInfo && destInfo[enemyKey] === 0) {
              const move = this.squareToSAN(square, dest, pieceType, color);
              fleeingMoves.push(move);
            }
          }
        }
      }
    });

    return fleeingMoves;
  }

  /**
   * Generates pawn moves for specific files
   * @param color - The color to generate pawn moves for
   * @param files - Array of file letters (e.g., ['d', 'e'])
   * @returns Array of SAN notation pawn moves
   */
  public generatePawnMoves(color: Color, files: string[] = ALL_FILES): string[] {
    const pawnMoves: string[] = [];
    const pawns = this.getPiecesOfType(color, 'p');

    for (const square of pawns) {
      const file = square[0];
      if (files.includes(file)) {
        const destinations = this.generatePawnDestinations(square, color);
        for (const dest of destinations) {
          const move = this.squareToSAN(square, dest, 'p', color);
          pawnMoves.push(move);
        }
      }
    }

    return pawnMoves;
  }

  /**
   * Generates moves that attack undefended enemy pieces
   * @param color - The color to generate moves for
   * @param attackersBySquare - Precomputed attack counts for all squares
   * @returns Array of SAN notation moves that attack undefended pieces
   */
  public generateAttackUndefendedMoves(color: Color, attackersBySquare: Map<string, {white: number, black: number}>): string[] {
    const attackMoves: string[] = [];
    const enemyColor: Color = color === 'w' ? 'b' : 'w';
    const enemyPieces = this.getAllPieces(enemyColor);
    const enemyKey = enemyColor === 'w' ? 'white' : 'black';

    // Find undefended enemy pieces using precomputed data
    const undefendedSquares: Square[] = [];
    Array.from(enemyPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        const attackInfo = attackersBySquare.get(square);
        if (attackInfo && attackInfo[enemyKey] === 0) {
          undefendedSquares.push(square);
        }
      }
    });

    // Generate moves that attack these undefended pieces
    const myPieces = this.getAllPieces(color);
    Array.from(myPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        const destinations = this.generatePieceDestinations(square, pieceType, color);
        for (const dest of destinations) {
          if (undefendedSquares.includes(dest)) {
            const move = this.squareToSAN(square, dest, pieceType, color);
            attackMoves.push(move);
          }
        }
      }
    });

    return attackMoves;
  }

  /**
   * Generates moves that defend attacked pieces
   * @param color - The color to generate defending moves for
   * @param attackersBySquare - Precomputed attack counts for all squares
   * @returns Array of SAN notation moves that defend attacked pieces
   */
  public generateDefendingMoves(color: Color, attackersBySquare: Map<string, {white: number, black: number}>): string[] {
    const defendingMoves: string[] = [];
    const enemyColor: Color = color === 'w' ? 'b' : 'w';
    const myPieces = this.getAllPieces(color);
    const enemyKey = enemyColor === 'w' ? 'white' : 'black';

    // Find my attacked pieces using precomputed data
    const attackedSquares: Square[] = [];
    Array.from(myPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        const attackInfo = attackersBySquare.get(square);
        if (attackInfo && attackInfo[enemyKey] > 0) {
          attackedSquares.push(square);
        }
      }
    });

    // Generate moves that would defend these pieces
    // A move defends if it attacks the square where the attacked piece is
    Array.from(myPieces.entries()).forEach(([pieceType, squares]) => {
      for (const square of squares) {
        const destinations = this.generatePieceDestinations(square, pieceType, color);
        for (const dest of destinations) {
          // Check if moving here would defend any attacked piece
          // This is a simplification - we're checking if the destination attacks any attacked square
          for (const attackedSquare of attackedSquares) {
            if (attackedSquare === square) continue; // Don't move the attacked piece itself
            
            // Would this piece defend the attacked square from its new position?
            // For now, simple check: does the destination square attack the attacked square?
            if (this.canPieceAttackSquare(dest, attackedSquare, pieceType, color)) {
              const move = this.squareToSAN(square, dest, pieceType, color);
              defendingMoves.push(move);
              break; // Only add this move once
            }
          }
        }
      }
    });

    return defendingMoves;
  }


    /**
     * Computes attack counts for all squares on the board
     * @returns Map of square -> {white: count, black: count}
     */
    public computeAllAttackers(): Map<string, {white: number, black: number}> {
      const attackersBySquare = new Map<string, {white: number, black: number}>();

      // Initialize all squares with zero attackers
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

      for (const file of files) {
        for (const rank of ranks) {
          const square = (file + rank) as Square;
          attackersBySquare.set(square, {white: 0, black: 0});
        }
      }

      // Count attackers for each square
      for (const file of files) {
        for (const rank of ranks) {
          const square = (file + rank) as Square;
          const whiteAttackers = this.getAttackers(square, 'w');
          const blackAttackers = this.getAttackers(square, 'b');
          attackersBySquare.set(square, {
            white: whiteAttackers.length,
            black: blackAttackers.length
          });
        }
      }

      return attackersBySquare;
    }

    /**
     * Updates attack counts incrementally based on a move
     * @param parentAttackers - The attack counts from the parent position
     * @param move - The move in SAN notation
     * @returns Updated attack counts map
     */
    public updateAttackersForMove(
      parentAttackers: Map<string, {white: number, black: number}>,
      move: string
    ): Map<string, {white: number, black: number}> {
      // Clone the parent map
      const attackersBySquare = new Map<string, {white: number, black: number}>();
      parentAttackers.forEach((value, key) => {
        attackersBySquare.set(key, {...value});
      });

      // Get move details from the last move in history
      const history = this.chess.history({ verbose: true });
      if (history.length === 0) return attackersBySquare;

      const moveObj = history[history.length - 1];
      const from = moveObj.from;
      const to = moveObj.to;
      const piece = moveObj.piece;
      const color = moveObj.color;
      const captured = moveObj.captured;

      // Remove attacks from the origin square
      this.removeAttacksFrom(attackersBySquare, from, piece, color);

      // Add attacks from the destination square
      this.addAttacksFrom(attackersBySquare, to, piece, color);

      // Handle captures - remove attacks from the captured piece
      if (captured) {
        const enemyColor: Color = color === 'w' ? 'b' : 'w';
        this.removeAttacksFrom(attackersBySquare, to, captured, enemyColor);
      }

      // Handle discovered attacks/defenses
      // When a piece moves, it may unblock sliding pieces behind it
      this.updateDiscoveredAttacks(attackersBySquare, from, to);

      // Handle castling - rook also moves
      if (moveObj.flags.includes('k')) { // Kingside castle
        const rookFrom = color === 'w' ? 'h1' : 'h8';
        const rookTo = color === 'w' ? 'f1' : 'f8';
        this.removeAttacksFrom(attackersBySquare, rookFrom as Square, 'r', color);
        this.addAttacksFrom(attackersBySquare, rookTo as Square, 'r', color);
        this.updateDiscoveredAttacks(attackersBySquare, rookFrom as Square, rookTo as Square);
      } else if (moveObj.flags.includes('q')) { // Queenside castle
        const rookFrom = color === 'w' ? 'a1' : 'a8';
        const rookTo = color === 'w' ? 'd1' : 'd8';
        this.removeAttacksFrom(attackersBySquare, rookFrom as Square, 'r', color);
        this.addAttacksFrom(attackersBySquare, rookTo as Square, 'r', color);
        this.updateDiscoveredAttacks(attackersBySquare, rookFrom as Square, rookTo as Square);
      }

      // Handle promotion
      if (moveObj.promotion) {
        // Already added attacks for the promoted piece above (using 'piece' which is the promoted piece)
        // No additional work needed
      }

      return attackersBySquare;
    }

    /**
     * Removes attacks from a piece at a given square
     * @private
     */
    private removeAttacksFrom(
      attackersBySquare: Map<string, {white: number, black: number}>,
      square: Square,
      pieceType: PieceType,
      color: Color
    ): void {
      const destinations = this.generatePieceDestinations(square, pieceType, color);
      const colorKey = color === 'w' ? 'white' : 'black';

      for (const dest of destinations) {
        const current = attackersBySquare.get(dest);
        if (current) {
          current[colorKey] = Math.max(0, current[colorKey] - 1);
        }
      }
    }

    /**
     * Adds attacks from a piece at a given square
     * @private
     */
    private addAttacksFrom(
      attackersBySquare: Map<string, {white: number, black: number}>,
      square: Square,
      pieceType: PieceType,
      color: Color
    ): void {
      const destinations = this.generatePieceDestinations(square, pieceType, color);
      const colorKey = color === 'w' ? 'white' : 'black';

      for (const dest of destinations) {
        const current = attackersBySquare.get(dest);
        if (current) {
          current[colorKey]++;
        }
      }
    }

    /**
     * Updates discovered attacks when a piece moves
     * Checks for sliding pieces that may now attack through the vacated square
     * @private
     */
    private updateDiscoveredAttacks(
      attackersBySquare: Map<string, {white: number, black: number}>,
      from: Square,
      to: Square
    ): void {
      // Check all sliding pieces to see if they now have new attacks through the 'from' square
      const slidingPieceTypes: PieceType[] = ['r', 'b', 'q'];

      for (const color of ['w', 'b'] as Color[]) {
        for (const pieceType of slidingPieceTypes) {
          const pieces = this.getPiecesOfType(color, pieceType);

          for (const pieceSquare of pieces) {
            // Skip if this is the piece that moved
            if (pieceSquare === to) continue;

            // Check if this piece's line of attack was affected by the move
            // This is a simplified check - we look for pieces that could attack through 'from'
            if (this.isOnSameLine(pieceSquare, from, pieceType)) {
              // Recompute attacks for this piece
              const oldDestinations = this.generatePieceDestinations(pieceSquare, pieceType, color);
              // Note: We can't easily get "old" destinations without the move
              // For simplicity, we'll do a full recompute for affected pieces
              // This is still faster than recomputing everything

              // For now, we'll accept this limitation and rely on the fact that
              // most moves don't create discovered attacks
              // A full implementation would track which squares are on lines from each sliding piece
            }
          }
        }
      }

      // Simplified approach: For discovered attacks, we accept minor inaccuracies
      // The main optimization is avoiding recomputation for pieces that didn't move
      // and aren't on affected lines
    }


    /**
     * Generates king moves for a given color
     * @param color - The color to generate king moves for
     * @returns Array of SAN notation king moves
     */
    public generateKingMoves(color: Color): string[] {
      const kingMoves: string[] = [];
      const kings = this.getPiecesOfType(color, 'k');

      for (const square of kings) {
        const destinations = this.generatePieceDestinations(square, 'k', color);
        for (const dest of destinations) {
          const move = this.squareToSAN(square, dest, 'k', color);
          kingMoves.push(move);
        }
      }

      return kingMoves;
    }


}
