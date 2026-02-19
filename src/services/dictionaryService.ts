/**
 * Dictionary Service for word definitions using Free Dictionary API
 * Provides word definition lookup functionality with caching
 */

const DICTIONARY_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

interface DictionitionCacheEntry {
  definition: string;
  timestamp: number;
}

interface DictionaryAPIResponse {
  word: string;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}

// In-memory cache for definitions
const definitionCache = new Map<string, DictionitionCacheEntry>();

/**
 * Get definition for a word from Free Dictionary API
 * @param word - The word to look up
 * @returns Definition string
 * @throws Error if dictionary service fails or word not found
 */
export async function getDefinition(word: string): Promise<string> {
  // Check cache first
  const cached = getCachedDefinition(word);
  if (cached) {
    return cached;
  }

  try {
    // Add timeout to dictionary request (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${DICTIONARY_API_BASE}/${encodeURIComponent(word)}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No definition found for this word');
      }
      throw new Error(`Dictionary service error: ${response.status}`);
    }

    const data: DictionaryAPIResponse[] = await response.json();
    
    // Validate response data
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid response from dictionary service');
    }

    // Extract the first definition from the first meaning
    const firstMeaning = data[0].meanings?.[0];
    if (!firstMeaning || !firstMeaning.definitions || firstMeaning.definitions.length === 0) {
      throw new Error('No definition found in response');
    }

    const definition = firstMeaning.definitions[0].definition;
    
    if (!definition || typeof definition !== 'string') {
      throw new Error('Invalid definition data received');
    }
    
    // Cache the definition
    cacheDefinition(word, definition);
    
    return definition;
  } catch (err) {
    if (err instanceof Error) {
      // Handle specific error types
      if (err.name === 'AbortError') {
        throw new Error('Definition request timed out. Please try again.');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Network error. Please check your connection.');
      }
      // Re-throw known errors
      throw err;
    }
    throw new Error('Failed to fetch definition: Unknown error');
  }
}

/**
 * Get cached definition for a word
 * @param word - The word to look up
 * @returns Definition string or null if not cached
 */
export function getCachedDefinition(word: string): string | null {
  const entry = definitionCache.get(word.toLowerCase());
  return entry ? entry.definition : null;
}

/**
 * Cache definition for a word
 * @param word - The word to cache
 * @param definition - Definition string
 */
export function cacheDefinition(word: string, definition: string): void {
  definitionCache.set(word.toLowerCase(), {
    definition,
    timestamp: Date.now(),
  });
}

/**
 * Clear the definition cache
 */
export function clearCache(): void {
  definitionCache.clear();
}
