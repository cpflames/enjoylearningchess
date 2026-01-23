import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { GLOBAL_EVAL_COUNT, MoveEval } from './MoveEval';

export const BOT_COLOR: Color = 'b';

// Evaluation strategies

export type evalStrategy = {
  evalFunc: (moveEval: MoveEval) => number;
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

// Bot configs

export type BotConfig = {
  depth: number;
  breadth: number;
  strategy: evalStrategy;
  botName: string;
}

const makeBotConfig = (level: number, depth: number, breadth: number, strategy: evalStrategy): BotConfig => {
  return { depth, breadth, strategy, botName: `[Level ${level}] ${strategy.strategyName} (${depth}-Ply x ${breadth})` };
}

export const BOT_CONFIGS: BotConfig[] = [
  makeBotConfig(0, 1, 50, RANDOM_STRATEGY),
  makeBotConfig(1, 1, 50, MATERIAL_STRATEGY),
  makeBotConfig(2, 2, 40, MATERIAL_STRATEGY),
  makeBotConfig(3, 2, 20, MATERIAL_AND_POSITIONAL_STRATEGY),
  makeBotConfig(4, 4, 10, MATERIAL_AND_POSITIONAL_STRATEGY),
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
    chatMessage: `${msg}\n${currentEvalMsg}\n${head(3, topMovesMsg)}`,
    logsMessage: [logsMessage, timeMsg, evalCountMsg, currentEvalMsg, moveEval.logs, bestMove.logs, allPossibleMovesMsg, allTopMovesMsg].join('\n'),
  };
};

const getMoveMessage = (moveEval: MoveEval, improvement: number, isMaximizing: boolean) => {
  if (!isMaximizing) {
    improvement = -1 * improvement;
  }

  let msg = "";
  if (improvement > 0) {
    msg += `I chose ${moveEval.getMoveString()} to win ${improvement} points.`
  } else if (improvement < 0) {
    msg += `Hmm... it seems my least bad option is ${moveEval.getMoveString()} to lose only ${-improvement} points.`
  } else {
    msg += `I don't see any move to gain points, so I'll just play ${moveEval.getMoveString()}.`
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