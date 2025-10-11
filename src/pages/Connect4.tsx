import React, { useState, useEffect } from 'react';
import './Connect4.css';

type Player = 'red' | 'yellow' | null;
type Board = Player[][];

const ROWS = 6;
const COLS = 7;
const EMPTY_BOARD: Board = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));

// AI difficulty - number of moves to look ahead
const AI_DEPTH = 4;

export default function Connect4(): JSX.Element {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState<'red' | 'yellow'>('red');
  const [winner, setWinner] = useState<Player | 'draw'>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  // Check if a player has won
  const checkWinner = (board: Board): Player | 'draw' => {
    // Check horizontal
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS - 3; col++) {
        const player = board[row][col];
        if (player && 
            player === board[row][col + 1] && 
            player === board[row][col + 2] && 
            player === board[row][col + 3]) {
          return player;
        }
      }
    }

    // Check vertical
    for (let row = 0; row < ROWS - 3; row++) {
      for (let col = 0; col < COLS; col++) {
        const player = board[row][col];
        if (player && 
            player === board[row + 1][col] && 
            player === board[row + 2][col] && 
            player === board[row + 3][col]) {
          return player;
        }
      }
    }

    // Check diagonal (down-right)
    for (let row = 0; row < ROWS - 3; row++) {
      for (let col = 0; col < COLS - 3; col++) {
        const player = board[row][col];
        if (player && 
            player === board[row + 1][col + 1] && 
            player === board[row + 2][col + 2] && 
            player === board[row + 3][col + 3]) {
          return player;
        }
      }
    }

    // Check diagonal (down-left)
    for (let row = 0; row < ROWS - 3; row++) {
      for (let col = 3; col < COLS; col++) {
        const player = board[row][col];
        if (player && 
            player === board[row + 1][col - 1] && 
            player === board[row + 2][col - 2] && 
            player === board[row + 3][col - 3]) {
          return player;
        }
      }
    }

    // Check for draw
    if (board.every(row => row.every(cell => cell !== null))) {
      return 'draw';
    }

    return null;
  };

  // Get valid columns (columns that aren't full)
  const getValidColumns = (board: Board): number[] => {
    const validCols: number[] = [];
    for (let col = 0; col < COLS; col++) {
      if (board[0][col] === null) {
        validCols.push(col);
      }
    }
    return validCols;
  };

  // Drop a piece in a column
  const dropPiece = (board: Board, col: number, player: Player): Board | null => {
    if (board[0][col] !== null) return null; // Column is full

    const newBoard = board.map(row => [...row]);
    for (let row = ROWS - 1; row >= 0; row--) {
      if (newBoard[row][col] === null) {
        newBoard[row][col] = player;
        return newBoard;
      }
    }
    return null;
  };

  // Evaluate board position for AI
  const evaluateBoard = (board: Board): number => {
    const winner = checkWinner(board);
    if (winner === 'yellow') return 1000;
    if (winner === 'red') return -1000;
    if (winner === 'draw') return 0;

    let score = 0;

    // Simple heuristic: count potential winning positions
    // This is a simplified evaluation - a more sophisticated AI would look at patterns
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (board[row][col] === 'yellow') score += 1;
        if (board[row][col] === 'red') score -= 1;
      }
    }

    return score;
  };

  // Minimax algorithm with alpha-beta pruning
  const minimax = (
    board: Board, 
    depth: number, 
    alpha: number, 
    beta: number, 
    isMaximizing: boolean
  ): number => {
    const winner = checkWinner(board);
    if (winner !== null || depth === 0) {
      return evaluateBoard(board);
    }

    const validCols = getValidColumns(board);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const col of validCols) {
        const newBoard = dropPiece(board, col, 'yellow');
        if (newBoard) {
          const score = minimax(newBoard, depth - 1, alpha, beta, false);
          maxScore = Math.max(maxScore, score);
          alpha = Math.max(alpha, score);
          if (beta <= alpha) break; // Beta cutoff
        }
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const col of validCols) {
        const newBoard = dropPiece(board, col, 'red');
        if (newBoard) {
          const score = minimax(newBoard, depth - 1, alpha, beta, true);
          minScore = Math.min(minScore, score);
          beta = Math.min(beta, score);
          if (beta <= alpha) break; // Alpha cutoff
        }
      }
      return minScore;
    }
  };

  // AI makes a move
  const makeAIMove = (board: Board): number => {
    const validCols = getValidColumns(board);
    let bestCol = validCols[0];
    let bestScore = -Infinity;

    for (const col of validCols) {
      const newBoard = dropPiece(board, col, 'yellow');
      if (newBoard) {
        const score = minimax(newBoard, AI_DEPTH, -Infinity, Infinity, false);
        if (score > bestScore) {
          bestScore = score;
          bestCol = col;
        }
      }
    }

    return bestCol;
  };

  // Handle player move
  const handleColumnClick = (col: number) => {
    if (winner || isAIThinking || currentPlayer === 'yellow') return;

    const newBoard = dropPiece(board, col, 'red');
    if (!newBoard) return; // Column is full

    setBoard(newBoard);
    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      return;
    }

    setCurrentPlayer('yellow');
  };

  // AI move effect
  useEffect(() => {
    if (currentPlayer === 'yellow' && !winner) {
      setIsAIThinking(true);
      
      // Add a small delay so the AI move feels more natural
      const timer = setTimeout(() => {
        const aiCol = makeAIMove(board);
        const newBoard = dropPiece(board, aiCol, 'yellow');
        
        if (newBoard) {
          setBoard(newBoard);
          const gameWinner = checkWinner(newBoard);
          if (gameWinner) {
            setWinner(gameWinner);
          } else {
            setCurrentPlayer('red');
          }
        }
        setIsAIThinking(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentPlayer, winner, board]);

  // Reset game
  const resetGame = () => {
    setBoard(EMPTY_BOARD);
    setCurrentPlayer('red');
    setWinner(null);
    setIsAIThinking(false);
  };

  return (
    <div className="connect4-container">
      <h1>Connect 4</h1>
      
      <div className="game-info">
        {winner ? (
          <div className="winner-message">
            {winner === 'draw' ? (
              <p>It's a draw!</p>
            ) : (
              <p>{winner === 'red' ? 'You win!' : 'Computer wins!'}</p>
            )}
            <button onClick={resetGame} className="reset-button">Play Again</button>
          </div>
        ) : (
          <div className="current-player">
            <p>
              {currentPlayer === 'red' ? 'Your turn' : 'Computer thinking...'}
              {isAIThinking && <span className="thinking-dots">...</span>}
            </p>
          </div>
        )}
      </div>

      <div className="board">
        {board.map((row, rowIndex) => (
          <div key={rowIndex} className="row">
            {row.map((cell, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`cell ${cell || ''} ${!winner && currentPlayer === 'red' && !isAIThinking ? 'clickable' : ''}`}
                onClick={() => handleColumnClick(colIndex)}
              >
                <div className="piece"></div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="game-controls">
        <button onClick={resetGame} className="reset-button">New Game</button>
      </div>

      <div className="game-instructions">
        <h3>How to Play:</h3>
        <ul>
          <li>You are <strong style={{color: '#e74c3c'}}>RED</strong></li>
          <li>Computer is <strong style={{color: '#f39c12'}}>YELLOW</strong></li>
          <li>Click a column to drop your piece</li>
          <li>Get 4 in a row (horizontal, vertical, or diagonal) to win!</li>
        </ul>
      </div>
    </div>
  );
}

