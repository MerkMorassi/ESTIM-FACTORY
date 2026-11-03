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
      let list = await storage.getProtocols();
      
      // Seed default demo if library is empty
      if (list.length === 0) {
        const demoProtocol: StimulationProtocol = {
          name: 'Getting Started Demo',
          description: 'A comprehensive 4-stage sequence transitioning from gentle arousal to rhythmic stimulation.',
          totalDurationMs: 40000,
          lastModified: Date.now(),
          masterBpm: 120,
          channels: {
            left: [
              {
                id: 'demo-l-1',
                type: 'ramp',
                durationSec: 10,
                startIntensity: 0.1,
                endIntensity: 0.3,
                startCarrierFreq: 100,
                endCarrierFreq: 100,
                startModFreq: 10,
                endModFreq: 10,
                interpolation: 'linear',
                label: '1. Soft Warmup'
              },
              {
                id: 'demo-l-2',
                type: 'beat',
                durationSec: 10,
                startIntensity: 0.4,
                endIntensity: 0.4,
                startCarrierFreq: 100,
                endCarrierFreq: 100,
                startModFreq: 10,
                endModFreq: 10,
                interpolation: 'linear',
                bpm: 120,
                steps: Array(16).fill(null).map((_, i) => ({ type: i % 4 === 0 ? 'bass' : i % 8 === 4 ? 'snare' : 'none' })),
                label: '2. Basic Pulse'
              },
              {
                id: 'demo-l-3',
                type: 'ramp',
                durationSec: 10,
                startIntensity: 0.4,
                endIntensity: 0.6,
                startCarrierFreq: 100,
                endCarrierFreq: 250,
                startModFreq: 10,
                endModFreq: 40,
                interpolation: 'exponential',
                label: '3. Intensify'
              },
              {
                id: 'demo-l-4',
                type: 'beat',
                durationSec: 10,
                startIntensity: 0.5,
                endIntensity: 0.5,
                startCarrierFreq: 200,
                endCarrierFreq: 200,
                startModFreq: 15,
                endModFreq: 15,
                interpolation: 'linear',
                bpm: 140,
                steps: Array(16).fill(null).map((_, i) => ({ type: i % 2 === 0 ? 'bass' : 'snare' })),
                label: '4. High Response'
              }
            ],
            right: [
              {
                id: 'demo-r-1',
                type: 'ramp',
                durationSec: 20,
                startIntensity: 0.2,
                endIntensity: 0.2,
                startCarrierFreq: 80,
                endCarrierFreq: 80,
                startModFreq: 5,
                endModFreq: 5,
                interpolation: 'linear',
                label: 'Baseline Layer'
              },
              {
                id: 'demo-r-2',
                type: 'ramp',
                durationSec: 20,
                startIntensity: 0.2,
                endIntensity: 0.5,
                startCarrierFreq: 80,
                endCarrierFreq: 150,
                startModFreq: 5,
                endModFreq: 20,
                interpolation: 'linear',
                label: 'Dynamic Support'
              }
            ]
          }
        };
        await storage.saveProtocol(demoProtocol);
        list = await storage.getProtocols();
      }
      
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
