import React, { useState } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';

const game = new Chess(); // shared game instance

export default function ChessGame() {
  const [fen, setFen] = useState(game.fen());
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);

  const makeRandomBotMove = () => {
    const possibleMoves = game.moves();
    if (game.isGameOver() || possibleMoves.length === 0) return;

    const randomIdx = Math.floor(Math.random() * possibleMoves.length);
    game.move(possibleMoves[randomIdx]);
    setFen(game.fen());
  };

  const handlePromotion = (promotionPiece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;

    try {
      const move = game.move({
        from: pendingPromotion.from,
        to: pendingPromotion.to,
        promotion: promotionPiece
      });

      if (move) {
        setFen(game.fen());
        setPendingPromotion(null);
        
        // After player's move, make bot move if game is not over
        if (!game.isGameOver() && game.turn() === 'b') {
          // Small delay to make bot move feel more natural
          setTimeout(() => {
            makeRandomBotMove();
          }, 300);
        }
      }
    } catch (error) {
      setPendingPromotion(null);
    }
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

    // Check if this is a pawn promotion (white pawn moving to 8th rank)
    const isPromotion = piece?.type === 'p' && targetSquare[1] === '8';

    if (isPromotion) {
      // Store the pending promotion move
      setPendingPromotion({ from: sourceSquare, to: targetSquare });
      return 'snapback'; // Temporarily revert, will complete after selection
    }

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // default, but won't be used for non-promotion moves
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
      {pendingPromotion && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#333',
          padding: '20px',
          borderRadius: '8px',
          zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <div style={{ color: 'white', marginBottom: '15px', fontSize: '18px', fontWeight: 'bold' }}>
            Choose promotion piece:
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => handlePromotion('q')}
              style={{
                padding: '10px 15px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Queen
            </button>
            <button
              onClick={() => handlePromotion('r')}
              style={{
                padding: '10px 15px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Rook
            </button>
            <button
              onClick={() => handlePromotion('b')}
              style={{
                padding: '10px 15px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Bishop
            </button>
            <button
              onClick={() => handlePromotion('n')}
              style={{
                padding: '10px 15px',
                fontSize: '16px',
                cursor: 'pointer',
                backgroundColor: '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Knight
            </button>
          </div>
        </div>
      )}
    </div>
  );
}