import React, { useState } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';

const game = new Chess(); // shared game instance

export default function ChessGame() {
  const [fen, setFen] = useState(game.fen());

  const handleMove = ({
    sourceSquare,
    targetSquare
  }: {
    sourceSquare: string;
    targetSquare: string;
  }) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // auto-promote to queen for simplicity
      });

      if (move) {
        setFen(game.fen());
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