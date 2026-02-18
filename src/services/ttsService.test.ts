/**
 * Tests for TTS Service
 */

import { synthesizeSpeech, getCachedAudio, cacheAudio, clearCache } from './ttsService';

// Mock fetch globally
global.fetch = jest.fn();

describe('TTS Service', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('cacheAudio and getCachedAudio', () => {
    it('should cache and retrieve audio data', () => {
      const word = 'hello';
      const audioData = 'base64audiodata';
      
      cacheAudio(word, audioData);
      
      const cached = getCachedAudio(word);
      expect(cached).toBe(audioData);
    });

    it('should return null for uncached words', () => {
      const cached = getCachedAudio('nonexistent');
      expect(cached).toBeNull();
    });

    it('should be case-insensitive', () => {
      const audioData = 'base64audiodata';
      
      cacheAudio('Hello', audioData);
      
      expect(getCachedAudio('hello')).toBe(audioData);
      expect(getCachedAudio('HELLO')).toBe(audioData);
      expect(getCachedAudio('HeLLo')).toBe(audioData);
    });
  });

  describe('synthesizeSpeech', () => {
    it('should fetch audio from API and cache it', async () => {
      const word = 'test';
      const mockAudioData = 'mockbase64audio';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audioContent: mockAudioData,
          contentType: 'audio/mpeg',
        }),
      });

      const result = await synthesizeSpeech(word);
      
      expect(result).toBe(mockAudioData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tts'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word }),
        })
      );
      
      // Verify it was cached
      expect(getCachedAudio(word)).toBe(mockAudioData);
    });

    it('should return cached audio without fetching', async () => {
      const word = 'cached';
      const cachedData = 'cachedaudiodata';
      
      cacheAudio(word, cachedData);
      
      const result = await synthesizeSpeech(word);
      
      expect(result).toBe(cachedData);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should throw error on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });

      await expect(synthesizeSpeech('error')).rejects.toThrow('Failed to synthesize speech');
    });

    it('should throw error on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(synthesizeSpeech('network')).rejects.toThrow('Failed to synthesize speech');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached audio', () => {
      cacheAudio('word1', 'audio1');
      cacheAudio('word2', 'audio2');
      
      expect(getCachedAudio('word1')).toBe('audio1');
      expect(getCachedAudio('word2')).toBe('audio2');
      
      clearCache();
      
      expect(getCachedAudio('word1')).toBeNull();
      expect(getCachedAudio('word2')).toBeNull();
    });
  });
});
