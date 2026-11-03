/**
 * @file amplitudeModulator.d.ts
 * Type definitions for self-contained vanilla JavaScript amplitudeModulator.js
 * @see https://github.com/WebAudio/web-audio-api - W3C Web Audio API Specification
 */

export const POP_FREE_RAMP_SEC: number;

export interface AmplitudeModulatorOptions {
  rate?: number;
  waveform?: 'sine' | 'triangle';
  depth?: number;
  pattern?: number[] | null;
}

export interface AmplitudeModulatorState {
  isRunning: boolean;
  rateHz: number;
  depth: number;
  waveform: 'sine' | 'triangle';
  hasPattern: boolean;
  patternLength: number;
}

export interface AmplitudeModulator {
  input: GainNode;
  output: GainNode;
  connectInput(sourceNode: AudioNode): void;
  connectOutput(destinationNode: AudioNode): void;
  setRate(rateHz: number): void;
  setPattern(pattern: number[] | null): void;
  setDepth(depth: number): void;
  setWaveform(waveform: 'sine' | 'triangle'): void;
  start(): void;
  stop(): void;
  disconnect(): void;
  getState(): AmplitudeModulatorState;
}

export function createAmplitudeModulator(
  audioCtx: AudioContext,
  options?: AmplitudeModulatorOptions
): AmplitudeModulator;
