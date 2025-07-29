import React, { useState, FormEvent, useEffect } from 'react';
import { TournamentResults } from '../types/TournamentResults.ts';

// Constants
const DEFAULT_RATINGS_REPORT = `pos last name first       id numb   start end/#gms  rd1 rd2 rd3 tot 
  1 Player, A             ABCE251G  507   565/ 69   W4  W3  W2  3.0
  2 Player, B             ABCDK04A  100   274/ 30   W3  W4  L1  2.0
  3 Player, C             ABCBJ97F  424   367/ 33   L2  L1  W4  1.0
  4 Player, D             ABCEK03Z  227   164/ 24   L1  L2  L3  0.0`;

interface FormElements extends HTMLFormControlsCollection {
  ratingsReport: HTMLTextAreaElement;
}

interface RatingsFormElement extends HTMLFormElement {
  readonly elements: FormElements;
}

export default function Results(): JSX.Element {
  const params = new URLSearchParams(window.location.search);
  const savedReport = params.get('savedReport');
  const initialReport = params.get('ratingsReport') || DEFAULT_RATINGS_REPORT;
  const [ratingsReport, setRatingsReport] = useState(initialReport);
  const [results, setResults] = useState<TournamentResults>(new TournamentResults(initialReport));
  const [reports, setReports] = useState<string[]>([]);

  // Load saved report if specified in URL
  useEffect(() => {
    if (savedReport) {
      // Always encode the filename for the fetch URL
      const encodedForFetch = encodeURIComponent(decodeURIComponent(savedReport));
      fetch(`/tournament_reports/${encodedForFetch}`)
        .then(response => response.text())
        .then(htmlContent => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const preContent = doc.querySelector('pre')?.textContent || htmlContent;
          
          setRatingsReport(preContent);
          setResults(new TournamentResults(preContent));
        })
        .catch(error => {
          console.error('Error loading saved report:', error);
        });
    }
  }, [savedReport]);

  useEffect(() => {
    // Fetch list of tournament reports from public folder
    fetch('/tournament_reports/index.json')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Loaded tournament reports:', data);
        setReports(data);
      })
      .catch(error => {
        console.error('Error loading tournament reports:', error);
      });
  }, []);

  const handleReportSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const reportName = event.target.value;
    if (reportName) {
      // Encode the filename for the URL
      const encodedFilename = encodeURIComponent(reportName);
      const newParams = new URLSearchParams();
      newParams.set('savedReport', encodedFilename);
      window.history.pushState({}, '', `?${newParams.toString()}`);
      
      // Use decoded filename for fetch
      fetch(`/tournament_reports/${reportName}`)
        .then(response => response.text())
        .then(htmlContent => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          const preContent = doc.querySelector('pre')?.textContent || htmlContent;
          
          setRatingsReport(preContent);
          setResults(new TournamentResults(preContent));
        })
        .catch(error => {
          console.error('Error loading tournament report:', error);
        });
    }
  };

  const handleSubmit = (e: FormEvent<RatingsFormElement>): void => {
    e.preventDefault();
    const report = e.currentTarget.elements.ratingsReport.value;
    setRatingsReport(report);
    setResults(new TournamentResults(report));
  };

  const generatePermalink = () => {
    const textArea = document.querySelector('textarea[name="ratingsReport"]') as HTMLTextAreaElement;
    if (!textArea) return;
    
    const newParams = new URLSearchParams();
    newParams.set('ratingsReport', textArea.value);
    
    // Update URL without reloading the page
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  const handleArrowNavigation = (direction: 'prev' | 'next') => {
    if (reports.length === 0) return;

    let currentIndex = -1;
    if (savedReport) {
      currentIndex = reports.findIndex(r => r === savedReport);
    }

    let newIndex;
    if (currentIndex === -1) {
      // No current report - go to first or last based on direction
      newIndex = direction === 'next' ? 0 : reports.length - 1;
    } else {
      // Calculate new index with wraparound
      newIndex = direction === 'next' 
        ? (currentIndex + 1) % reports.length
        : (currentIndex - 1 + reports.length) % reports.length;
    }

    const newReport = reports[newIndex];
    // Use the same navigation logic as the dropdown
    const newParams = new URLSearchParams();
    newParams.set('savedReport', newReport);
    window.history.pushState({}, '', `?${newParams.toString()}`);
    
    fetch(`/tournament_reports/${newReport}`)
      .then(response => response.text())
      .then(htmlContent => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const preContent = doc.querySelector('pre')?.textContent || htmlContent;
        
        setRatingsReport(preContent);
        setResults(new TournamentResults(preContent));
      })
      .catch(error => {
        console.error('Error loading tournament report:', error);
      });
  };

  return (
    <div className="App" style={{ textAlign: 'left', margin: '20px' }}>
      <h2>🏆 Tournament Results Checker</h2>
      <h4>Input values below to check your tournament results</h4>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '10px 0' }}>
        <button 
          onClick={() => handleArrowNavigation('prev')}
          style={{ fontSize: '20px' }}
          title="Previous tournament"
        >
          ←
        </button>

        <select 
          onChange={handleReportSelect} 
          value={savedReport || ''}
          style={{ margin: '0' }}
        >
          <option value="">Select a tournament report...</option>
          {reports.map(report => (
            <option key={report} value={report}>{report}</option>
          ))}
        </select>

        <button 
          onClick={() => handleArrowNavigation('next')}
          style={{ fontSize: '20px' }}
          title="Next tournament"
        >
          →
        </button>
      </div>

      {results.hasErrors() && (
        <div style={{ 
          color: 'red',
          backgroundColor: '#ffebee',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px'
        }}>
          <h4>Please fix the following issues:</h4>
          <ul>
            {results.getErrors().map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {results.hasWarnings() && (
        <div style={{ 
          color: '#856404',
          backgroundColor: '#fff3cd',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px'
        }}>
          <h4>Warnings:</h4>
          <ul>
            {results.getWarnings().map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <form style={{ marginBottom: '20px' }} onSubmit={handleSubmit}>
        <p>Enter ratings report: <small>(As formatted at <a href="https://ratingsnw.com">ratingsnw.com</a>)</small></p>
        <textarea 
          name="ratingsReport"
          value={ratingsReport}
          onChange={(e) => setRatingsReport(e.target.value)}
          style={{ 
            width: '900px', 
            height: '300px',
            resize: 'both',
            margin: '10px'
          }}
        />
        <div style={{ margin: '10px' }}>
          <button type="submit" style={{ marginRight: '10px' }}>Check My Results</button>
          <button type="button" onClick={generatePermalink}>Generate Permalink</button>
        </div>
      </form>

      <h3>Results with Commentary</h3>
      <table style={{ 
        borderCollapse: 'collapse', 
        width: '100%',
        marginTop: '20px'
      }}>
        <thead>
          <tr style={{ 
            backgroundColor: '#f5f5f5',
            borderBottom: '2px solid #ddd'
          }}>
            <th style={tableHeaderStyle}>Player</th>
            <th style={tableHeaderStyle}>Start Rating</th>
            <th style={tableHeaderStyle}>End Rating</th>
            <th style={tableHeaderStyle}>Change</th>
            <th style={tableHeaderStyle}>Score</th>
            <th style={tableHeaderStyle}>Rated Score</th>
            <th style={tableHeaderStyle}>Opponents</th>
            <th style={tableHeaderStyle}>Predicted Rating</th>
            <th style={tableHeaderStyle}>Difference</th>
          </tr>
        </thead>
        <tbody>
          {results.getCommentary().map((row, index) => (
            <tr key={index} style={{
              borderBottom: '1px solid #ddd',
              backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9f9f9'
            }}>
              <td style={tableCellStyle}>{row.playerName}</td>
              <td style={tableCellStyle}>{row.startRating}</td>
              <td style={tableCellStyle}>{row.endRating}</td>
              <td style={tableCellStyle}>
                <span style={{ 
                  color: row.ratingChange > 0 ? 'green' : 
                         row.ratingChange < 0 ? 'red' : 'black' 
                }}>
                  {row.ratingChange > 0 ? '+' : ''}{row.ratingChange}
                </span>
              </td>
              <td style={tableCellStyle}>{row.totalScore}</td>
              <td style={tableCellStyle}>{row.ratedScore}/{row.ratedRounds}</td>
              <td style={tableCellStyle}>
                {row.opponents.map((rating, i) => 
                    rating === null ? row.rounds[i] : rating
                ).join(', ')}
              </td>
              <td style={tableCellStyle}>
                <a href={`/ratings?rating=${row.startRating}&oppRatings=${row.realOpponents.join('+')}&points=${row.ratedScore}`}>
                    {Math.round(row.predictedRating)}
                </a>
              </td>
              <td style={tableCellStyle}>
                <span style={{ 
                  color: row.endRating > row.predictedRating ? 'green' : 
                         row.endRating < row.predictedRating ? 'red' : 'black' 
                }}>
                  {row.endRating - Math.round(row.predictedRating)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const tableHeaderStyle = {
  padding: '12px 8px',
  textAlign: 'left' as const,
  fontWeight: 'bold'
};

const tableCellStyle = {
  padding: '8px'
}; 
