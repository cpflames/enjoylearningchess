import { TournamentResults } from './TournamentResults.ts';

const VALID_4_PLAYER_REPORT = `pos last name first       id numb   start end/#gms  rd1 rd2 rd3 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  W4  W3  W2  3.0
  2 Jones, Mary           ABCDE02G   900   950/ 20  W3  W4  L1  2.0
  3 Brown, Bob            ABCDE03H  1100  1080/ 30  L2  L1  W4  1.0
  4 Davis, Sue            ABCDE04I   800   790/ 15  L1  L2  L3  0.0`;

describe('TournamentResults', () => {
  describe('parsing a valid report', () => {
    it('parses the correct number of players', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      expect(results.hasErrors()).toBe(false);
      expect(results.getPlayers()).toHaveLength(4);
    });

    it('parses player names correctly', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      const players = results.getPlayers();
      expect(players[0].fullName).toBe('Smith, John');
      expect(players[1].fullName).toBe('Jones, Mary');
      expect(players[2].fullName).toBe('Brown, Bob');
      expect(players[3].fullName).toBe('Davis, Sue');
    });

    it('parses start and end ratings correctly', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      const player = results.getPlayers()[0];
      expect(player.startRating).toBe(1200);
      expect(player.endRating).toBe(1250);
      expect(player.ratingChange).toBe(50);
    });

    it('parses round results correctly', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      expect(results.getPlayers()[0].rounds).toEqual(['W4', 'W3', 'W2']);
      expect(results.getPlayers()[1].rounds).toEqual(['W3', 'W4', 'L1']);
      expect(results.getPlayers()[3].rounds).toEqual(['L1', 'L2', 'L3']);
    });

    it('calculates rated score excluding unrated rounds', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      expect(results.getPlayers()[0].ratedScore).toBe(3);
      expect(results.getPlayers()[1].ratedScore).toBe(2);
      expect(results.getPlayers()[3].ratedScore).toBe(0);
    });

    it('generates commentary for all players', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      const commentary = results.getCommentary();
      expect(commentary).toHaveLength(4);
      expect(commentary[0].playerName).toBe('Smith, John');
      expect(commentary[0].ratingChange).toBe(50);
      expect(commentary[3].ratingChange).toBe(-10);
    });

    it('generates a numeric predicted rating for each player', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      const commentary = results.getCommentary();
      commentary.forEach(row => {
        expect(typeof row.predictedRating).toBe('number');
        expect(row.predictedRating).toBeGreaterThan(0);
      });
    });
  });

  describe('opponent ratings', () => {
    it('resolves opponent start ratings by position reference', () => {
      const results = new TournamentResults(VALID_4_PLAYER_REPORT);
      // Smith (pos 1) played vs pos 4, 3, 2
      expect(results.getOpponentRatings(results.getPlayers()[0])).toEqual([800, 1100, 900]);
    });

    it('returns null for full-point byes', () => {
      const report = `pos last name first       id numb   start end/#gms  rd1 rd2 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  BYE W2  2.0
  2 Jones, Mary           ABCDE02G   900   950/ 20  W1  BYE 2.0`;
      const results = new TournamentResults(report);
      const opponents = results.getOpponentRatings(results.getPlayers()[0]);
      expect(opponents[0]).toBeNull();
      expect(opponents[1]).toBe(900);
    });

    it('returns null for half-point byes, zero-point byes, and forfeits', () => {
      const report = `pos last name first       id numb   start end/#gms  rd1 rd2 rd3 rd4 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  HPB ZPB WF  LF  0.0
  2 Jones, Mary           ABCDE02G   900   950/ 20  W1  W1  W1  W1  4.0`;
      const results = new TournamentResults(report);
      const opponents = results.getOpponentRatings(results.getPlayers()[0]);
      expect(opponents).toEqual([null, null, null, null]);
    });
  });

  describe('validation errors', () => {
    it('errors on an empty report', () => {
      const results = new TournamentResults('');
      expect(results.hasErrors()).toBe(true);
    });

    it('errors on a single-line report (no player rows)', () => {
      const results = new TournamentResults('pos last name first id numb start tot');
      expect(results.hasErrors()).toBe(true);
    });

    it('errors when required header fields are missing', () => {
      const results = new TournamentResults('name rating score\n  1 Smith ABCDE01F 1200 1250 1.0');
      expect(results.hasErrors()).toBe(true);
    });

    it('errors when no rounds are found in the header', () => {
      const results = new TournamentResults(
        'pos last name first id numb start tot\n  1 Smith, John ABCDE01F 1200 1250/ 45 1.0'
      );
      expect(results.hasErrors()).toBe(true);
    });

    it('returns empty commentary when there are errors', () => {
      const results = new TournamentResults('');
      expect(results.getCommentary()).toEqual([]);
    });

    it('errors when player positions are not sequential', () => {
      const report = `pos last name first       id numb   start end/#gms  rd1 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  W2  1.0
  3 Jones, Mary           ABCDE02G   900   950/ 20  L1  0.0`;
      const results = new TournamentResults(report);
      expect(results.hasErrors()).toBe(true);
    });
  });

  describe('validation warnings', () => {
    it('warns when reported score does not match calculated round results', () => {
      const report = `pos last name first       id numb   start end/#gms  rd1 rd2 tot
  1 Smith, John           ABCDE01F  1200  1250/ 45  W2  W2  9.0
  2 Jones, Mary           ABCDE02G   900   950/ 20  L1  L1  0.0`;
      const results = new TournamentResults(report);
      expect(results.hasWarnings()).toBe(true);
      expect(results.getWarnings().some(w => w.includes('9.0'))).toBe(true);
    });
  });
});
