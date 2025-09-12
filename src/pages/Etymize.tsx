import React, { useState, FormEvent, useEffect } from 'react';

interface FormElements extends HTMLFormControlsCollection {
  wordInput: HTMLTextAreaElement;
}

interface EtymizeFormElement extends HTMLFormElement {
  readonly elements: FormElements;
}

const ENDPOINT = 'https://bry1jd6sz0.execute-api.us-west-1.amazonaws.com/etymize';
const ETYMOLOGY_PROMPT = (word: string) => 
`What is the etymology of the word "${word}"?`;
const RELATED_WORDS_IN_ENGLISH_PROMPT = (word: string) => 
  `What are 5 other words that come from each root of "${word}"?
  (Choose words in English, other than "${word}" itself, that come from the same etymological root) 
   For each root, use this format: "Root #: [root] (meaning)".
   For each word, use this format: "#. [word]".`;
const RELATED_WORDS_IN_SAME_LANGUAGE_PROMPT = (word: string) => 
`What are 5 other words that come from each root of "${word}"?
(Choose words in the same language as "${word}", other than "${word}" itself, that come from the same etymological root) 
 For each root, use this format: "Root #: [root] (meaning)".
 For each word, use this format: "#. [word] (romanized pronunciation)".`;

const RELATED_WORDS_PROMPT = (word: string) => {
  // determine if the word is in English, based on whether it uses Latin alphabet, also allowing for accents, spaces, hyphens, etc.
  const isEnglish = word.match(/[a-zA-Z\u00C0-\u017F''-]+(?: [a-zA-Z\u00C0-\u017F''-]+)*/);
  if (isEnglish) {
    return RELATED_WORDS_IN_ENGLISH_PROMPT(word);
  } else {
    return RELATED_WORDS_IN_SAME_LANGUAGE_PROMPT(word);
  }
};

function convertWordsToLinks(text: string): string {
  // Matches: digit(s) followed by dot and space, then captures all text until opening parenthesis
  return text.replace(
    /(\d+\.\s+)([^(\n]+?)(?=\s*\(|\n|$)/g, 
    (_, number, word) => `${number}<a href="/etymize?word=${encodeURIComponent(word.trim())}">${word.trim()}</a>`
  );
}

export default function Etymize(): JSX.Element {
  const [etymology, setEtymology] = useState<string>('');
  const [relatedWords, setRelatedWords] = useState<string>('');
  const [etymologyError, setEtymologyError] = useState<string | null>(null);
  const [relatedWordsError, setRelatedWordsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wordInput, setWordInput] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wordParam = params.get('word');
    if (wordParam) {
      setWordInput(wordParam);
      handleEtymologySearch(wordParam);
    }
  }, []);

  const handleEtymologySearch = async (word: string): Promise<void> => {
    if (!word.trim()) {
      setEtymologyError("Please enter a word");
      return;
    }

    setIsLoading(true);
    setEtymologyError(null);
    setRelatedWordsError(null);

    try {
      // Fetch etymology
      const etymologyResponse = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "openai",
          messages: [
            { role: "user", content: ETYMOLOGY_PROMPT(word) }
          ]
        }),
      });

      if (!etymologyResponse.ok) {
        throw new Error(`HTTP error! status: ${etymologyResponse.status}`);
      }

      const etymologyData = await etymologyResponse.json();
      setEtymology(etymologyData.reply);
    } catch (err) {
      setEtymologyError(err instanceof Error ? err.message : 'An error occurred fetching etymology');
    }

    try {
      // Fetch related words
      const relatedWordsResponse = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "openai",
          messages: [{ 
            role: "user", 
            content: RELATED_WORDS_PROMPT(word),
          }]
        }),
      });

      if (!relatedWordsResponse.ok) {
        throw new Error(`HTTP error! status: ${relatedWordsResponse.status}`);
      }

      const relatedWordsData = await relatedWordsResponse.json();
      setRelatedWords(relatedWordsData.reply);
    } catch (err) {
      setRelatedWordsError(err instanceof Error ? err.message : 'An error occurred fetching related words');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<EtymizeFormElement>): void => {
    e.preventDefault();
    const word = e.currentTarget.elements.wordInput.value.trim();
    
    // Update URL with the new word
    const newParams = new URLSearchParams(window.location.search);
    newParams.set('word', word);
    window.history.pushState({}, '', `${window.location.pathname}?${newParams.toString()}`);
    
    handleEtymologySearch(word);
  };

  return (
    <div className="App" style={{ textAlign: 'left', margin: '20px' }}>
      <h2>📚 Etymize: Word Etymology Finder</h2>
      <h4>Enter a word to discover its etymology and related words</h4>

      <form style={{ marginBottom: '20px' }} onSubmit={handleSubmit}>
        <p>Enter word:</p>
        <textarea 
          name="wordInput"
          placeholder="Enter a word..."
          value={wordInput}
          onChange={(e) => setWordInput(e.target.value)}
          style={{ 
            width: '300px', 
            height: '50px',
            resize: 'both',
            margin: '10px'
          }}
        />
        <br/>
        <button 
          type="submit" 
          style={{ margin: '10px' }}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Find Etymology'}
        </button>
      </form>

      <div>
        {etymologyError && (
          <div style={{ 
            color: 'red',
            backgroundColor: '#ffebee',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px'
          }}>
            Etymology Error: {etymologyError}
          </div>
        )}

        {etymology && (
          <div style={{ 
            backgroundColor: '#f5f5f5',
            padding: '20px',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            <h3>Etymology:</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{etymology}</p>
          </div>
        )}
      </div>

      <div>
        {relatedWordsError && (
          <div style={{ 
            color: 'red',
            backgroundColor: '#ffebee',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px'
          }}>
            Related Words Error: {relatedWordsError}
          </div>
        )}

        {relatedWords && (
          <div style={{ 
            backgroundColor: '#f5f5f5',
            padding: '20px',
            borderRadius: '4px',
            marginTop: '20px'
          }}>
            <h3>Related Words:</h3>
            <p 
              style={{ whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ 
                __html: convertWordsToLinks(relatedWords) 
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
} 