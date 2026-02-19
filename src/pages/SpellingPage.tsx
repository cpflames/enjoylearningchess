import React, { useState, useEffect } from 'react';
import WordEntry from '../components/WordEntry';
import HideButton from '../components/HideButton';
import { playAudio } from '../services/ttsService';
import { getDefinition } from '../services/dictionaryService';
import styles from './SpellingPage.module.css';

export default function SpellingPage(): JSX.Element {
  const [words, setWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [audioErrors, setAudioErrors] = useState<Map<string, string>>(new Map());
  const [wordsHidden, setWordsHidden] = useState<boolean>(false);
  const [individuallyVisibleWords, setIndividuallyVisibleWords] = useState<Set<string>>(new Set());
  const [definitionCache, setDefinitionCache] = useState<Map<string, string>>(new Map());
  const [definitionErrors, setDefinitionErrors] = useState<Map<string, string>>(new Map());
  const [activeDefinitions, setActiveDefinitions] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/wordList.txt');
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Unable to load word list. Please ensure wordList.txt exists.');
        } else {
          throw new Error(`Failed to load word list (Status: ${response.status})`);
        }
      }

      const text = await response.text();
      
      // Parse words: split by newlines, trim whitespace, filter empty lines
      const parsedWords = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (parsedWords.length === 0) {
        setError('Word list is empty. Please add words to wordList.txt.');
      } else {
        setWords(parsedWords);
      }
    } catch (err) {
      if (err instanceof Error) {
        // Handle network errors
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred loading the word list');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async (word: string): Promise<void> => {
    try {
      // Clear any previous error for this word
      setAudioErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.delete(word);
        return newErrors;
      });

      await playAudio(word);
    } catch (err) {
      // Set error indicator for this word
      const errorMessage = err instanceof Error ? err.message : 'Audio playback failed';
      setAudioErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.set(word, errorMessage);
        return newErrors;
      });
      console.error(`Audio error for "${word}":`, err);
    }
  };

  const handleOpenEtymology = (word: string): void => {
    const url = `/etymize?word=${encodeURIComponent(word)}`;
    window.open(url, '_blank');
  };

  const handleShowDefinition = async (word: string): Promise<void> => {
    try {
      // Clear any previous error for this word
      setDefinitionErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.delete(word);
        return newErrors;
      });

      const definition = await getDefinition(word);
      
      // Cache the definition
      setDefinitionCache(prev => {
        const newCache = new Map(prev);
        newCache.set(word, definition);
        return newCache;
      });

      // Add to active definitions
      setActiveDefinitions(prev => {
        const newActive = new Set(prev);
        newActive.add(word);
        return newActive;
      });
    } catch (err) {
      // Set error indicator for this word
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch definition';
      setDefinitionErrors(prev => {
        const newErrors = new Map(prev);
        newErrors.set(word, errorMessage);
        return newErrors;
      });
      console.error(`Definition error for "${word}":`, err);
    }
  };

  const handleDismissDefinition = (word: string): void => {
    setActiveDefinitions(prev => {
      const newActive = new Set(prev);
      newActive.delete(word);
      return newActive;
    });
  };

  const handleTogglePeek = (word: string): void => {
    setIndividuallyVisibleWords(prev => {
      const newVisible = new Set(prev);
      if (newVisible.has(word)) {
        newVisible.delete(word);
      } else {
        newVisible.add(word);
      }
      return newVisible;
    });
  };

  const handleToggleHide = (): void => {
    setWordsHidden(prev => !prev);
    // Clear individual visibility states when toggling global hide
    setIndividuallyVisibleWords(new Set());
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>📝 Spelling Bee Study Tool</h1>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          Loading word list...
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <strong>Error:</strong> {error}
          {!error.includes('empty') && (
            <button 
              onClick={loadWords}
              style={{
                marginLeft: '15px',
                padding: '6px 12px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#b71c1c';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#d32f2f';
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && words.length > 0 && (
        <div>
          <p className={styles.wordCount}>Loaded {words.length} words</p>
          <div className={styles.wordList}>
            {words.map((word, index) => (
              <WordEntry
                key={`${word}-${index}`}
                word={word}
                index={index}
                isHidden={wordsHidden}
                isIndividuallyVisible={individuallyVisibleWords.has(word)}
                onPlayAudio={handlePlayAudio}
                onOpenEtymology={handleOpenEtymology}
                onShowDefinition={handleShowDefinition}
                onDismissDefinition={handleDismissDefinition}
                onTogglePeek={handleTogglePeek}
                showDefinition={activeDefinitions.has(word)}
                audioError={audioErrors.get(word)}
                definition={definitionCache.get(word)}
                definitionError={definitionErrors.get(word)}
              />
            ))}
          </div>
          <HideButton isHidden={wordsHidden} onToggle={handleToggleHide} />
        </div>
      )}
    </div>
  );
}
