import React, { useState, useRef, useEffect } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { botMove } from './ChessBot';

const game = new Chess(); // shared game instance

export default function ChessGame() {
  const [fen, setFen] = useState(game.fen());
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const updateMoveHistory = () => {
    setMoveHistory(game.history());
  };

  const checkGameEnd = () => {
    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        setChatMessages(prev => [...prev, 'Checkmate! Good game.']);
      } else if (game.isStalemate()) {
        setChatMessages(prev => [...prev, 'It ends in stalemate. Good game.']);
      } else if (game.isDraw()) {
        setChatMessages(prev => [...prev, 'The game is a draw. Good game.']);
      }
    }
  };

  const makeBotMove = () => {
    const possibleMoves = game.moves();
    if (game.isGameOver() || possibleMoves.length === 0) return;

    const { moveString, chatMessage } = botMove(game);
    if (moveString) {
      game.move(moveString);
      setFen(game.fen());
      updateMoveHistory();
      setChatMessages(prev => [...prev, chatMessage]);
      checkGameEnd();
    }
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
        updateMoveHistory();
        
        // Check for game end after player move
        checkGameEnd();
        
        // After player's move, make bot move if game is not over
        if (!game.isGameOver() && game.turn() === 'b') {
          // Small delay to make bot move feel more natural
          setTimeout(() => {
            makeBotMove();
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
        updateMoveHistory();
        
        // Check for game end after player move
        checkGameEnd();
        
        // After player's move, make bot move if game is not over
        if (!game.isGameOver() && game.turn() === 'b') {
          // Small delay to make bot move feel more natural
          setTimeout(() => {
            makeBotMove();
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

  // Group moves into pairs (white, black)
  const movePairs: Array<{ white: string | null; black: string | null; moveNumber: number }> = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moveHistory[i] || null,
      black: moveHistory[i + 1] || null
    });
  }

  return (
    <div style={{ paddingLeft: '20px', display: 'flex', gap: '20px' }}>
      <div>
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
      <div style={{
        minWidth: '200px',
        backgroundColor: '#f5f5f5',
        padding: '15px',
        borderRadius: '8px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Moves</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: '8px', width: '40px' }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>White</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Black</th>
            </tr>
          </thead>
          <tbody>
            {movePairs.map((pair) => (
              <tr key={pair.moveNumber} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px', color: '#666' }}>{pair.moveNumber}.</td>
                <td style={{ padding: '8px' }}>{pair.white || '-'}</td>
                <td style={{ padding: '8px' }}>{pair.black || '-'}</td>
              </tr>
            ))}
            {movePairs.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: '8px', color: '#999', textAlign: 'center' }}>
                  No moves yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{
        minWidth: '250px',
        backgroundColor: '#f5f5f5',
        padding: '15px',
        borderRadius: '8px',
        maxHeight: '600px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Bot Chat</h3>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          backgroundColor: 'white',
          padding: '10px',
          borderRadius: '4px',
          minHeight: '400px',
          border: '1px solid #ddd'
        }}>
          {chatMessages.length === 0 ? (
            <div style={{ color: '#999', fontStyle: 'italic' }}>
              Waiting for bot to make a move...
            </div>
          ) : (
            chatMessages.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '12px',
                  padding: '8px',
                  backgroundColor: '#e8f4f8',
                  borderRadius: '4px',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}
              >
                {message}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </div>
    </div>
  );
}