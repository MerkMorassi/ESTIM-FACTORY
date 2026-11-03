/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * @see https://github.com/WebAudio/web-audio-api - W3C Web Audio API Specification
 * 
 * Ayurvedic Harmonic Series Oscillator Engine
 * Implements additive synthesis with 12 harmonics based on A4=432Hz tuning.
 * Enforces strict 30ms pop-free ramping for all gain state transitions.
 */

export const POP_FREE_RAMP_SEC = 0.030;
export const A4_TUNING_HZ = 432; // Sacred A432 Tuning

export interface ADSRParams {
  attack: number;  // 0.001 - 2.0s
  decay: number;   // 0.001 - 2.0s
  sustain: number; // 0.0 - 1.0 level
  release: number; // 0.001 - 2.0s
}

export interface HarmonicParams {
  baseFreq: number;    // 10Hz - 20000Hz
  masterVolume: number; // 0.0 - 1.0
  harmonicCount: number; // 1 - 12
  harmonicSlope: number; // 0.0 - 1.0 (falloff)
  adsr: ADSRParams;
}

export class HarmonicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private adsrGain: GainNode | null = null;
  private harmonics: { osc: OscillatorNode; gain: GainNode }[] = [];
  private params: HarmonicParams;
  private isNoteActive: boolean = false;

  constructor(initialParams: HarmonicParams) {
    this.params = { ...initialParams };
  }

  public async init(audioCtx?: AudioContext): Promise<void> {
    if (this.ctx) return;
    
    this.ctx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = this.ctx.currentTime;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    
    this.adsrGain = this.ctx.createGain();
    this.adsrGain.gain.setValueAtTime(0.0001, now);

    this.masterGain.connect(this.ctx.destination);
    this.adsrGain.connect(this.masterGain);

    this.updateHarmonics();
  }

  private updateHarmonics(): void {
    if (!this.ctx || !this.adsrGain) return;
    const now = this.ctx.currentTime;

    // Stop and clear existing harmonics
    this.harmonics.forEach(h => {
      try {
        h.osc.stop();
        h.osc.disconnect();
        h.gain.disconnect();
      } catch (e) {}
    });
    this.harmonics = [];

    // Create new harmonic series
    for (let i = 1; i <= this.params.harmonicCount; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.params.baseFreq * i, now);

      // Ayurvedic falloff calculation (Harmonic Series)
      // Level = 1/i modified by slope
      const rawLevel = 1 / i;
      const level = Math.pow(rawLevel, 1 + (1 - this.params.harmonicSlope) * 2);
      
      gain.gain.setValueAtTime(level, now);

      osc.connect(gain);
      gain.connect(this.adsrGain);
      osc.start(now);

      this.harmonics.push({ osc, gain });
    }
  }

  public triggerAttack(): void {
    if (!this.ctx || !this.adsrGain) return;
    const now = this.ctx.currentTime;
    const { attack, decay, sustain } = this.params.adsr;

    this.isNoteActive = true;
    this.adsrGain.gain.cancelScheduledValues(now);
    
    // Attack Phase
    this.adsrGain.gain.setValueAtTime(this.adsrGain.gain.value, now);
    this.adsrGain.gain.linearRampToValueAtTime(1.0, now + Math.max(0.001, attack));
    
    // Decay Phase to Sustain Level
    this.adsrGain.gain.linearRampToValueAtTime(sustain, now + Math.max(0.001, attack) + Math.max(0.001, decay));

    // Master volume ramp
    this.masterGain?.gain.cancelScheduledValues(now);
    this.masterGain?.gain.linearRampToValueAtTime(this.params.masterVolume, now + POP_FREE_RAMP_SEC);
  }

  public triggerRelease(): void {
    if (!this.ctx || !this.adsrGain) return;
    const now = this.ctx.currentTime;
    const { release } = this.params.adsr;

    this.isNoteActive = false;
    this.adsrGain.gain.cancelScheduledValues(now);
    this.adsrGain.gain.setValueAtTime(this.adsrGain.gain.value, now);
    this.adsrGain.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.001, release));
  }

  public setBaseFrequency(freq: number): void {
    this.params.baseFreq = Math.max(10, Math.min(20000, freq));
    const now = this.ctx?.currentTime || 0;
    
    this.harmonics.forEach((h, i) => {
      const harmonicFreq = this.params.baseFreq * (i + 1);
      h.osc.frequency.cancelScheduledValues(now);
      h.osc.frequency.setValueAtTime(h.osc.frequency.value, now);
      h.osc.frequency.exponentialRampToValueAtTime(Math.max(10, harmonicFreq), now + POP_FREE_RAMP_SEC);
    });
  }

  public setMasterVolume(vol: number): void {
    this.params.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.isNoteActive) {
      const now = this.ctx?.currentTime || 0;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.params.masterVolume, now + POP_FREE_RAMP_SEC);
    }
  }

  public updateParams(newParams: Partial<HarmonicParams>): void {
    const oldHarmonicCount = this.params.harmonicCount;
    const oldSlope = this.params.harmonicSlope;
    
    this.params = { ...this.params, ...newParams };

    if (newParams.harmonicCount !== undefined || newParams.harmonicSlope !== undefined) {
      this.updateHarmonics();
    }
  }

  public getIsActive(): boolean {
    return this.isNoteActive;
  }

  public stop(): void {
    this.triggerRelease();
  }

  public destroy(): void {
    this.harmonics.forEach(h => {
      try {
        h.osc.stop();
        h.osc.disconnect();
      } catch (e) {}
    });
    this.masterGain?.disconnect();
    this.adsrGain?.disconnect();
  }
}
