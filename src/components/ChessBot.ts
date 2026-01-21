import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { MoveEval } from './MoveEval';

// Bot level: 0 = random, 1 = mobility-based, 2 = mobility + material
export type BotLevel = 0 | 1 | 2 | 3 | 4;
export const BOT_COLOR: Color = 'b';
export const MAX_BOT_LEVEL = 4;

// Bot move logic
// In this function, the bot is passed the game object and bot level, and will return a moveString, chatMessage, and logsMessage
// Note: This function does NOT make the move - it only returns what move should be made
export const botMove = (game: Chess, botLevel: BotLevel = 0): { moveString: string | null; chatMessage: string; logsMessage: string } => {
  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.', logsMessage: 'No valid moves available.' };
  }

  switch (botLevel) {
    case 0:
      return randomBotMove(game);
    case 1:
      return material1PlyBotMove(game);
    case 2:
      return material2PlyBotMove(game);
    case 3:
      return materialAndPositional2PlyBotMove(game);  
    case 4:
      return materialAndPositional4PlyBotMove(game);
    default:
      return randomBotMove(game);
  }
}

export type BotResponse = { moveString: string; chatMessage: string; logsMessage: string };

const roundTo = (value: number, denominator: number) => {
  return Math.round(value * denominator) / denominator;
}

const botMoveHelper = (game: Chess, evalFunc: (moveEval: MoveEval) => number, depth: number, botName: string): BotResponse => {
  // Setup
  const moveEval = new MoveEval(game);
  // Eval
  const bestMove = moveEval.minimax(evalFunc, depth, false);
  // Interpret
  const currentScore = roundTo(evalFunc(moveEval), 100);
  const improvement = roundTo(evalFunc(bestMove) - currentScore, 100);
  const msg = getMoveMessage(bestMove, improvement, false);
  const movesAndScores = moveEval.getMovesAndScoresSortedAsString();
  const logsMessage = `${botName}: ${bestMove.getMoveString()}, score improvement: ${improvement}`;
  // Display
  return { 
    moveString: bestMove.getMoveString(), 
    chatMessage: `${msg}\n${head(4, movesAndScores)}`,
    logsMessage: logsMessage + '\n' + bestMove.logs + '\n' + movesAndScores,
  };
};

const randomBotMove = (game: Chess): BotResponse => {
  const depth = 1;
  const evalFunc = (moveEval: MoveEval) => Math.random();
  const botName = '[Level 0] Random';
  return botMoveHelper(game, evalFunc, depth, botName);
};

// Level 1: material eval after 1 ply
const material1PlyBotMove = (game: Chess): BotResponse => {
  const depth = 1;
  const evalFunc = (moveEval: MoveEval) => moveEval.materialPointsAheadForWhite() + jitter();
  const botName = '[Level 1] Material eval (1 ply)';
  return botMoveHelper(game, evalFunc, depth, botName);
};

// Level 2: material eval after 2 ply 
const material2PlyBotMove = (game: Chess): BotResponse => {
  const depth = 2;
  const evalFunc = (moveEval: MoveEval) => moveEval.materialPointsAheadForWhite() + jitter();
  const botName = '[Level 2] Material eval (2 ply)';
  return botMoveHelper(game, evalFunc, depth, botName);
}

// Level 3: material and positional eval after 2 ply 
const materialAndPositional2PlyBotMove = (game: Chess): BotResponse => {
  const depth = 2;
  const evalFunc = (moveEval: MoveEval) => {
    const {white: materialWhite, black: materialBlack} = moveEval.materialPoints();
    const {white: positionalWhite, black: positionalBlack} = moveEval.positionalPoints();
    return (materialWhite + positionalWhite) - (materialBlack + positionalBlack);
  };
  const botName = '[Level 3] Material + positional eval (2 ply)';
  return botMoveHelper(game, evalFunc, depth, botName);
}

// Level 4: material and positional eval after 4 ply 
const materialAndPositional4PlyBotMove = (game: Chess): BotResponse => {
  const depth = 4;
  const evalFunc = (moveEval: MoveEval) => {
    const {white: materialWhite, black: materialBlack} = moveEval.materialPoints();
    const {white: positionalWhite, black: positionalBlack} = moveEval.positionalPoints();
    return (materialWhite + positionalWhite) - (materialBlack + positionalBlack) + jitter();
  };
  const botName = '[Level 4] Material + positional eval (4 ply)';
  return botMoveHelper(game, evalFunc, depth, botName);
}

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

// jitter function returns a random number between -0.0000001 and 0.0000001
const jitter = () => {
  return Math.random() * 0.0000002 - 0.0000001;
}

const head = (lines: number, text: string) => {
  return text.split('\n').slice(0, lines).join('\n');
}