import { Chess } from 'chess.js';
import type { Color } from 'chess.js';

/**
 * Game phase enumeration
 */
export enum GamePhase {
  OPENING = 'opening',
  MIDDLEGAME = 'middlegame',
  ENDGAME = 'endgame'
}

/**
 * Context about the current game state for move idea evaluation
 */
export interface GameContext {
  moveNumber: number;
  materialBalance: number; // positive = white ahead, negative = black ahead
  phase: GamePhase;
}

/**
 * A strategic move idea that can generate candidate moves
 */
export interface MoveIdea {
  name: string;
  description: string;
  priority: number; // higher = more important
  isRelevant: (context: GameContext, color: Color) => boolean;
  generateMoves: (game: Chess, color: Color) => string[];
}

/**
 * Array of strategic move ideas
 */
export const MOVE_IDEAS: MoveIdea[] = [
  // High priority: Tactical moves
  {
    name: 'Capture free piece',
    description: 'Capture opponent pieces that are undefended',
    priority: 100,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.captured !== undefined)
        .map(move => move.san);
    }
  },
  
  {
    name: 'Recapture',
    description: 'Recapture if a piece was just taken',
    priority: 95,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      const history = game.history({ verbose: true });
      if (history.length === 0) return [];
      
      const lastMove = history[history.length - 1];
      if (!lastMove.captured) return [];
      
      // Generate moves that capture on the square where the last capture happened
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.to === lastMove.to && move.captured !== undefined)
        .map(move => move.san);
    }
  },
  
  {
    name: 'Defend attacked piece',
    description: 'Defend pieces that are under attack',
    priority: 90,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color) => {
      // For now, return all moves (defending is complex to detect)
      // TODO: Implement proper defense detection using BoardSense
      return [];
    }
  },
  
  // Opening moves
  {
    name: 'Push center pawn',
    description: 'Push d or e pawn toward center',
    priority: 80,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => {
          const piece = move.piece;
          const from = move.from;
          const to = move.to;
          
          // Check if it's a pawn move on d or e file
          if (piece !== 'p') return false;
          const file = from[0];
          if (file !== 'd' && file !== 'e') return false;
          
          // Check if moving toward center (rank 4 or 5)
          const toRank = parseInt(to[1]);
          return toRank === 4 || toRank === 5;
        })
        .map(move => move.san);
    }
  },
  
  {
    name: 'Develop knight',
    description: 'Develop knights toward center',
    priority: 75,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => {
          if (move.piece !== 'n') return false;
          
          // Prefer moves to c3, f3, c6, f6 (good knight squares)
          const to = move.to;
          const goodSquares = ['c3', 'f3', 'c6', 'f6', 'd2', 'e2', 'd7', 'e7'];
          return goodSquares.includes(to);
        })
        .map(move => move.san);
    }
  },
  
  {
    name: 'Develop bishop',
    description: 'Develop bishops to active squares',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.piece === 'b')
        .map(move => move.san);
    }
  },
  
  {
    name: 'Castle',
    description: 'Castle to protect king',
    priority: 85,
    isRelevant: (context) => context.phase === GamePhase.OPENING || context.phase === GamePhase.MIDDLEGAME,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.flags.includes('k') || move.flags.includes('q'))
        .map(move => move.san);
    }
  },
  
  // Material-based moves
  {
    name: 'Seek trades',
    description: 'Trade pieces when ahead in material',
    priority: 60,
    isRelevant: (context, color) => {
      const ahead = color === 'w' ? context.materialBalance > 2 : context.materialBalance < -2;
      return ahead;
    },
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      // Moves that capture (potential trades)
      return moves
        .filter(move => move.captured !== undefined)
        .map(move => move.san);
    }
  },
  
  {
    name: 'Avoid trades',
    description: 'Avoid trading pieces when behind in material',
    priority: 55,
    isRelevant: (context, color) => {
      const behind = color === 'w' ? context.materialBalance < -2 : context.materialBalance > 2;
      return behind;
    },
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      // Moves that don't capture (avoid trades)
      return moves
        .filter(move => move.captured === undefined)
        .map(move => move.san);
    }
  },
  
  // Endgame moves
  {
    name: 'Activate king',
    description: 'Bring king toward center in endgame',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.ENDGAME,
    generateMoves: (game: Chess, color: Color) => {
      const moves = game.moves({ verbose: true });
      return moves
        .filter(move => move.piece === 'k')
        .map(move => move.san);
    }
  },
  
  // Fallback: consider all moves
  {
    name: 'All legal moves',
    description: 'Consider all legal moves as fallback',
    priority: 1,
    isRelevant: () => true,
    generateMoves: (game: Chess, color: Color) => {
      return game.moves();
    }
  }
];
