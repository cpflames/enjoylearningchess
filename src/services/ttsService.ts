/**
 * TTS Service for audio pronunciation using AWS Polly
 * Provides text-to-speech functionality with caching
 */

const TTS_ENDPOINT = 'https://03p41gfpnf.execute-api.us-east-1.amazonaws.com/prod';

interface PollyResponse {
  audioContent: string; // base64 encoded audio
  contentType: string;
}

interface AudioCacheEntry {
  audioData: string;
  timestamp: number;
  contentType: string;
}

// In-memory cache for audio data
const audioCache = new Map<string, AudioCacheEntry>();

/**
 * Synthesize speech for a word using AWS Polly via Lambda
 * @param word - The word to synthesize
 * @returns Base64-encoded audio data
 * @throws Error if TTS service fails
 */
export async function synthesizeSpeech(word: string): Promise<string> {
  // Check cache first
  const cached = getCachedAudio(word);
  if (cached) {
    return cached;
  }

  try {
    // Add timeout to TTS request (10 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `TTS service error: ${response.status}`);
    }

    const data: PollyResponse = await response.json();
    
    // Validate audio data
    if (!data.audioContent || typeof data.audioContent !== 'string') {
      throw new Error('Invalid audio data received from TTS service');
    }
    
    // Cache the audio data
    cacheAudio(word, data.audioContent, data.contentType);
    
    return data.audioContent;
  } catch (err) {
    if (err instanceof Error) {
      // Handle specific error types
      if (err.name === 'AbortError') {
        throw new Error('Audio request timed out. Please try again.');
      }
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw new Error(`Failed to synthesize speech: ${err.message}`);
    }
    throw new Error('Failed to synthesize speech: Unknown error');
  }
}

/**
 * Get cached audio data for a word
 * @param word - The word to look up
 * @returns Base64-encoded audio data or null if not cached
 */
export function getCachedAudio(word: string): string | null {
  const entry = audioCache.get(word.toLowerCase());
  return entry ? entry.audioData : null;
}

/**
 * Cache audio data for a word
 * @param word - The word to cache
 * @param audioData - Base64-encoded audio data
 * @param contentType - Audio content type (e.g., "audio/mpeg")
 */
export function cacheAudio(word: string, audioData: string, contentType: string = 'audio/mpeg'): void {
  audioCache.set(word.toLowerCase(), {
    audioData,
    timestamp: Date.now(),
    contentType,
  });
}

/**
 * Play audio for a word
 * @param word - The word to pronounce
 * @throws Error if audio playback fails
 */
export async function playAudio(word: string): Promise<void> {
  // Check browser compatibility
  if (typeof Audio === 'undefined') {
    throw new Error('Audio playback not supported in this browser');
  }

  try {
    const audioData = await synthesizeSpeech(word);
    
    // Create and play audio element
    const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
    
    // Wait for audio to be ready
    await new Promise<void>((resolve, reject) => {
      audio.addEventListener('canplaythrough', () => resolve(), { once: true });
      audio.addEventListener('error', (e) => {
        const errorMsg = audio.error 
          ? `Audio playback failed: ${audio.error.message || 'Unknown error'}`
          : 'Audio playback failed';
        reject(new Error(errorMsg));
      }, { once: true });
      
      // Add timeout for loading audio
      const timeoutId = setTimeout(() => {
        reject(new Error('Audio loading timed out'));
      }, 5000);
      
      audio.addEventListener('canplaythrough', () => clearTimeout(timeoutId), { once: true });
      audio.addEventListener('error', () => clearTimeout(timeoutId), { once: true });
      
      audio.load();
    });
    
    await audio.play();
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(`Audio playback error: ${err.message}`);
    }
    throw new Error('Audio playback error: Unknown error');
  }
}

/**
 * Clear the audio cache
 */
export function clearCache(): void {
  audioCache.clear();
}
