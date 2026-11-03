import { useState, useEffect, useCallback } from 'react';
import { StimulationProtocol } from '../types/telemetry';
import { storage } from './storage';

/**
 * Hook for managing persistent stimulation protocols via IndexedDB.
 * Provides a synchronized interface for saving, deleting, and fetching clinician sequences.
 */
export function useProtocols() {
  const [protocols, setProtocols] = useState<StimulationProtocol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProtocols = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await storage.getProtocols();
      setProtocols(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch protocols'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveProtocol = useCallback(async (protocol: StimulationProtocol) => {
    try {
      await storage.saveProtocol(protocol);
      await fetchProtocols();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save protocol'));
      throw err;
    }
  }, [fetchProtocols]);

  const deleteProtocol = useCallback(async (id: string) => {
    try {
      await storage.deleteProtocol(id);
      await fetchProtocols();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete protocol'));
      throw err;
    }
  }, [fetchProtocols]);

  useEffect(() => {
    fetchProtocols();
  }, [fetchProtocols]);

  return {
    protocols,
    isLoading,
    error,
    saveProtocol,
    deleteProtocol,
    refresh: fetchProtocols,
  };
}
