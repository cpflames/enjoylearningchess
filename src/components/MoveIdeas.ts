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
 * A strategic move idea that can generate candidate moves
 */
export interface MoveIdea {
  name: string;
  description: string;
  priority: number; // higher = more important
  isRelevant: (context: GameContext, color: Color) => boolean;
  generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => string[];
}

/**
 * Array of strategic move ideas
 */
export const MOVE_IDEAS: MoveIdea[] = [
  // High priority: Tactical moves
  {
    name: 'Capture',
    description: 'Capture opponent pieces',
    priority: 100,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generateCaptures(color);
    }
  },
  
  {
    name: 'Flee from attack',
    description: 'Move attacked pieces to safety',
    priority: 95,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generateFleeingMoves(color, attackersBySquare);
    }
  },
  
  {
    name: 'Attack undefended piece',
    description: 'Attack opponent pieces that are undefended',
    priority: 90,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generateAttackUndefendedMoves(color, attackersBySquare);
    }
  },
  
  {
    name: 'Defend attacked piece',
    description: 'Defend pieces that are under attack',
    priority: 85,
    isRelevant: () => true, // Always relevant
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generateDefendingMoves(color, attackersBySquare);
    }
  },
  
  // Opening moves
  {
    name: 'Push center pawn',
    description: 'Push d or e pawn toward center',
    priority: 80,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generatePawnMoves(color, ['d', 'e']);
    }
  },
  
  {
    name: 'Develop knight',
    description: 'Develop knights toward center',
    priority: 75,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: () => {
      // Hardcoded best knight development squares
      return ['Nf3', 'Nc3', 'Nf6', 'Nc6'];
    }
  },
  
  {
    name: 'Develop bishop',
    description: 'Develop bishops to active squares',
    priority: 70,
    isRelevant: (context) => context.phase === GamePhase.OPENING,
    generateMoves: () => {
      // Hardcoded best bishop development squares
      return ['Bb4', 'Bb5', 'Bc4', 'Bc5', 'Bf4', 'Bf5', 'Bg4', 'Bg5'];
    }
  },
  
  {
    name: 'Castle',
    description: 'Castle to protect king',
    priority: 65,
    isRelevant: (context) => context.phase === GamePhase.OPENING || context.phase === GamePhase.MIDDLEGAME,
    generateMoves: () => {
      // Hardcoded castling moves
      return ['O-O', 'O-O-O'];
    }
  },

    {
    name: 'Kick minor pieces',
    description: 'pawn push that denies a key square to knights and bishops, and creates escape for castled king',
    priority: 40,
    isRelevant: (context) => context.phase === GamePhase.OPENING || context.phase === GamePhase.MIDDLEGAME,
    generateMoves: () => {
      // Hardcoded moves
      return ['a3', 'h3', 'a6', 'h6'];
    }
  },
  
  // Endgame moves
  {
    name: 'Move King',
    description: 'Activate king in endgame',
    priority: 60,
    isRelevant: (context) => context.phase === GamePhase.ENDGAME,
    generateMoves: (game: Chess, color: Color, boardSense: BoardSense, attackersBySquare: Map<string, {white: number, black: number}>) => {
      return boardSense.generateKingMoves(color);
    }
  }
];
