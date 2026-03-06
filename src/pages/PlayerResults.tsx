import React, { useState, useEffect } from 'react';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3, baseDelay = 1000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      // Exponential backoff: 1s, 2s, 4s
      await delay(baseDelay * Math.pow(2, i));
    }
  }
  throw new Error('All retries failed');
}

export default function PlayerResults(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  const [playerName, setPlayerName] = useState(params.get('player') || '');
  const [reports, setReports] = useState<{ [filename: string]: string }>({});
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithRetry('/tournament_reports/index.json')
      .then(response => response.json())
      .then((files: string[]) => {
        setTotalCount(files.length);
        setIndexLoaded(true);
        // Process files sequentially to avoid overwhelming the server
        files.reduce((promise, filename) => {
          return promise.then(() =>
            fetchWithRetry(`/tournament_reports/${encodeURIComponent(filename)}`)
              .then(response => response.text())
              .then(content => {
                setReports(prev => ({ ...prev, [filename]: content }));
                setLoadedCount(prev => prev + 1);
              })
              .catch(err => {
                console.error('Error loading report:', filename, err);
                setLoadedCount(prev => prev + 1);
              })
          );
        }, Promise.resolve());
      })
      .catch(err => {
        console.error('Error loading report list:', err);
        setError(`Error loading report list: ${err.message}`);
      });
  }, []);

  const handlePlayerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPlayerName(value);
    const newParams = new URLSearchParams();
    if (value) newParams.set('player', value);
    window.history.replaceState({}, '', value ? `?${newParams}` : window.location.pathname);
  };

  // indexLoaded guards against showing "no results" before the index.json fetch
  // completes (at which point both loadedCount and totalCount are still 0)
  const isLoading = !indexLoaded || loadedCount < totalCount;

  const matchingReports = Object.entries(reports).filter(
    ([, content]) => playerName && content.includes(playerName)
  );

  return (
    <div style={{ margin: '20px' }}>
      <h1>Player Results Finder</h1>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={playerName}
          onChange={handlePlayerNameChange}
          placeholder="Enter player name..."
          style={{ padding: '8px', fontSize: '16px', width: '300px' }}
        />
      </div>

      {isLoading && (
        <div style={{ color: '#666', marginBottom: '10px' }}>
          Loading reports... {loadedCount} / {totalCount}
        </div>
      )}

      {error && (
        <div style={{
          color: 'red',
          backgroundColor: '#ffebee',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      {playerName && !isLoading && matchingReports.length === 0 && (
        <div>No reports found for &ldquo;{playerName}&rdquo;.</div>
      )}

      {matchingReports.map(([filename, content]) => (
        <div key={filename} style={{ marginBottom: '2em' }}>
          <h3>
            <a
              href={`/results?savedReport=${encodeURIComponent(filename)}`}
              style={{ color: '#2196F3', textDecoration: 'none' }}
              onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
            >
              {filename}
            </a>
          </h3>
          <pre style={{
            whiteSpace: 'pre-wrap',
            backgroundColor: '#f5f5f5',
            padding: '1em',
            borderRadius: '4px'
          }}>
            {content}
          </pre>
        </div>
      ))}
    </div>
  );
}
