import { useState, useEffect, useCallback } from 'react';
import { BeatTemplate } from '../types/telemetry';
import { storage } from './storage';

/**
 * Hook for managing persistent rhythmic beat templates via IndexedDB.
 */
export function useBeats() {
  const [beats, setBeats] = useState<BeatTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBeats = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await storage.getBeats();
      setBeats(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch beats'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveBeat = useCallback(async (beat: BeatTemplate) => {
    try {
      await storage.saveBeat(beat);
      await fetchBeats();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save beat'));
      throw err;
    }
  }, [fetchBeats]);

  const deleteBeat = useCallback(async (id: string) => {
    try {
      await storage.deleteBeat(id);
      await fetchBeats();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete beat'));
      throw err;
    }
  }, [fetchBeats]);

  useEffect(() => {
    fetchBeats();
  }, [fetchBeats]);

  return {
    beats,
    isLoading,
    error,
    saveBeat,
    deleteBeat,
    refresh: fetchBeats,
  };
}
