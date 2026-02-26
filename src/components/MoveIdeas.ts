import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { BoardSense } from './BoardSense';

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
 * A strategic move idea that can generate candidate moves with reasons
 */
export interface MoveIdea {
  name: string;
  description: string;
  reason: string; // Explanation for why this move is being made (e.g., "to develop my knight to the center")
  priority: number; // higher = more important
  isRelevant: (context: GameContext, color: Color) => boolean;
  generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => Array<{move: string, reason: string}>;
}

/**
 * Array of strategic move ideas
 */
export const MOVE_IDEAS: MoveIdea[] = [
  // High priority: Tactical moves
  {
    name: 'Capture',
    description: 'Capture opponent pieces',
    reason: 'to capture material',
    priority: 100,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generateCaptures(color);
      return moves.map(move => ({ move, reason: 'to capture material' }));
    }
  },
  
  {
    name: 'Flee from attack',
    description: 'Move attacked pieces to safety',
    reason: 'to move my piece to safety',
    priority: 95,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generateFleeingMoves(color, attackersBySquare);
      return moves.map(move => ({ move, reason: 'to move my piece to safety' }));
    }
  },
  
  {
    name: 'Attack undefended piece',
    description: 'Attack opponent pieces that are undefended',
    reason: 'to attack an undefended piece',
    priority: 90,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generateAttackUndefendedMoves(color, attackersBySquare);
      return moves.map(move => ({ move, reason: 'to attack an undefended piece' }));
    }
  },
  
  {
    name: 'Defend attacked piece',
    description: 'Defend pieces that are under attack',
    reason: 'to defend my attacked piece',
    priority: 85,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generateDefendingMoves(color, attackersBySquare);
      return moves.map(move => ({ move, reason: 'to defend my attacked piece' }));
    }
  },
  
  // Opening moves
  {
    name: 'Push center pawn',
    description: 'Push d or e pawn toward center',
    reason: 'to control the center',
    priority: 80,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generatePawnMoves(color, ['d', 'e']);
      return moves.map(move => ({ move, reason: 'to control the center' }));
    }
  },
  
  {
    name: 'Develop knight',
    description: 'Develop knights toward center',
    reason: 'to develop my knight',
    priority: 75,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: () => {
      // Hardcoded best knight development squares
      const moves = ['Nf3', 'Nc3', 'Nf6', 'Nc6'];
      return moves.map(move => ({ move, reason: 'to develop my knight' }));
    }
  },
  
  {
    name: 'Develop bishop',
    description: 'Develop bishops to active squares',
    reason: 'to develop my bishop',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: () => {
      // Hardcoded best bishop development squares
      const moves = ['Bb4', 'Bb5', 'Bc4', 'Bc5', 'Bf4', 'Bf5', 'Bg4', 'Bg5'];
      return moves.map(move => ({ move, reason: 'to develop my bishop' }));
    }
  },
  
  {
    name: 'Castle',
    description: 'Castle to protect king',
    reason: 'to castle and protect my king',
    priority: 65,
    isRelevant: (context) => context.phase === GamePhase.OPENING || context.phase === GamePhase.MIDDLEGAME,
    generateMoves: () => {
      // Hardcoded castling moves
      const moves = ['O-O', 'O-O-O'];
      return moves.map(move => ({ move, reason: 'to castle and protect my king' }));
    }
  },
  
  // Endgame moves
  {
    name: 'Move King',
    description: 'Activate king in endgame',
    reason: 'to activate my king',
    priority: 60,
    isRelevant: (context) => context.phase === GamePhase.ENDGAME,
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      const moves = boardSense.generateKingMoves(color);
      return moves.map(move => ({ move, reason: 'to activate my king' }));
    }
  }
];
