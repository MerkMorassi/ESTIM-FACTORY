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
  
  private carrierOscA: OscillatorNode | null = null;
  private carrierGainA: GainNode | null = null;
  private carrierOscB: OscillatorNode | null = null;
  private carrierGainB: GainNode | null = null;
  private phaseDelay: DelayNode | null = null;
  private sequencerGain: GainNode | null = null;
  private vcaGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private muteGain: GainNode | null = null;
  
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
  private isMuted: boolean = false;
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
    this.muteGain = this.ctx.createGain();
    this.muteGain.gain.setValueAtTime(1.0, now);
    this.vcaGain = this.ctx.createGain();
    this.vcaGain.gain.setValueAtTime(0.0, now);
    
    // Phase Delay Node
    this.phaseDelay = this.ctx.createDelay(1.0); // 1s max delay
    const initialDelay = (this.params.carrierPhase / 360) * (1 / Math.max(1, this.params.carrierFreq));
    this.phaseDelay.delayTime.setValueAtTime(initialDelay, now);
    
    // Sequencer gate (default to open, pulsed in sequenced mode)
    this.sequencerGain = this.ctx.createGain();
    this.sequencerGain.gain.setValueAtTime(1.0, now);
    
    // Carrier A
    this.carrierOscA = this.ctx.createOscillator();
    this.carrierOscA.type = this.params.carrierWaveform;
    this.carrierOscA.frequency.setValueAtTime(this.params.carrierFreq, now);
    this.carrierGainA = this.ctx.createGain();
    const gainA = 1.0 - this.params.carrierMorph;
    this.carrierGainA.gain.setValueAtTime(gainA, now);
    
    // Carrier B
    this.carrierOscB = this.ctx.createOscillator();
    this.carrierOscB.type = this.params.carrierWaveformB;
    this.carrierOscB.frequency.setValueAtTime(this.params.carrierFreq, now);
    this.carrierGainB = this.ctx.createGain();
    const gainB = this.params.carrierMorph;
    this.carrierGainB.gain.setValueAtTime(gainB, now);

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
    
    this.carrierOscA.connect(this.carrierGainA);
    this.carrierOscB.connect(this.carrierGainB);
    this.carrierGainA.connect(this.phaseDelay);
    this.carrierGainB.connect(this.phaseDelay);
    this.phaseDelay.connect(this.sequencerGain);
    this.sequencerGain.connect(this.vcaGain);
    
    this.vcaGain.connect(this.masterGain);
    this.masterGain.connect(this.muteGain);
    this.muteGain.connect(this.analyser);
    this.analyser.connect(this.output);
    
    this.carrierOscA.start(now);
    this.carrierOscB.start(now);
    this.modOsc.start(now);
    this.modOffset.start(now);
  }

  private transitionStartTime: number = 0;
  private transitionType: 'none' | 'amplitude' | 'frequency' = 'none';

  private trackTransition(type: 'amplitude' | 'frequency'): void {
    this.transitionStartTime = this.ctx.currentTime;
    this.transitionType = type;
  }

  public getTransitionProgress(): { progress: number; type: 'none' | 'amplitude' | 'frequency' } {
    const elapsed = this.ctx.currentTime - this.transitionStartTime;
    if (elapsed > POP_FREE_RAMP_SEC + 0.02) return { progress: 1, type: 'none' };
    return { progress: Math.min(1.0, elapsed / POP_FREE_RAMP_SEC), type: this.transitionType };
  }

  public cancelAutomation(): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.muteGain!.gain.cancelScheduledValues(now);
    this.carrierOscA!.frequency.cancelScheduledValues(now);
    this.carrierOscB!.frequency.cancelScheduledValues(now);
    this.modOsc!.frequency.cancelScheduledValues(now);
    this.modGain!.gain.cancelScheduledValues(now);
    this.modOffset!.offset.cancelScheduledValues(now);
    this.sequencerGain!.gain.cancelScheduledValues(now);
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
  }

  public start(): void {
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.cancelAutomation();
    this.masterGain!.gain.linearRampToValueAtTime(this.params.masterVolume * SAFETY_CEILING_GAIN, now + POP_FREE_RAMP_SEC);
    this.muteGain!.gain.linearRampToValueAtTime(this.isMuted ? 0.0001 : 1.0, now + POP_FREE_RAMP_SEC);
    this.isRunning = true;
    if (this.params.mode === 'sequenced' || this.params.mode === 'burst' || this.params.mode === 'sweep') this.startClock();
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.cancelAutomation();
    this.masterGain!.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);
    this.stopClock();
    this.isRunning = false;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.muteGain!.gain.cancelScheduledValues(now);
    this.muteGain!.gain.linearRampToValueAtTime(muted ? 0.0001 : 1.0, now + POP_FREE_RAMP_SEC);
  }

  public setCarrierFrequency(freq: number): void {
    this.params.carrierFreq = freq;
    const now = this.ctx.currentTime;
    this.trackTransition('frequency');
    this.carrierOscA!.frequency.cancelScheduledValues(now);
    this.carrierOscA!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
    this.carrierOscB!.frequency.cancelScheduledValues(now);
    this.carrierOscB!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
    
    // Maintain phase shift delay
    const delay = (this.params.carrierPhase / 360) * (1 / Math.max(1, freq));
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
    this.phaseDelay!.delayTime.linearRampToValueAtTime(delay, now + POP_FREE_RAMP_SEC);
  }

  public setCarrierWaveform(wave: WaveformType): void { this.params.carrierWaveform = wave; this.carrierOscA!.type = wave; }
  public setCarrierWaveformB(wave: WaveformType): void { this.params.carrierWaveformB = wave; this.carrierOscB!.type = wave; }
  public setCarrierMorph(morph: number): void {
    this.params.carrierMorph = morph;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.carrierGainA!.gain.cancelScheduledValues(now);
    this.carrierGainA!.gain.linearRampToValueAtTime(1.0 - morph, now + POP_FREE_RAMP_SEC);
    this.carrierGainB!.gain.cancelScheduledValues(now);
    this.carrierGainB!.gain.linearRampToValueAtTime(morph, now + POP_FREE_RAMP_SEC);
  }
  public setCarrierPhase(phase: number): void {
    this.params.carrierPhase = phase;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude'); 
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
    const delay = (phase / 360) * (1 / Math.max(1, this.params.carrierFreq));
    this.phaseDelay!.delayTime.linearRampToValueAtTime(delay, now + POP_FREE_RAMP_SEC);
  }
  public setModFrequency(freq: number): void {
    this.params.modFreq = freq;
    const now = this.ctx.currentTime;
    this.trackTransition('frequency');
    this.modOsc!.frequency.cancelScheduledValues(now);
    this.modOsc!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
  }
  public setModWaveform(wave: WaveformType): void { this.params.modWaveform = wave; this.modOsc!.type = wave; }
  public setModDepth(depth: number): void {
    this.params.modDepth = depth;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.modGain!.gain.cancelScheduledValues(now);
    this.modGain!.gain.linearRampToValueAtTime(depth * 0.5, now + POP_FREE_RAMP_SEC);
    this.modOffset!.offset.cancelScheduledValues(now);
    this.modOffset!.offset.linearRampToValueAtTime(1.0 - (depth * 0.5), now + POP_FREE_RAMP_SEC);
  }
  public setMasterVolume(vol: number): void {
    this.params.masterVolume = vol;
    if (!this.isRunning) return;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.linearRampToValueAtTime(vol * SAFETY_CEILING_GAIN, now + POP_FREE_RAMP_SEC);
  }
  public setMode(mode: ModulationMode): void { this.params.mode = mode; if (this.isRunning) { if (mode === 'sequenced' || mode === 'burst' || mode === 'sweep') this.startClock(); else this.stopClock(); } }
  public setDutyCycle(duty: number): void { this.params.dutyCycle = duty; }
  public setBurstDuration(ms: number): void { this.params.burstDurationMs = ms; }
  public setMasterBpm(bpm: number): void { this.params.masterBpm = bpm; if (this.isRunning && this.params.syncToMaster) this.startClock(); }
  public setSyncToMaster(sync: boolean): void { this.params.syncToMaster = sync; if (this.isRunning) this.startClock(); }
  public setLoopRange(start: number, end: number): void { this.params.seqLoopStart = start; this.params.seqLoopEnd = end; }
  public updateSequencerSteps(steps: SequencerStep[]): void { this.steps = steps.map(s => ({ ...s })); }
  public setOnStepCallback(cb: StepCallback | null): void { this.onStepCallback = cb; }

  private startClock(): void {
    this.stopClock();
    this.currentStepIndex = Math.max(0, this.params.seqLoopStart || 0);
    const tick = () => {
      if (!this.isRunning) return;
      const now = this.ctx.currentTime;
      
      if (this.params.mode === 'sequenced' && this.steps.length > 0) {
        const step = this.steps[this.currentStepIndex];
        this.trackTransition('amplitude');
        this.sequencerGain!.gain.cancelScheduledValues(now);
        this.sequencerGain!.gain.linearRampToValueAtTime(step.active ? step.amplitude : 0.0001, now + POP_FREE_RAMP_SEC);
        if (this.onStepCallback) this.onStepCallback(this.currentStepIndex);
        
        const start = this.params.seqLoopStart ?? 0;
        const end = this.params.seqLoopEnd ?? (this.steps.length - 1);
        
        this.currentStepIndex++;
        if (this.currentStepIndex > end || this.currentStepIndex >= this.steps.length) {
          this.currentStepIndex = Math.max(0, Math.min(start, this.steps.length - 1));
        }
      } else if (this.params.mode === 'sweep') {
        const startTime = now;
        const sweepPeriod = this.params.syncToMaster ? (60 / this.params.masterBpm) * 4 : this.params.sweepPeriodSec; 
        const endTime = now + sweepPeriod;
        this.carrierOscA!.frequency.cancelScheduledValues(startTime);
        this.carrierOscA!.frequency.setValueAtTime(this.params.sweepStartFreq, startTime);
        this.carrierOscA!.frequency.linearRampToValueAtTime(this.params.sweepEndFreq, endTime);
        this.carrierOscB!.frequency.cancelScheduledValues(startTime);
        this.carrierOscB!.frequency.setValueAtTime(this.params.sweepStartFreq, startTime);
        this.carrierOscB!.frequency.linearRampToValueAtTime(this.params.sweepEndFreq, endTime);
        
        // Schedule the next sweep
        this.seqTimerId = window.setTimeout(tick, sweepPeriod * 1000);
        return;
      }
      
      const delayMs = this.params.syncToMaster ? (60000 / this.params.masterBpm) / 4 : (1000 / this.params.modFreq);
      this.seqTimerId = window.setTimeout(tick, delayMs);
    };
    tick();
  }

  private stopClock(): void { if (this.seqTimerId !== null) { clearTimeout(this.seqTimerId); this.seqTimerId = null; } }

  public scheduleSegment(seg: ProtocolSegment, startTime: number, masterBpm?: number): void {
    const endTime = startTime + seg.durationSec;
    const bpm = masterBpm || seg.bpm || 120;
    
    if (seg.type === 'beat' && seg.steps) {
      // CLEAR AUTOMATION FOR THE ENTIRE SEGMENT DURATION
      this.masterGain!.gain.cancelScheduledValues(startTime);
      this.carrierOscA!.frequency.cancelScheduledValues(startTime);
      this.carrierOscB!.frequency.cancelScheduledValues(startTime);

      const stepDuration = 60 / bpm / 4; // 16th note
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
            
            this.carrierOscA!.frequency.setValueAtTime(freq, t);
            this.carrierOscB!.frequency.setValueAtTime(freq, t);
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
    ramp(this.carrierOscA!.frequency, startCarrierFreq, endCarrierFreq);
    ramp(this.carrierOscB!.frequency, startCarrierFreq, endCarrierFreq);
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

  public destroy(): void { this.stop(); this.carrierOscA?.stop(); this.carrierOscB?.stop(); this.modOsc?.stop(); this.input.disconnect(); this.output.disconnect(); }
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
  public setMute(ch: 'left' | 'right', muted: boolean): void { this.chains?.[ch].setMute(muted); }
  public setCarrierFrequency(ch: 'left' | 'right', f: number): void { this.params[ch].carrierFreq = f; this.chains?.[ch].setCarrierFrequency(f); }
  public setCarrierWaveform(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].carrierWaveform = w; this.chains?.[ch].setCarrierWaveform(w); }
  public setCarrierWaveformB(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].carrierWaveformB = w; this.chains?.[ch].setCarrierWaveformB(w); }
  public setCarrierMorph(ch: 'left' | 'right', m: number): void { this.params[ch].carrierMorph = m; this.chains?.[ch].setCarrierMorph(m); }
  public setCarrierPhase(ch: 'left' | 'right', p: number): void { this.params[ch].carrierPhase = p; this.chains?.[ch].setCarrierPhase(p); }
  public setModFrequency(ch: 'left' | 'right', f: number): void { this.params[ch].modFreq = f; this.chains?.[ch].setModFrequency(f); }
  public setModWaveform(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].modWaveform = w; this.chains?.[ch].setModWaveform(w); }
  public setModDepth(ch: 'left' | 'right', d: number): void { this.params[ch].modDepth = d; this.chains?.[ch].setModDepth(d); }
  public setMasterVolume(ch: 'left' | 'right', v: number): void { this.params[ch].masterVolume = v; this.chains?.[ch].setMasterVolume(v); }
  public setMode(ch: 'left' | 'right', m: SignalParameters['mode']): void { this.params[ch].mode = m; this.chains?.[ch].setMode(m); }
  public setDutyCycle(ch: 'left' | 'right', d: number): void { this.params[ch].dutyCycle = d; this.chains?.[ch].setDutyCycle(d); }
  public setBurstDuration(ch: 'left' | 'right', ms: number): void { this.params[ch].burstDurationMs = ms; this.chains?.[ch].setBurstDuration(ms); }
  public setMasterBpm(bpm: number): void { this.params.left.masterBpm = bpm; this.params.right.masterBpm = bpm; this.chains?.left.setMasterBpm(bpm); this.chains?.right.setMasterBpm(bpm); }
  public setSyncToMaster(ch: 'left' | 'right', s: boolean): void { this.params[ch].syncToMaster = s; this.chains?.[ch].setSyncToMaster(s); }
  public setLoopRange(ch: 'left' | 'right', start: number, end: number): void { this.params[ch].seqLoopStart = start; this.params[ch].seqLoopEnd = end; this.chains?.[ch].setLoopRange(start, end); }
  public updateSequencerSteps(ch: 'left' | 'right', s: SequencerStep[]): void { this.steps[ch] = [...s]; this.chains?.[ch].updateSequencerSteps(s); }
  public setOnStepCallback(ch: 'left' | 'right', cb: StepCallback | null): void { this.chains?.[ch].setOnStepCallback(cb); }
  public getLevels(ch: 'left' | 'right'): { peak: number; rms: number } { return this.chains?.[ch].getLevels() || { peak: 0, rms: 0 }; }
  public getOutputWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputWaveform(b); }
  public getOutputFrequency(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputFrequency(b); }
  public getEnvelopeWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getEnvelopeWaveform(b); }
  public getTransitionProgress(ch: 'left' | 'right'): { progress: number; type: 'none' | 'amplitude' | 'frequency' } { return this.chains?.[ch].getTransitionProgress() || { progress: 0, type: 'none' }; }
  public getIsRunning(): boolean { return this.isRunning; }
  public async scheduleProtocol(p: StimulationProtocol): Promise<void> {
    if (!this.ctx) await this.initAudio();
    this.stop();
    const now = this.ctx!.currentTime;
    (['left', 'right'] as const).forEach(ch => {
      let time = now;
      p.channels[ch].forEach(seg => { this.chains?.[ch].scheduleSegment(seg, time, p.masterBpm); time += seg.durationSec; });
    });
    this.isRunning = true;
  }
  public destroy(): void { this.chains?.left.destroy(); this.chains?.right.destroy(); this.ctx?.close(); }
}
