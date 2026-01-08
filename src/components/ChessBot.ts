import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
import { MoveEval } from './MoveEval';

// Bot level: 0 = random, 1 = mobility-based, 2 = mobility + material
export type BotLevel = 0 | 1 | 2;
export const BOT_COLOR: Color = 'b';

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
    default:
      return randomBotMove(game);
  }
}

const randomBotMove = (game: Chess) => {
  const moveEval = new MoveEval(game);
  const possibleMoves = moveEval.possibleMoves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.' };
  }
  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  const chosenMove = possibleMoves[randomIdx];
  return { moveString: chosenMove.getMoveString(), 
    chatMessage: `Out of ${possibleMoves.length} possible moves, I chose the ${chosenMove.getPieceName()}.` };
};

// Level 1: material eval after 1 ply 
const material1PlyBotMove = (game: Chess) => {
  const moveEval = new MoveEval(game);
  const possibleMoves = moveEval.possibleMoves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.' };
  }

  let myBestMove = possibleMoves[0];
  let myBestScore = -Infinity;

  for (const myMove of possibleMoves) {
    const score = myMove.pointsAhead(game.turn()) + jitter();
    if (score > myBestScore) {
      myBestScore = score;
      myBestMove = myMove;
    }
  }
  const currentScore = moveEval.pointsAhead(game.turn());
  const improvement = Math.round(myBestScore - currentScore); // round to nearest integer
  return { moveString: myBestMove.getMoveString(), 
    chatMessage: `I chose to move my ${myBestMove.getPieceName()} to win ${improvement} points.` };
};

// TODO: Setup Level 2 version to recursively call into Level 1 version
// Level 1 version will need to return a moveEval object, most likely.

// Level 2: material eval after 2 ply 
const material2PlyBotMove = (game: Chess) => {
  const moveEval = new MoveEval(game);
  const possibleMoves = moveEval.possibleMoves();
  if (possibleMoves.length === 0) {
    return { moveString: null, chatMessage: 'No valid moves available.' };
  }

  let myBestMove = possibleMoves[0];
  let myBestScore = -Infinity;

  for (const myMove of possibleMoves) {
    //let theirBestMove = myMove.possibleMoves()[0];
    let theirBestScore = Infinity;
    for (const theirMove of myMove.possibleMoves()) {
      const score = theirMove.pointsAhead(BOT_COLOR) + jitter();
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
  const currentScore = moveEval.pointsAhead(game.turn());
  const improvement = Math.round(myBestScore - currentScore);
  let msg = "";
  if (improvement > 0) {
    msg += `I chose ${myBestMove.getMoveString()} to win ${improvement} points.`
  } else if (improvement < 0) {
    msg += `Hmm... it seems my least bad option is ${myBestMove.getMoveString()} to lose only ${-improvement} points.`
  } else {
    msg += `I don't see any move to gain points, so I'll just play ${myBestMove.getMoveString()}.`
  }
  return { moveString: myBestMove.getMoveString(), chatMessage: msg };
};

// jitter function returns a random number between -0.0000001 and 0.0000001
const jitter = () => {
  return Math.random() * 0.0000002 - 0.0000001;
}

