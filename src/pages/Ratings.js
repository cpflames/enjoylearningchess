//import { useState } from 'react';

function fmt(number) {
  return number > 0 ? `+${number.toFixed(0)}` : `${number.toFixed(0)}`;
}

const colorCell = (value) => {
  let bgColor = value > 0 ? 'rgba(0, 180, 0, 0.25)' : value < 0 ? 'rgba(220, 0, 0, 0.25)' : 'transparent';
  return <td style={{ backgroundColor: bgColor, textAlign: 'right' }}>{fmt(value)}</td>;
};

const mobileStyles = {
  input: {
    fontSize: '16px',          // Prevent auto-zoom on iOS
    padding: '8px',
    margin: '10px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
  },
  wideInput: {
    width: '250px',
  },
  narrowInput: {
    width: '80px',            // Slightly wider than desktop
  },
  button: {
    fontSize: '16px',
    padding: '12px 24px',     // Larger touch target
    margin: '10px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  label: {
    display: 'block',         // Stack labels above inputs on mobile
    marginBottom: '5px',
  }
};

export default function Ratings() {
  const params = new URLSearchParams(window.location.search);
  const myRating = Number(params.get('rating')) || 500;
  const oppRatings = params.get('oppRatings') || '400 500 600 700 800';
  const actualPoints = params.get('points') === null ? 2.5 : Number(params.get('points'));
  //const [rating, setRating] = useState(initialRating);
  //const [inputValue, setInputValue] = useState('');
  //const [changeValue, setChangeValue] = useState('');
  
  const opponentRatings = oppRatings.split(' ').map(Number);

  const kn = 50 / Math.sqrt(0.84 + 0.0000040445 * Math.pow(2755.99 - myRating, 2));
  const gamesPlayed = opponentRatings.length;
  const k = 800 / (kn + gamesPlayed);
  const expectedPoints = opponentRatings.reduce((sum, oppRating) => {
    const winRate = 1.0/(1.0 + Math.pow(10.0, (oppRating - myRating)/400.0));
    return sum + winRate;
  }, 0.0);

  const ratingChangeTable = [
    [ 500,  5, 0.95*k,  0.45*k, -0.05*k],
    [ 400,  9, 0.91*k,  0.41*k, -0.09*k],
    [ 300, 15, 0.85*k,  0.35*k, -0.15*k],
    [ 200, 24, 0.76*k,  0.26*k, -0.24*k],
    [ 100, 36, 0.64*k,  0.14*k, -0.36*k],
    [   0, 50, 0.50*k,  0.00*k, -0.50*k],
    [-100, 64, 0.36*k, -0.14*k, -0.64*k],
    [-200, 76, 0.24*k, -0.26*k, -0.76*k],
    [-300, 85, 0.15*k, -0.35*k, -0.85*k],
    [-400, 91, 0.09*k, -0.41*k, -0.91*k],
    [-500, 95, 0.05*k, -0.45*k, -0.95*k]
  ];

  const deltaPoints = k * (actualPoints - expectedPoints);
  const effectiveGamesPlayed = Math.max(gamesPlayed, 4);
  const bonusCap = 9.7 * Math.sqrt(effectiveGamesPlayed);
  const bonusPoints = Math.max(0, deltaPoints - bonusCap);
  const newRating = myRating + deltaPoints + bonusPoints;

  // const handleSubmit = (e) => {
  //   e.preventDefault();
  //   setRating(Number(inputValue));
  // };
  
  // const handleChange = () => {
  //   if (changeValue) {
  //     setRating(prevRating => prevRating + Number(changeValue));
  //   }
  // };
  
  return (
    <div className="App" style={{ textAlign: 'left', margin: '20px' }}>
    <h2>📈 Ratings Calculator</h2>
    <h4> Input values below to predict your new rating</h4>
        <form style={{ marginBottom: '20px' }}>
          <div>
            <input 
              type="number"
              name="rating"
              defaultValue={myRating}
              style={{ ...mobileStyles.input, ...mobileStyles.narrowInput }}
            />
            <small style={mobileStyles.label}>Your starting rating</small>
          </div>

          <div>
            <input 
              type="string" 
              name="oppRatings"
              defaultValue={oppRatings}
              style={{ ...mobileStyles.input, ...mobileStyles.wideInput }}
            />
            <small style={mobileStyles.label}>Opponent ratings, separated by spaces</small>
          </div>

          <div>
            <input 
              type="number" 
              name="points"
              defaultValue={actualPoints}
              step="0.5"
              style={{ ...mobileStyles.input, ...mobileStyles.narrowInput }}
            />
            <small style={mobileStyles.label}>Points scored in the tournament</small>
          </div>

          <button 
            type="submit" 
            style={mobileStyles.button}
          >
            Predict My New Rating
          </button>
        </form>

      <h3>Old Rating: {myRating}</h3>
      <h3>Predicted New Rating: {newRating.toFixed(0)}</h3>

      <h4>Explanation in words</h4>
      <p>Elo says:</p>
      <blockquote style={{
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '10px solid var(--border)',
        margin: '1.5em 10px',
        padding: '0.5em 10px'
      }}>
        For your rating ({myRating}), and opponents you faced({opponentRatings.join(', ')}), 
        <br/>your projected score was <b>{expectedPoints.toFixed(1)} points</b> for this tournament.
        <br/>But your actual score was <b>{actualPoints.toFixed(1)} points</b>, for a delta of <b>{(actualPoints - expectedPoints).toFixed(1)}</b>.
        <br/>Based on your rating ({myRating}), my uncertainty (K) about your true rating is <b>K={k.toFixed(1)}</b>.
        <br/>So your delta points are <b>{deltaPoints.toFixed(1)}</b> = K ({k.toFixed(1)}) * delta ({(actualPoints - expectedPoints).toFixed(1)}).
        <br/>Plus <b>{bonusPoints.toFixed(1)}</b> bonus points, for delta points scored in excess of {bonusCap.toFixed(1)}.
        <br/>So your predicted new rating is <b>{newRating.toFixed(0)}</b> = old rating ({myRating}) + delta points ({deltaPoints.toFixed(1)}) + bonus points ({bonusPoints.toFixed(1)}).
      </blockquote>

      <h4>Explanation in math</h4>
      <p>
        <b>Games played: {gamesPlayed}</b> vs {opponentRatings.join(', ')}
        <br/><small>BonusCap={bonusCap.toFixed(1)}=9.7*sqrt(max(4,gamesPlayed))</small>
        <br/>
        <b>Uncertainty: K={k.toFixed(1)}</b>
        <br/><small>The K-factor in an Elo rating system controls how fast ratings move.</small>
        <br/><small>NWSRS computes K from your rating, and games played in that tournament.</small>
        <br/><small>K=800/(50/sqrt(0.84+0.0000040445*(2755.99-initialRating)^2)+gamesPlayed)</small>
        <br/>
        <b>Projected points: {expectedPoints.toFixed(1)}, Actual points: {actualPoints.toFixed(1)}</b>
        <br/><small>Projected points per opponent = 1/(1+10^((oppRating-myRating)/400))</small>
        <br/><small>Projected points for the tournament = sum(Projected points per opponent)</small>
        <br/>
        <b>Delta points: {deltaPoints.toFixed(1)}</b>
        <br/><small>Delta points = K * (Actual points - Projected points)</small>
        <br/><small>Delta points can also be added up from each game result, per table below</small>
        <br/>
        <b>Bonus points: {bonusPoints.toFixed(1)}</b>
        <br/><small>Delta points gained in excess of ~20 are given again as bonus points</small>
        <br/><small>Well, technically, above BonusCap={bonusCap.toFixed(1)} for a {gamesPlayed}-round tournament</small>
        <br/><small>Bonus points help young players gain rating rapidly when they improve rapidly</small>
        <br/>
        <b>Predicted New Rating: {newRating.toFixed(0)}</b>
        <br/><small>New rating ({newRating.toFixed(0)}) = Starting rating ({myRating}) + Delta points ({deltaPoints.toFixed(1)}) + Bonus points ({bonusPoints.toFixed(1)})</small>
      </p>

      <h3>Further Explanation</h3>

      <h4>Rating Change Table for Rating={myRating} (K={k.toFixed(1)})</h4>
      <table border="1" style={{ margin: '10px' }}>
      <thead>
          <tr>
            <th>RatingΔ</th>
            <th>WinRate</th>
            <th style={{ width: '50px', textAlign: 'center' }}>Win</th>
            <th style={{ width: '50px', textAlign: 'center' }}>Draw</th>
            <th style={{ width: '50px', textAlign: 'center' }}>Loss</th>
          </tr>
        </thead>
        <tbody>
          {ratingChangeTable.map((row, index) => (
            <tr key={index}>
            <td style={{ textAlign: 'right' }}>{fmt(row[0])}</td>
            <td style={{ textAlign: 'right' }}>{row[1]}%</td>
            {colorCell(row[2])}
            {colorCell(row[3])}
            {colorCell(row[4])}
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Understanding the rating change per game</h4>
      <p>
        <b>RatingΔ</b> is your opponent's rating minus your rating.
        <br/> 
        <b>Win Rate</b> is the percentage of games you are expected to win, based on the RatingΔ.
        <br/>
        <b>Win</b>, <b>Draw</b>, and <b>Loss</b> are the points you receive for the match, based on the result.
        <br/>
        For example, the third row shows that if you're playing someone rated 300 points higher than you,
        you can expect to win about 15% of the time.  If you win, you get +42 points; if you lose, you get -8 points.
        <br/>
        If you are instead playing someone rated 300 points lower than you, you can expect to win 85% of the time.
        If you win, you get +8 points; if you lose, you get -42 points.
      </p>

      <h4>Understanding the rating change for the tournament</h4>
      <p>
        <b>K</b> is the uncertainty of your true rating. It ranges from 65 for a new player, to 40 for a seasoned player.
        <br/>
        <b>Expected points</b> are the points you are expected to score, based on the RatingΔ. Adding up the WinRate for all your games gives you the Expected points.
        <br/>
        <b>Actual points</b> are the points you actually scored in the tournament.
        <br/>
        <b>Delta points</b> are the rating points for each of the game results, and equals K * (Actual points - Expected points).
        <br/>
        <b>Bonus points</b> are also given, if total delta points for the tournament are above 20, and are equal to delta points minus 20.
      </p>

    </div>
  );
} 