import React from 'react';
import './WordEntry.css';

interface WordEntryProps {
  word: string;
  index: number;
  isHidden: boolean;
  onPlayAudio: (word: string) => Promise<void>;
  onOpenEtymology: (word: string) => void;
  audioError?: string;
}

const WordEntry: React.FC<WordEntryProps> = ({
  word,
  index,
  isHidden,
  onPlayAudio,
  onOpenEtymology,
  audioError
}) => {
  const handleAudioClick = async () => {
    await onPlayAudio(word);
  };

  const handleEtymologyClick = () => {
    onOpenEtymology(word);
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '16px',
      gap: '12px',
      padding: '8px 0'
    }}>
      {/* Word number */}
      <span style={{ 
        fontWeight: 'bold', 
        minWidth: '35px',
        color: '#555',
        fontSize: '16px'
      }}>
        {index + 1}.
      </span>

      {/* Word text with hidden state */}
      <span 
        className={isHidden ? 'word-hidden' : ''}
        style={{ 
          fontSize: '18px',
          minWidth: '180px',
          userSelect: 'text',
          cursor: isHidden ? 'text' : 'default',
          fontWeight: '500',
          color: isHidden ? 'white' : '#333'
        }}
      >
        {word}
      </span>

      {/* Audio icon button */}
      <button
        onClick={handleAudioClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '22px',
          padding: '6px 10px',
          transition: 'transform 0.1s',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title={audioError ? `Error: ${audioError}` : "Play pronunciation"}
        aria-label={`Play pronunciation for ${word}`}
      >
        {audioError ? '❌' : '🔊'}
      </button>

      {/* Etymology icon button */}
      <button
        onClick={handleEtymologyClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '22px',
          padding: '6px 10px',
          transition: 'transform 0.1s',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        title="View etymology"
        aria-label={`View etymology for ${word}`}
      >
        📖
      </button>
    </div>
  );
};

export default WordEntry;
