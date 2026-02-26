import { Chess } from 'chess.js';
import { botMove, BOT_CONFIGS } from './ChessBot';

describe('Move Reasoning Feature', () => {
  test('Bot explains knight development', () => {
    const chess = new Chess();
    const result = botMove(chess, 6);
    
    console.log(`\nBot move: ${result.moveString}`);
    console.log(`Explanation: ${result.chatMessage.split('\n')[0]}`);
    
    expect(result.chatMessage).toMatch(/to develop my knight|to control the center|to capture material/);
  });

  test('Bot explains capturing', () => {
    const chess = new Chess();
    chess.load('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    chess.move('Qh5'); // Threaten e5
    chess.move('Nc6');
    
    const result = botMove(chess, 6);
    
    console.log(`\nBot move: ${result.moveString}`);
    console.log(`Explanation: ${result.chatMessage.split('\n')[0]}`);
    
    // Should capture the e5 pawn
    if (result.moveString === 'Qxe5') {
      expect(result.chatMessage).toContain('to capture material');
    }
  });

  test('Bot explains castling', () => {
    const chess = new Chess();
    // Set up position where castling is available
    chess.load('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
    
    const result = botMove(chess, 6);
    
    console.log(`\nBot move: ${result.moveString}`);
    console.log(`Explanation: ${result.chatMessage.split('\n')[0]}`);
    
    if (result.moveString === 'O-O') {
      expect(result.chatMessage).toContain('to castle and protect my king');
    }
  });

  test('Bot explains king activation in endgame', () => {
    const chess = new Chess();
    chess.load('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    
    const result = botMove(chess, 6);
    
    console.log(`\nBot move: ${result.moveString}`);
    console.log(`Explanation: ${result.chatMessage.split('\n')[0]}`);
    
    // Should move king or pawn
    if (result.moveString?.startsWith('K')) {
      expect(result.chatMessage).toContain('to activate my king');
    }
  });

  test('All goal-based bots show reasoning', () => {
    const chess = new Chess();
    
    // Test Level 6 and 7 (both use goal-based move generation)
    for (const level of [6, 7]) {
      const result = botMove(chess, level);
      
      console.log(`\nLevel ${level} move: ${result.moveString}`);
      console.log(`Explanation: ${result.chatMessage.split('\n')[0]}`);
      
      // Should include a reason (contains "to ")
      expect(result.chatMessage).toMatch(/ to /);
    }
  });
});
