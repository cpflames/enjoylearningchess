import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { GLOBAL_EVAL_COUNT, MoveEval } from './MoveEval';
import { BoardSense } from './BoardSense';
import { ALL_CONCEPTS, ChessConcept, evaluateConcepts } from './ChessConcepts';

export const BOT_COLOR: Color = 'b';

// Evaluation strategies

export type evalStrategy = {
  evalFunc: (moveEval: MoveEval) => number;
  strategyName: string;
}

// Depth strategies

export type DepthStrategy = {
  shouldExtend: (moveEval: MoveEval, depth: number, extensionsUsed: number) => boolean;
  maxExtensions: number;
  strategyName: string;
}

// Move generation strategies

export type MoveGenerationStrategy = {
  generateCandidates: (game: Chess, color: Color, moveEval?: MoveEval) => string[];
  strategyName: string;
}

export const RANDOM_STRATEGY: evalStrategy = {
  evalFunc: (moveEval: MoveEval) => Math.random(),
  strategyName: 'Random',
}

export const MATERIAL_STRATEGY: evalStrategy = {
  evalFunc: (moveEval: MoveEval) => moveEval.materialPointsAheadForWhite() + jitter(),
  strategyName: 'Material',
}

export const MATERIAL_AND_POSITIONAL_STRATEGY: evalStrategy = {
  evalFunc: (moveEval: MoveEval) => moveEval.materialPointsAheadForWhite() + moveEval.positionalPointsAheadForWhite() + jitter(),
  strategyName: 'Material + positional',
}

const makeBoardsenseStrategy = (concepts: ChessConcept[]): evalStrategy => ({
  evalFunc: (moveEval: MoveEval) => {
    const boardSense = new BoardSense(moveEval.getGame());

    // Base evaluation: material + positional
    let score = moveEval.materialPointsAheadForWhite() + moveEval.positionalPointsAheadForWhite();

    // Mobility advantage (0.02 points per move advantage)
    score += boardSense.getMobilityDifference() * 0.02;

    // King safety (0.1 points per safety score point)
    //const whiteKingSafety = boardSense.getKingSafety('w');
    //const blackKingSafety = boardSense.getKingSafety('b');
    //score += (whiteKingSafety.safetyScore - blackKingSafety.safetyScore) * 0.1;

    // Pawn structure (use the composite structure score)
    //const whitePawnStructure = boardSense.getPawnStructureMetrics('w');
    //const blackPawnStructure = boardSense.getPawnStructureMetrics('b');
    //score += (whitePawnStructure.structureScore - blackPawnStructure.structureScore) * 0.05;

    // ChessConcepts: strategic penalties/bonuses
    score += evaluateConcepts(moveEval, concepts);

    return score + jitter();
  },
  strategyName: concepts.length > 0 ? 'BoardSense Enhanced + Concepts' : 'BoardSense Enhanced',
});

export const BOARDSENSE_STRATEGY: evalStrategy = makeBoardsenseStrategy([]);

// Depth strategies

export const HARD_STOP_DEPTH: DepthStrategy = {
  shouldExtend: () => false,
  maxExtensions: 0,
  strategyName: 'Hard Stop'
};

export const QUIESCE_DEPTH: DepthStrategy = {
  shouldExtend: (moveEval: MoveEval, depth: number, extensionsUsed: number) => {
    // Extend if this move is a capture and we'd hit depth 0
    return depth === 0 && moveEval.wasLastMoveCapture();
  },
  maxExtensions: 5,
  strategyName: 'Quiescence'
};

// Move generation strategies

export const RANKED_MOVE_GEN: MoveGenerationStrategy = {
  generateCandidates: (game: Chess) => game.moves(),
  strategyName: 'Ranked'
};

export const GOAL_BASED_MOVE_GEN: MoveGenerationStrategy = {
  generateCandidates: (game: Chess, color: Color, moveEval?: MoveEval) => {
    if (!moveEval) return game.moves();
    return moveEval.generateCandidateMoves(color);
  },
  strategyName: 'Goal-Based'
};

// Bot configs

export type BotConfig = {
  depth: number;
  breadthPerDepth: number[]; // breadth at each depth layer: [root, depth-1, depth-2, ...]; last element used for deeper layers
  evalStrategy: evalStrategy;
  depthStrategy: DepthStrategy;
  moveGenStrategy: MoveGenerationStrategy;
  botName: string;
}

const makeBotConfig = (
  level: number,
  depth: number,
  breadthPerDepth: number[],
  depthStrategy: DepthStrategy,
  moveGenStrategy: MoveGenerationStrategy,
  evalStrategy: evalStrategy
): BotConfig => {
  const breadthStr = breadthPerDepth.length === 1
    ? `${breadthPerDepth[0]}`
    : breadthPerDepth.join('/');
  return {
    depth,
    breadthPerDepth,
    evalStrategy,
    depthStrategy,
    moveGenStrategy,
    botName: `[Level ${level}] ${evalStrategy.strategyName} (${depth}-Ply x ${breadthStr}) with ${depthStrategy.strategyName} depth and ${moveGenStrategy.strategyName} move generation`
  };
}

const BOARDSENSE_WITH_CONCEPTS: evalStrategy = makeBoardsenseStrategy(ALL_CONCEPTS);

export const BOT_CONFIGS: BotConfig[] = [
  makeBotConfig(0, 1, [50],         HARD_STOP_DEPTH, RANKED_MOVE_GEN,    RANDOM_STRATEGY),
  makeBotConfig(1, 1, [50],         HARD_STOP_DEPTH, RANKED_MOVE_GEN,    MATERIAL_STRATEGY),
  makeBotConfig(2, 2, [40],         HARD_STOP_DEPTH, RANKED_MOVE_GEN,    MATERIAL_STRATEGY),
  makeBotConfig(3, 2, [20],         HARD_STOP_DEPTH, RANKED_MOVE_GEN,    MATERIAL_AND_POSITIONAL_STRATEGY),
  makeBotConfig(4, 4, [10],         HARD_STOP_DEPTH, RANKED_MOVE_GEN,    MATERIAL_AND_POSITIONAL_STRATEGY),
  makeBotConfig(5, 3, [10],         QUIESCE_DEPTH,   RANKED_MOVE_GEN,    BOARDSENSE_STRATEGY),
  makeBotConfig(6, 3, [10, 7, 5],   QUIESCE_DEPTH,   GOAL_BASED_MOVE_GEN, BOARDSENSE_WITH_CONCEPTS),
  makeBotConfig(7, 4, [10, 7, 5, 3], QUIESCE_DEPTH,  GOAL_BASED_MOVE_GEN, BOARDSENSE_WITH_CONCEPTS),
];

export const MAX_BOT_LEVEL = BOT_CONFIGS.length - 1;

export type BotLevel = number;

// Bot move logic
// In this function, the bot is passed the game object and bot level, and will return a moveString, chatMessage, and logsMessage
// Note: This function does NOT make the move - it only returns what move should be made
export const botMove = (game: Chess, botLevel: number): { moveString: string | null; chatMessage: string; logsMessage: string } => {
  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.', logsMessage: 'No valid moves available.' };
  }

  const botConfig = BOT_CONFIGS[botLevel];
  return botMoveHelper(game, botConfig);
}

export type BotResponse = { moveString: string; chatMessage: string; logsMessage: string };

const roundTo = (value: number, denominator: number) => {
  return Math.round(value * denominator) / denominator;
}

const timeOf = (name: string, duration: number) => {
  return `${name} time: ${duration.toFixed(2)}ms`;
}

const botMoveHelper = (game: Chess, botConfig: BotConfig): BotResponse => {
  // Setup
  const startTime = performance.now();
  const moveEval = MoveEval.fromScratch(cloneGame(game), botConfig);
  // Eval
  const bestMove = moveEval.minimax();
  const evalEndTime = performance.now();
  // Interpret
  const currentScore = roundTo(moveEval.initialScore, 100);
  const improvement = roundTo(bestMove.score - currentScore, 100);
  const msg = getMoveMessage(bestMove, improvement, false);
  const currentEvalMsg = moveEval.getCurrentEvalAsString();
  const topMovesMsg = moveEval.getTopMovesAsString(3);
  const allPossibleMovesMsg = moveEval.getAllPossibleMovesAsString();
  const allTopMovesMsg = moveEval.getAllTopMovesAsString();

  const endTime = performance.now();
  const evalTime = evalEndTime - startTime;
  const interpretTime = endTime - evalEndTime;
  const totalTime = endTime - startTime;
  const timeMsg = timeOf('Eval', evalTime) + ', ' + timeOf('Interpret', interpretTime) + ', ' + timeOf('Total', totalTime);
  const logsMessage = `${botConfig.botName}: ${bestMove.getMoveString()}, score improvement: ${improvement}`;
  const evalCountMsg = `Eval count: ${GLOBAL_EVAL_COUNT}`;
  // Display
  return { 
    moveString: bestMove.getMoveString(), 
    chatMessage: `${msg}\n${currentEvalMsg}\nTop 3 lines:\n${head(3, topMovesMsg)}`,
    logsMessage: [logsMessage, timeMsg, evalCountMsg, currentEvalMsg, moveEval.logs, bestMove.logs, allPossibleMovesMsg, allTopMovesMsg].join('\n'),
  };
};

const getMoveMessage = (moveEval: MoveEval, improvement: number, isMaximizing: boolean) => {
  if (!isMaximizing) {
    improvement = -1 * improvement;
  }

  const moveStr = moveEval.getMoveString();
  const reason = moveEval.moveReason;

  if (reason) {
    return `I chose ${moveStr} ${reason}`;
  }

  let msg = "";
  if (improvement > 0) {
    msg += `I chose ${moveStr} to win ${improvement} points.`;
  } else if (improvement < 0) {
    msg += `Well, best option I found is ${moveStr} to lose only ${-improvement} points.`;
  } else {
    msg += `I don't see any move to gain points, so I'll just play ${moveStr}.`;
  }
  return msg;
}

const cloneGame = (game: Chess) => {
  return new Chess(game.fen());
}

// jitter function returns a random number between -0.0000001 and 0.0000001
const jitter = () => {
  return Math.random() * 0.0000002 - 0.0000001;
}

const head = (lines: number, text: string) => {
  return text.split('\n').slice(0, lines).join('\n');
}