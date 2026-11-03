/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalParameters, SequencerStep, WaveformType, StimulationProtocol, ProtocolSegment, ModulationMode } from '../types/telemetry';

export const POP_FREE_RAMP_SEC = 0.030;
export const SAFETY_CEILING_GAIN = 0.50;

export type StepCallback = (stepIndex: number) => void;

export class SignalChain {
  private ctx: AudioContext;
  public input: GainNode;
  public output: GainNode;
  
  private carrierOsc: OscillatorNode | null = null;
  private carrierGain: GainNode | null = null;
  private vcaGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  
  private modOsc: OscillatorNode | null = null;
  private modGain: GainNode | null = null;
  private modOffset: ConstantSourceNode | null = null;
  
  private analyser: AnalyserNode | null = null;
  private envAnalyser: AnalyserNode | null = null;
  
  private params: SignalParameters;
  private steps: SequencerStep[];
  private seqTimerId: number | null = null;
  private currentStepIndex: number = 0;
  private isRunning: boolean = false;
  private onStepCallback: StepCallback | null = null;

  constructor(ctx: AudioContext, initialParams: SignalParameters, steps: SequencerStep[]) {
    this.ctx = ctx;
    this.params = { ...initialParams };
    this.steps = steps.map(s => ({ ...s }));
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.buildGraph();
  }

  private buildGraph(): void {
    const now = this.ctx.currentTime;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.envAnalyser = this.ctx.createAnalyser();
    this.envAnalyser.fftSize = 1024;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.vcaGain = this.ctx.createGain();
    this.vcaGain.gain.setValueAtTime(0.0, now);
    this.carrierOsc = this.ctx.createOscillator();
    this.carrierOsc.type = this.params.carrierWaveform;
    this.carrierOsc.frequency.setValueAtTime(this.params.carrierFreq, now);
    this.carrierGain = this.ctx.createGain();
    this.carrierGain.gain.setValueAtTime(1.0, now);
    this.modOsc = this.ctx.createOscillator();
    this.modOsc.type = this.params.modWaveform;
    this.modOsc.frequency.setValueAtTime(this.params.modFreq, now);
    this.modGain = this.ctx.createGain();
    this.modGain.gain.setValueAtTime(this.params.modDepth * 0.5, now);
    this.modOffset = this.ctx.createConstantSource();
    this.modOffset.offset.setValueAtTime(1.0 - (this.params.modDepth * 0.5), now);
    this.modOsc.connect(this.modGain);
    this.modGain.connect(this.vcaGain.gain);
    this.modOffset.connect(this.vcaGain.gain);
    const envTap = this.ctx.createGain();
    envTap.gain.setValueAtTime(0.5, now);
    this.modGain.connect(envTap);
    this.modOffset.connect(envTap);
    envTap.connect(this.envAnalyser);
    this.carrierOsc.connect(this.carrierGain);
    this.carrierGain.connect(this.vcaGain);
    this.vcaGain.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.output);
    this.carrierOsc.start(now);
    this.modOsc.start(now);
    this.modOffset.start(now);
  }

  public start(): void {
    const now = this.ctx.currentTime;
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.linearRampToValueAtTime(this.params.masterVolume * SAFETY_CEILING_GAIN, now + POP_FREE_RAMP_SEC);
    this.isRunning = true;
    if (this.params.mode === 'sequenced' || this.params.mode === 'burst' || this.params.mode === 'sweep') this.startClock();
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);
    this.stopClock();
    this.isRunning = false;
  }

  public setCarrierFrequency(freq: number): void {
    this.params.carrierFreq = freq;
    const now = this.ctx.currentTime;
    this.carrierOsc!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
  }

  public setCarrierWaveform(wave: WaveformType): void { this.params.carrierWaveform = wave; this.carrierOsc!.type = wave; }
  public setModFrequency(freq: number): void {
    this.params.modFreq = freq;
    const now = this.ctx.currentTime;
    this.modOsc!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
  }
  public setModWaveform(wave: WaveformType): void { this.params.modWaveform = wave; this.modOsc!.type = wave; }
  public setModDepth(depth: number): void {
    this.params.modDepth = depth;
    const now = this.ctx.currentTime;
    this.modGain!.gain.linearRampToValueAtTime(depth * 0.5, now + POP_FREE_RAMP_SEC);
    this.modOffset!.offset.linearRampToValueAtTime(1.0 - (depth * 0.5), now + POP_FREE_RAMP_SEC);
  }
  public setMasterVolume(vol: number): void {
    this.params.masterVolume = vol;
    if (!this.isRunning) return;
    const now = this.ctx.currentTime;
    this.masterGain!.gain.linearRampToValueAtTime(vol * SAFETY_CEILING_GAIN, now + POP_FREE_RAMP_SEC);
  }
  public setMode(mode: ModulationMode): void { this.params.mode = mode; if (this.isRunning) { if (mode === 'sequenced' || mode === 'burst' || mode === 'sweep') this.startClock(); else this.stopClock(); } }
  public setDutyCycle(duty: number): void { this.params.dutyCycle = duty; }
  public setBurstDuration(ms: number): void { this.params.burstDurationMs = ms; }
  public updateSequencerSteps(steps: SequencerStep[]): void { this.steps = steps.map(s => ({ ...s })); }
  public setOnStepCallback(cb: StepCallback | null): void { this.onStepCallback = cb; }

  private startClock(): void {
    this.stopClock();
    this.currentStepIndex = 0;
    const tick = () => {
      if (!this.isRunning) return;
      const now = this.ctx.currentTime;
      
      if (this.params.mode === 'sequenced' && this.steps.length > 0) {
        const step = this.steps[this.currentStepIndex];
        this.carrierGain!.gain.cancelScheduledValues(now);
        this.carrierGain!.gain.linearRampToValueAtTime(step.active ? step.amplitude : 0.0001, now + POP_FREE_RAMP_SEC);
        if (this.onStepCallback) this.onStepCallback(this.currentStepIndex);
        this.currentStepIndex = (this.currentStepIndex + 1) % this.steps.length;
      } else if (this.params.mode === 'sweep') {
        const startTime = now;
        const endTime = now + this.params.sweepPeriodSec;
        this.carrierOsc!.frequency.cancelScheduledValues(startTime);
        this.carrierOsc!.frequency.setValueAtTime(this.params.sweepStartFreq, startTime);
        this.carrierOsc!.frequency.linearRampToValueAtTime(this.params.sweepEndFreq, endTime);
        
        // Schedule the next sweep
        this.seqTimerId = window.setTimeout(tick, this.params.sweepPeriodSec * 1000);
        return;
      }
      
      this.seqTimerId = window.setTimeout(tick, 1000 / this.params.modFreq);
    };
    tick();
  }

  private stopClock(): void { if (this.seqTimerId !== null) { clearTimeout(this.seqTimerId); this.seqTimerId = null; } }

  public scheduleSegment(seg: ProtocolSegment, startTime: number): void {
    const endTime = startTime + seg.durationSec;
    
    if (seg.type === 'beat' && seg.steps && seg.bpm) {
      const stepDuration = 60 / seg.bpm / 4; // 16th note
      const numSteps = seg.steps.length;
      const totalStepsDuration = stepDuration * numSteps;
      const numLoops = Math.max(1, Math.floor(seg.durationSec / totalStepsDuration));
      
      for (let l = 0; l < numLoops; l++) {
        for (let s = 0; s < numSteps; s++) {
          const step = seg.steps[s];
          const t = startTime + (l * totalStepsDuration) + (s * stepDuration);
          if (t >= endTime) break;
          
          const pulseDuration = step.type === 'bass' ? 0.08 : 0.03;
          const freq = step.type === 'bass' ? 60 : 400;
          const amp = step.type === 'none' ? 0.0001 : 1.0;
          
          if (step.type !== 'none') {
            this.masterGain!.gain.setValueAtTime(0.0001, t);
            this.masterGain!.gain.linearRampToValueAtTime(amp * SAFETY_CEILING_GAIN, t + 0.005);
            this.masterGain!.gain.linearRampToValueAtTime(0.0001, t + pulseDuration);
            
            this.carrierOsc!.frequency.setValueAtTime(freq, t);
          }
        }
      }
      return;
    }

    // Default 'ramp' behavior
    const { startIntensity, endIntensity, startCarrierFreq, endCarrierFreq, startModFreq, endModFreq, interpolation } = seg;

    const ramp = (param: AudioParam, start: number, end: number) => {
      param.cancelScheduledValues(startTime);
      param.setValueAtTime(start, startTime);
      if (interpolation === 'linear') param.linearRampToValueAtTime(end, endTime);
      else param.exponentialRampToValueAtTime(Math.max(0.0001, end), endTime);
    };

    ramp(this.masterGain!.gain, startIntensity * SAFETY_CEILING_GAIN, endIntensity * SAFETY_CEILING_GAIN);
    ramp(this.carrierOsc!.frequency, startCarrierFreq, endCarrierFreq);
    ramp(this.modOsc!.frequency, startModFreq, endModFreq);
  }

  public getOutputWaveform(buffer: Float32Array): void { this.analyser?.getFloatTimeDomainData(buffer as unknown as Float32Array<ArrayBuffer>); }
  public getOutputFrequency(buffer: Float32Array): void { this.analyser?.getFloatFrequencyData(buffer as unknown as Float32Array<ArrayBuffer>); }
  public getEnvelopeWaveform(buffer: Float32Array): void { this.envAnalyser?.getFloatTimeDomainData(buffer as unknown as Float32Array<ArrayBuffer>); }
  public getLevels(): { peak: number; rms: number } {
    if (!this.analyser || !this.isRunning) return { peak: 0, rms: 0 };
    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);
    let sumSq = 0, peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const val = Math.abs(buffer[i]);
      if (val > peak) peak = val;
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / buffer.length);
    return { peak: Math.min(1.0, peak / SAFETY_CEILING_GAIN), rms: Math.min(1.0, rms / (SAFETY_CEILING_GAIN * 0.707)) };
  }

  public destroy(): void { this.stop(); this.carrierOsc?.stop(); this.modOsc?.stop(); this.input.disconnect(); this.output.disconnect(); }
}

export class SignalEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private chains: { left: SignalChain; right: SignalChain } | null = null;
  private params: { left: SignalParameters; right: SignalParameters };
  private steps: { left: SequencerStep[]; right: SequencerStep[] };

  constructor(params: { left: SignalParameters; right: SignalParameters }, steps: { left: SequencerStep[]; right: SequencerStep[] }) {
    this.params = { left: { ...params.left }, right: { ...params.right } };
    this.steps = { left: [...steps.left], right: [...steps.right] };
  }

  public async initAudio(): Promise<boolean> {
    if (this.ctx && this.ctx.state !== 'closed') return true;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return false;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    const merger = this.ctx.createChannelMerger(2);
    this.chains = { left: new SignalChain(this.ctx, this.params.left, this.steps.left), right: new SignalChain(this.ctx, this.params.right, this.steps.right) };
    this.chains.left.output.connect(merger, 0, 0);
    this.chains.right.output.connect(merger, 0, 1);
    merger.connect(this.ctx.destination);
    return true;
  }

  public async start(): Promise<void> { if (!this.ctx) await this.initAudio(); this.chains?.left.start(); this.chains?.right.start(); this.isRunning = true; }
  public stop(): void { this.chains?.left.stop(); this.chains?.right.stop(); this.isRunning = false; }
  public setCarrierFrequency(ch: 'left' | 'right', f: number): void { this.params[ch].carrierFreq = f; this.chains?.[ch].setCarrierFrequency(f); }
  public setCarrierWaveform(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].carrierWaveform = w; this.chains?.[ch].setCarrierWaveform(w); }
  public setModFrequency(ch: 'left' | 'right', f: number): void { this.params[ch].modFreq = f; this.chains?.[ch].setModFrequency(f); }
  public setModWaveform(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].modWaveform = w; this.chains?.[ch].setModWaveform(w); }
  public setModDepth(ch: 'left' | 'right', d: number): void { this.params[ch].modDepth = d; this.chains?.[ch].setModDepth(d); }
  public setMasterVolume(ch: 'left' | 'right', v: number): void { this.params[ch].masterVolume = v; this.chains?.[ch].setMasterVolume(v); }
  public setMode(ch: 'left' | 'right', m: SignalParameters['mode']): void { this.params[ch].mode = m; this.chains?.[ch].setMode(m); }
  public setDutyCycle(ch: 'left' | 'right', d: number): void { this.params[ch].dutyCycle = d; this.chains?.[ch].setDutyCycle(d); }
  public setBurstDuration(ch: 'left' | 'right', ms: number): void { this.params[ch].burstDurationMs = ms; this.chains?.[ch].setBurstDuration(ms); }
  public updateSequencerSteps(ch: 'left' | 'right', s: SequencerStep[]): void { this.steps[ch] = [...s]; this.chains?.[ch].updateSequencerSteps(s); }
  public setOnStepCallback(ch: 'left' | 'right', cb: StepCallback | null): void { this.chains?.[ch].setOnStepCallback(cb); }
  public getLevels(ch: 'left' | 'right'): { peak: number; rms: number } { return this.chains?.[ch].getLevels() || { peak: 0, rms: 0 }; }
  public getOutputWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputWaveform(b); }
  public getOutputFrequency(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputFrequency(b); }
  public getEnvelopeWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getEnvelopeWaveform(b); }
  public getIsRunning(): boolean { return this.isRunning; }
  public async scheduleProtocol(p: StimulationProtocol): Promise<void> {
    if (!this.ctx) await this.initAudio();
    this.stop();
    const now = this.ctx!.currentTime;
    (['left', 'right'] as const).forEach(ch => {
      let time = now;
      p.channels[ch].forEach(seg => { this.chains?.[ch].scheduleSegment(seg, time); time += seg.durationSec; });
    });
    this.isRunning = true;
  }
  public destroy(): void { this.chains?.left.destroy(); this.chains?.right.destroy(); this.ctx?.close(); }
}
