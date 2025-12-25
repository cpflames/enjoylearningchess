import React, { useState } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';

const game = new Chess(); // shared game instance

export default function ChessGame() {
  const [fen, setFen] = useState(game.fen());

  const makeRandomBotMove = () => {
    const possibleMoves = game.moves();
    if (game.isGameOver() || possibleMoves.length === 0) return;

    const randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    setFen(game.fen());
  };

  const handleMove = ({
    sourceSquare,
    targetSquare
  }: {
    sourceSquare: string;
    targetSquare: string;
  }) => {
    // Only allow white pieces to move (player's turn)
    const piece = game.get(sourceSquare as any);
    if (piece && piece.color !== 'w') {
      return 'snapback';
    }

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // auto-promote to queen for simplicity
      });

      if (move) {
        setFen(game.fen());
        
        // After player's move, make bot move if game is not over
        if (!game.isGameOver() && game.turn() === 'b') {
          // Small delay to make bot move feel more natural
          setTimeout(() => {
            makeRandomBotMove();
          }, 300);
        }
      } else {
        // Invalid move - return 'snapback' to revert the piece
        return 'snapback';
      }
    } catch (error) {
      // Illegal move - return 'snapback' to revert the piece
      return 'snapback';
    }
  };

  return (
    <div style={{ paddingLeft: '20px' }}>
      <h2>Play Chess</h2>
      <Chessboard position={fen} onDrop={handleMove} />
    </div>
  );
}