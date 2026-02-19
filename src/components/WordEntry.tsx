import React from 'react';
import './WordEntry.css';

interface WordEntryProps {
  word: string;
  index: number;
  isHidden: boolean;
  isIndividuallyVisible: boolean;
  onPlayAudio: (word: string) => Promise<void>;
  onOpenEtymology: (word: string) => void;
  onShowDefinition: (word: string) => Promise<void>;
  onDismissDefinition: (word: string) => void;
  onTogglePeek: (word: string) => void;
  showDefinition: boolean;
  audioError?: string;
  definition?: string;
  definitionError?: string;
}

const WordEntry: React.FC<WordEntryProps> = ({
  word,
  index,
  isHidden,
  isIndividuallyVisible,
  onPlayAudio,
  onOpenEtymology,
  onShowDefinition,
  onDismissDefinition,
  onTogglePeek,
  showDefinition,
  audioError,
  definition,
  definitionError
}) => {
  const handleAudioClick = async () => {
    await onPlayAudio(word);
  };

  const handleEtymologyClick = () => {
    onOpenEtymology(word);
  };

  const handleDefinitionClick = async () => {
    if (!showDefinition) {
      await onShowDefinition(word);
    } else {
      onDismissDefinition(word);
    }
  };

  const handleDismissDefinition = () => {
    onDismissDefinition(word);
  };

  const handlePeekClick = () => {
    onTogglePeek(word);
  };

  // Word is visible if: not hidden globally OR individually visible
  const isWordVisible = !isHidden || isIndividuallyVisible;

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        //marginBottom: '16px',
        //gap: '12px',
        //padding: '8px 0',
        alignItems: 'center', 
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
          className={!isWordVisible ? 'word-hidden' : ''}
          style={{ 
            fontSize: '18px',
            minWidth: '180px',
            paddingLeft: '10px',
            userSelect: 'text',
            cursor: !isWordVisible ? 'text' : 'default',
            fontWeight: '500',
            color: !isWordVisible ? 'white' : '#333'
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

        {/* Definition icon button */}
        <button
          onClick={handleDefinitionClick}
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
          title={showDefinition ? "Hide definition" : "Show definition"}
          aria-label={`${showDefinition ? "Hide" : "Show"} definition for ${word}`}
        >
          📝
        </button>

        {/* Peek icon button */}
        <button
          onClick={handlePeekClick}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '22px',
            padding: '6px 10px',
            transition: 'transform 0.1s',
            borderRadius: '4px',
            opacity: isIndividuallyVisible ? 1 : 0.5,
            filter: isIndividuallyVisible ? 'none' : 'grayscale(50%)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.2)';
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title={isIndividuallyVisible ? "Hide this word" : "Peek at this word"}
          aria-label={`${isIndividuallyVisible ? "Hide" : "Peek at"} ${word}`}
        >
          👁️
        </button>
      </div>

      {/* Definition display */}
      {showDefinition && (
        <div style={{
          marginLeft: '45px',
          marginTop: '8px',
          marginBottom: '12px',
          padding: '12px',
          backgroundColor: '#f9f9f9',
          borderLeft: '3px solid #4a90e2',
          borderRadius: '4px',
          fontSize: '15px',
          lineHeight: '1.5',
          color: '#333',
          position: 'relative'
        }}>
          {definitionError ? (
            <div style={{ color: '#d32f2f', fontStyle: 'italic' }}>
              {definitionError}
            </div>
          ) : definition ? (
            <>
              <div>{definition}</div>
              <button
                onClick={handleDismissDefinition}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#666',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Dismiss definition"
                aria-label="Dismiss definition"
              >
                ✕
              </button>
            </>
          ) : (
            <div style={{ fontStyle: 'italic', color: '#666' }}>
              Loading definition...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WordEntry;
