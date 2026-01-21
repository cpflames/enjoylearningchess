import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { MoveEval } from './MoveEval';

// Bot level: 0 = random, 1 = mobility-based, 2 = mobility + material
export type BotLevel = 0 | 1 | 2 | 3 | 4;
export const BOT_COLOR: Color = 'b';
export const MAX_BOT_LEVEL = 4;

// Bot move logic
// In this function, the bot is passed the game object and bot level, and will return a moveString and a chatMessage
// Note: This function does NOT make the move - it only returns what move should be made
export const botMove = (game: Chess, botLevel: BotLevel = 0): { moveString: string | null; chatMessage: string } => {
  const possibleMoves = game.moves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.' };
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

const randomBotMove = (game: Chess): { moveString: string | null; chatMessage: string } => {
  const moveEval = new MoveEval(game);
  
  const evalFunc = (moveEval: MoveEval) => {
    return Math.random();
  }
  const bestMove = moveEval.minimax(evalFunc, 1, false);
  return { moveString: bestMove.getMoveString(), 
    chatMessage: `Out of ${moveEval.possibleMoves.length} possible moves, I chose to move the ${moveEval.bestMove.getPieceName()}.` };
};

// Level 1: material eval after 1 ply 
const material1PlyBotMove = (game: Chess): { moveString: string | null; chatMessage: string } => {
  const moveEval = new MoveEval(game);
  const depth = 1;
  const evalFunc = (moveEval: MoveEval) => {
    return moveEval.materialPointsAheadForWhite() + jitter();
  }
  const myBestMove = moveEval.minimax(evalFunc, depth, false);

  const currentScore = evalFunc(moveEval);
  const improvement = Math.round(-1 * (myBestMove.score - currentScore)); // round to nearest integer
  const msg = getMoveMessage(myBestMove, improvement);
  return { moveString: myBestMove.getMoveString(), chatMessage: msg };
};

// // makeBotMove will return an array of MoveEval objects, one for each possible move, ordered from best to worst.
// // it will save into each MoveEval, the move that was made, the score of the move, and the move path and final state of that line.
// // it will also save into each MoveEval, an explanation of the score of that move, created by diffing the final state of that line with the current state.
// const makeBotMove = (game: Chess, depth: number, evalFunc: (moveEval: MoveEval) => number) => {
//   const moveEval = new MoveEval(game);
//   const {move: myBestMove, score: myBestScore} = moveEval.minimax(evalFunc, depth, '');
//   const currentScore = evalFunc(moveEval);
//   const improvement = Math.round(myBestScore - currentScore); // round to nearest integer
//   const msg = getMoveMessage(myBestMove, improvement);
//   return { moveString: myBestMove.getMoveString(), chatMessage: msg };
// }

// Level 2: material eval after 2 ply 
const material2PlyBotMove = (game: Chess): { moveString: string | null; chatMessage: string } => {
  const moveEval = new MoveEval(game);
  
  const evalFunc = (moveEval: MoveEval) => {
    const {white: materialWhite, black: materialBlack} = moveEval.materialPoints();
    return (materialBlack - materialWhite);
  }
  const myBestMove = getBestMove(moveEval, evalFunc);
  const currentScore = roundTo(evalFunc(moveEval), 100);
  const improvement = roundTo(evalFunc(myBestMove) - currentScore, 100);
  return { moveString: myBestMove.getMoveString(), chatMessage: getMoveMessage(myBestMove, improvement) };
}

// Level 3: material and positional eval after 2 ply 
const materialAndPositional2PlyBotMove = (game: Chess) => {
  const moveEval = new MoveEval(game);

  const evalFunc = (moveEval: MoveEval) => {
    const {white: materialWhite, black: materialBlack} = moveEval.materialPoints();
    const {white: positionalWhite, black: positionalBlack} = moveEval.positionalPoints();
    return (materialBlack + positionalBlack) - (materialWhite + positionalWhite);
  }

  const myBestMove = getBestMove(moveEval, evalFunc);
  const currentScore = roundTo(evalFunc(moveEval), 100);
  const improvement = roundTo(evalFunc(myBestMove) - currentScore, 100);

  return { moveString: myBestMove.getMoveString(), chatMessage: getMoveMessage(myBestMove, improvement) };
}

// Level 4: material and positional eval after 4 ply 
const materialAndPositional4PlyBotMove = (game: Chess) => {
  const moveEval = new MoveEval(game);

  const evalFunc = (moveEval: MoveEval) => {
    const {white: materialWhite, black: materialBlack} = moveEval.materialPoints();
    const {white: positionalWhite, black: positionalBlack} = moveEval.positionalPoints();
    return (materialBlack + positionalBlack) - (materialWhite + positionalWhite);
  }

  const myBestMove = getBestMove(moveEval, evalFunc);
  const currentScore = roundTo(evalFunc(moveEval), 100);
  const improvement = roundTo(evalFunc(myBestMove) - currentScore, 100);

  return { moveString: myBestMove.getMoveString(), chatMessage: getMoveMessage(myBestMove, improvement) };
}

const getBestMove = (moveEval: MoveEval, func: (moveEval: MoveEval) => number) => {
  const possibleMoves = moveEval.findPossibleMoves();
  let myBestMove = possibleMoves[0];
  let myBestScore = -Infinity;
  for (const myMove of possibleMoves) {
    //let theirBestMove = myMove.possibleMoves()[0];
    let theirBestScore = Infinity;
    for (const theirMove of myMove.findPossibleMoves()) {
      const score = func(theirMove) + jitter();
      if (score < theirBestScore) {
        theirBestScore = score;
        //theirBestMove = theirMove;
      }
    }
    if (theirBestScore > myBestScore) {
      myBestScore = theirBestScore;
      myBestMove = myMove;
    }
  }
  return myBestMove;
}

const getMoveMessage = (moveEval: MoveEval, improvement: number) => {
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

const roundTo = (value: number, denominator: number) => {
  return Math.round(value * denominator) / denominator;
}

