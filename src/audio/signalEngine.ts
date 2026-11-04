/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalParameters, SequencerStep, WaveformType, StimulationProtocol, ProtocolSegment, ModulationMode } from '../types/telemetry';

export const POP_FREE_RAMP_SEC = 0.030;
export const COLD_START_RAMP_SEC = 2.0;
export const WATCHDOG_TIMEOUT_MS = 1000;
export const SAFETY_CEILING_GAIN = 0.50;

// SYS.AI.MAYA.GITHUB — final gain clamp.
// Every gain target written to masterGain goes through safeGain(), and the last
// node of each chain is a hard limiter (WaveShaper) that clips the sample values
// at +/- SAFETY_CEILING_GAIN. Nothing upstream (sweat-sim boost, AI values, MIDI,
// protocol intensities, RMS compensation) can push the output past the cap.
const clampUnit = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
export const safeGain = (level: number, attenuation: number = 1): number => {
  const att = Number.isFinite(attenuation) ? Math.max(0, attenuation) : 1;
  return Math.min(SAFETY_CEILING_GAIN, clampUnit(level) * SAFETY_CEILING_GAIN * att);
};
const buildCeilingCurve = (): Float32Array => {
  // 4097 points over [-1, 1]; breakpoints at +/-0.5 land exactly on grid points
  // (index 1024 and 3072), so the piecewise-linear curve is exact. Inputs beyond
  // [-1, 1] are held at the end values (+/-0.5) by the WaveShaper spec.
  const n = 4097;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = -1 + (2 * i) / (n - 1);
    curve[i] = Math.max(-SAFETY_CEILING_GAIN, Math.min(SAFETY_CEILING_GAIN, x));
  }
  return curve;
};

// RMS Compensation: Sine (0.707) vs Triangle (0.577)
// Factor to bring Triangle up to Sine weight: 0.707 / 0.577 ≈ 1.2247
const getRMSFactor = (type: WaveformType) => (type === 'triangle' ? 1.2247 : 1.0);

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
  private watchdogGain: GainNode | null = null;
  private ceilingLimiter: WaveShaperNode | null = null;
  
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
  
  private lastHeartbeat: number = 0;
  private watchdogInterval: number | null = null;
  private jitterInterval: number | null = null;

  private asymmetricWave: PeriodicWave | null = null;
  public modOutput: GainNode | null = null;
  public carrierA: OscillatorNode | null = null;
  public carrierB: OscillatorNode | null = null;

  private currentImpedance: number = 1000;
  private sweatInterval: number | null = null;

  constructor(ctx: AudioContext, initialParams: SignalParameters, steps: SequencerStep[]) {
    this.ctx = ctx;
    this.params = { ...initialParams };
    this.steps = steps.map(s => ({ ...s }));
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    
    // Create Asymmetric Wave (Approximation of asymmetric biphasic pulse)
    const real = new Float32Array([0, 1, 0.5, 0.25, 0.125]);
    const imag = new Float32Array([0, 0, 0, 0, 0]);
    this.asymmetricWave = ctx.createPeriodicWave(real, imag);

    this.buildGraph();
    this.startWatchdog();
    this.startJitter();
    this.startSweatDrift();
  }

  private startSweatDrift(): void {
    this.sweatInterval = window.setInterval(() => {
      if (!this.isRunning || !this.params.simulatedSweat) return;
      
      // Random walk impedance (500 to 3000 ohms)
      const drift = (Math.random() - 0.5) * 50;
      this.currentImpedance = Math.max(500, Math.min(3000, this.currentImpedance + drift));
      
      // Affect master volume slightly as impedance changes (higher impedance = lower current)
      const attenuation = 1000 / this.currentImpedance;
      const now = this.ctx.currentTime;
      this.masterGain!.gain.setTargetAtTime(safeGain(this.params.masterVolume, attenuation), now, 0.5);
    }, 1000);
  }

  private startJitter(): void {
    this.jitterInterval = window.setInterval(() => {
      if (!this.isRunning || this.params.jitterAmount <= 0) return;
      
      const now = this.ctx.currentTime;
      const amount = this.params.jitterAmount;
      
      // Jitter Frequency (up to 2% drift)
      const freqOffset = (Math.random() - 0.5) * 0.04 * amount * this.params.carrierFreq;
      this.carrierOscA!.frequency.linearRampToValueAtTime(this.params.carrierFreq + freqOffset, now + 0.1);
      this.carrierOscB!.frequency.linearRampToValueAtTime(this.params.carrierFreq + freqOffset, now + 0.1);
      
      // Jitter Depth (up to 5% drift)
      const depthOffset = (Math.random() - 0.5) * 0.1 * amount;
      const targetDepth = Math.max(0, Math.min(1, this.params.modDepth + depthOffset));
      this.modGain!.gain.linearRampToValueAtTime(targetDepth * 0.5, now + 0.1);
    }, 150);
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

    this.watchdogGain = this.ctx.createGain();
    this.watchdogGain.gain.setValueAtTime(0.0001, now);

    this.ceilingLimiter = this.ctx.createWaveShaper();
    this.ceilingLimiter.curve = buildCeilingCurve() as unknown as Float32Array<ArrayBuffer>;
    this.ceilingLimiter.oversample = 'none';

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
    this.carrierA = this.carrierOscA;
    this.applyWaveform(this.carrierOscA, this.params.carrierWaveform);
    this.carrierOscA.frequency.setValueAtTime(this.params.carrierFreq, now);
    this.carrierGainA = this.ctx.createGain();
    
    // RMS Normalized Gain A
    const rmsA = getRMSFactor(this.params.carrierWaveform);
    const gainA = (1.0 - this.params.carrierMorph) * rmsA;
    this.carrierGainA.gain.setValueAtTime(gainA, now);
    
    // Carrier B
    this.carrierOscB = this.ctx.createOscillator();
    this.carrierB = this.carrierOscB;
    this.applyWaveform(this.carrierOscB, this.params.carrierWaveformB);
    this.carrierOscB.frequency.setValueAtTime(this.params.carrierFreq, now);
    this.carrierGainB = this.ctx.createGain();
    
    // RMS Normalized Gain B
    const rmsB = getRMSFactor(this.params.carrierWaveformB);
    const gainB = this.params.carrierMorph * rmsB;
    this.carrierGainB.gain.setValueAtTime(gainB, now);

    this.modOsc = this.ctx.createOscillator();
    this.applyWaveform(this.modOsc, this.params.modWaveform);
    this.modOsc.frequency.setValueAtTime(this.params.modFreq, now);
    this.modGain = this.ctx.createGain();
    this.modOutput = this.modGain;
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
    
    // STRICT LINEAR ROUTING: vca -> master -> mute -> watchdog -> ceilingLimiter -> analyser -> output
    this.vcaGain.connect(this.masterGain);
    this.masterGain.connect(this.muteGain);
    this.muteGain.connect(this.watchdogGain);
    this.watchdogGain.connect(this.ceilingLimiter);
    this.ceilingLimiter.connect(this.analyser);
    this.analyser.connect(this.output);
    
    this.carrierOscA.start(now);
    this.carrierOscB.start(now);
    this.modOsc.start(now);
    this.modOffset.start(now);
  }

  private applyWaveform(osc: OscillatorNode, wave: WaveformType): void {
    if (wave === 'asymmetric') {
      osc.setPeriodicWave(this.asymmetricWave!);
    } else {
      osc.type = wave as OscillatorType;
    }
  }

  private startWatchdog(): void {
    this.lastHeartbeat = Date.now();
    this.watchdogInterval = window.setInterval(() => {
      const elapsed = Date.now() - this.lastHeartbeat;
      if (elapsed > WATCHDOG_TIMEOUT_MS && this.isRunning) {
        console.error("WATCHDOG TIMEOUT: Audio killed due to thread freeze.");
        this.emergencyStop();
      }
    }, 200);
  }

  public heartbeat(): void {
    this.lastHeartbeat = Date.now();
  }

  private emergencyStop(): void {
    if (!this.watchdogGain) return;
    const now = this.ctx.currentTime;
    this.watchdogGain.gain.cancelScheduledValues(now);
    this.watchdogGain.gain.setValueAtTime(this.watchdogGain.gain.value, now);
    this.watchdogGain.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);
    this.stopClock();
    this.isRunning = false;
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
    this.watchdogGain!.gain.cancelScheduledValues(now);
    this.carrierOscA!.frequency.cancelScheduledValues(now);
    this.carrierOscB!.frequency.cancelScheduledValues(now);
    this.modOsc!.frequency.cancelScheduledValues(now);
    this.modGain!.gain.cancelScheduledValues(now);
    this.modOffset!.offset.cancelScheduledValues(now);
    this.sequencerGain!.gain.cancelScheduledValues(now);
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
  }

  /**
   * Resets every audio node and parameter strictly to this.params values.
   * Cancels all scheduled values, clears clocks, and anchors all AudioParams.
   */
  public resetToParams(params?: SignalParameters): void {
    if (params) {
      this.params = { ...params };
    }
    this.stopClock();
    this.cancelAutomation();
    const now = this.ctx.currentTime;

    if (this.carrierOscA && this.carrierOscB) {
      this.carrierOscA.frequency.setValueAtTime(this.params.carrierFreq, now);
      this.carrierOscB.frequency.setValueAtTime(this.params.carrierFreq, now);
      this.applyWaveform(this.carrierOscA, this.params.carrierWaveform);
      this.applyWaveform(this.carrierOscB, this.params.carrierWaveformB);
    }

    if (this.carrierGainA && this.carrierGainB) {
      const rmsA = getRMSFactor(this.params.carrierWaveform);
      const rmsB = getRMSFactor(this.params.carrierWaveformB);
      this.carrierGainA.gain.setValueAtTime((1.0 - this.params.carrierMorph) * rmsA, now);
      this.carrierGainB.gain.setValueAtTime(this.params.carrierMorph * rmsB, now);
    }

    if (this.phaseDelay) {
      const delay = (this.params.carrierPhase / 360) * (1 / Math.max(1, this.params.carrierFreq));
      this.phaseDelay.delayTime.setValueAtTime(delay, now);
    }

    if (this.modOsc) {
      this.modOsc.frequency.setValueAtTime(this.params.modFreq, now);
      this.applyWaveform(this.modOsc, this.params.modWaveform);
    }

    if (this.modGain && this.modOffset) {
      this.modGain.gain.setValueAtTime(this.params.modDepth * 0.5, now);
      this.modOffset.offset.setValueAtTime(1.0 - (this.params.modDepth * 0.5), now);
    }

    if (this.sequencerGain) {
      this.sequencerGain.gain.setValueAtTime(this.params.mode === 'sequenced' ? 0.0001 : 1.0, now);
    }

    if (this.muteGain) {
      this.muteGain.gain.setValueAtTime(this.isMuted ? 0.0001 : 1.0, now);
    }

    if (this.masterGain && this.watchdogGain) {
      if (!this.isRunning) {
        this.masterGain.gain.setValueAtTime(0.0001, now);
        this.watchdogGain.gain.setValueAtTime(0.0001, now);
      } else {
        const attenuation = 1000 / this.currentImpedance;
        this.masterGain.gain.setValueAtTime(safeGain(this.params.masterVolume, attenuation), now);
        this.watchdogGain.gain.setValueAtTime(1.0, now);
        if (this.params.mode === 'sequenced' || this.params.mode === 'burst' || this.params.mode === 'sweep') {
          this.startClock();
        }
      }
    }
  }

  public start(): void {
    this.resetToParams();
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');

    // Cold Start Safety: 2 second ramp from silence (0.0001) to 1.0
    this.watchdogGain!.gain.setValueAtTime(0.0001, now);
    this.watchdogGain!.gain.linearRampToValueAtTime(1.0, now + COLD_START_RAMP_SEC);

    const attenuation = 1000 / this.currentImpedance;
    this.masterGain!.gain.setValueAtTime(0.0001, now);
    this.masterGain!.gain.linearRampToValueAtTime(safeGain(this.params.masterVolume, attenuation), now + POP_FREE_RAMP_SEC);

    this.muteGain!.gain.setValueAtTime(this.isMuted ? 0.0001 : 1.0, now);

    this.isRunning = true;
    this.lastHeartbeat = Date.now();
    if (this.params.mode === 'sequenced' || this.params.mode === 'burst' || this.params.mode === 'sweep') {
      this.startClock();
    }
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.cancelAutomation();
    this.stopClock();

    const currentWatchdog = this.watchdogGain ? this.watchdogGain.gain.value : 1.0;
    const currentMaster = this.masterGain ? this.masterGain.gain.value : 0.5;

    this.watchdogGain!.gain.setValueAtTime(currentWatchdog, now);
    this.watchdogGain!.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);

    this.masterGain!.gain.setValueAtTime(currentMaster, now);
    this.masterGain!.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);

    this.isRunning = false;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.muteGain!.gain.cancelScheduledValues(now);
    this.muteGain!.gain.setValueAtTime(this.muteGain!.gain.value, now);
    this.muteGain!.gain.linearRampToValueAtTime(muted ? 0.0001 : 1.0, now + POP_FREE_RAMP_SEC);
  }

  public setCarrierFrequency(freq: number): void {
    this.params.carrierFreq = freq;
    const now = this.ctx.currentTime;
    this.trackTransition('frequency');
    this.carrierOscA!.frequency.cancelScheduledValues(now);
    this.carrierOscA!.frequency.setValueAtTime(this.carrierOscA!.frequency.value, now);
    this.carrierOscA!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
    
    this.carrierOscB!.frequency.cancelScheduledValues(now);
    this.carrierOscB!.frequency.setValueAtTime(this.carrierOscB!.frequency.value, now);
    this.carrierOscB!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
    
    // Maintain phase shift delay
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
    this.phaseDelay!.delayTime.setValueAtTime(this.phaseDelay!.delayTime.value, now);
    const delay = (this.params.carrierPhase / 360) * (1 / Math.max(1, freq));
    this.phaseDelay!.delayTime.linearRampToValueAtTime(delay, now + POP_FREE_RAMP_SEC);
  }

  public setCarrierWaveform(wave: WaveformType): void { 
    this.params.carrierWaveform = wave; 
    this.applyWaveform(this.carrierOscA!, wave);
    this.setCarrierMorph(this.params.carrierMorph); // Recalculate RMS
  }
  
  public setCarrierWaveformB(wave: WaveformType): void { 
    this.params.carrierWaveformB = wave; 
    this.applyWaveform(this.carrierOscB!, wave);
    this.setCarrierMorph(this.params.carrierMorph); // Recalculate RMS
  }
  
  public setJitterAmount(amount: number): void {
    this.params.jitterAmount = amount;
  }
  
  public setSimulatedSweat(enabled: boolean): void {
    this.params.simulatedSweat = enabled;
  }
  
  public setCarrierMorph(morph: number): void {
    this.params.carrierMorph = morph;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    
    // RMS Normalized Gain A
    const rmsA = getRMSFactor(this.params.carrierWaveform);
    const targetA = (1.0 - morph) * rmsA;
    this.carrierGainA!.gain.cancelScheduledValues(now);
    this.carrierGainA!.gain.setValueAtTime(this.carrierGainA!.gain.value, now);
    this.carrierGainA!.gain.linearRampToValueAtTime(targetA, now + POP_FREE_RAMP_SEC);
    
    // RMS Normalized Gain B
    const rmsB = getRMSFactor(this.params.carrierWaveformB);
    const targetB = morph * rmsB;
    this.carrierGainB!.gain.cancelScheduledValues(now);
    this.carrierGainB!.gain.setValueAtTime(this.carrierGainB!.gain.value, now);
    this.carrierGainB!.gain.linearRampToValueAtTime(targetB, now + POP_FREE_RAMP_SEC);
  }
  
  public setCarrierPhase(phase: number): void {
    this.params.carrierPhase = phase;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude'); 
    this.phaseDelay!.delayTime.cancelScheduledValues(now);
    this.phaseDelay!.delayTime.setValueAtTime(this.phaseDelay!.delayTime.value, now);
    const delay = (phase / 360) * (1 / Math.max(1, this.params.carrierFreq));
    this.phaseDelay!.delayTime.linearRampToValueAtTime(delay, now + POP_FREE_RAMP_SEC);
  }
  
  public setModFrequency(freq: number): void {
    this.params.modFreq = freq;
    const now = this.ctx.currentTime;
    this.trackTransition('frequency');
    this.modOsc!.frequency.cancelScheduledValues(now);
    this.modOsc!.frequency.setValueAtTime(this.modOsc!.frequency.value, now);
    this.modOsc!.frequency.linearRampToValueAtTime(freq, now + POP_FREE_RAMP_SEC);
  }
  
  public setModWaveform(wave: WaveformType): void { 
    this.params.modWaveform = wave; 
    this.applyWaveform(this.modOsc!, wave);
  }
  
  public setModDepth(depth: number): void {
    this.params.modDepth = depth;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.modGain!.gain.cancelScheduledValues(now);
    this.modGain!.gain.setValueAtTime(this.modGain!.gain.value, now);
    this.modGain!.gain.linearRampToValueAtTime(depth * 0.5, now + POP_FREE_RAMP_SEC);
    
    this.modOffset!.offset.cancelScheduledValues(now);
    this.modOffset!.offset.setValueAtTime(this.modOffset!.offset.value, now);
    this.modOffset!.offset.linearRampToValueAtTime(1.0 - (depth * 0.5), now + POP_FREE_RAMP_SEC);
  }
  
  public setMasterVolume(vol: number): void {
    this.params.masterVolume = vol;
    if (!this.isRunning) return;
    const now = this.ctx.currentTime;
    this.trackTransition('amplitude');
    this.masterGain!.gain.cancelScheduledValues(now);
    this.masterGain!.gain.setValueAtTime(this.masterGain!.gain.value, now);
    const attenuation = 1000 / this.currentImpedance;
    this.masterGain!.gain.linearRampToValueAtTime(safeGain(vol, attenuation), now + POP_FREE_RAMP_SEC);
  }
  
  public setMode(mode: ModulationMode): void { 
    this.params.mode = mode; 
    if (this.isRunning) { 
      if (mode === 'sequenced' || mode === 'burst' || mode === 'sweep') {
        this.startClock();
      } else { 
        this.stopClock();
        const now = this.ctx.currentTime;
        this.sequencerGain!.gain.cancelScheduledValues(now);
        this.sequencerGain!.gain.linearRampToValueAtTime(1.0, now + POP_FREE_RAMP_SEC);
      } 
    } 
  }
  
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
        this.sequencerGain!.gain.setValueAtTime(this.sequencerGain!.gain.value, now);
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

  private stopClock(): void { 
    if (this.seqTimerId !== null) { 
      clearTimeout(this.seqTimerId); 
      this.seqTimerId = null; 
    } 
  }

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
            this.masterGain!.gain.linearRampToValueAtTime(safeGain(amp), t + 0.005);
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

    ramp(this.masterGain!.gain, Math.max(0.0001, safeGain(startIntensity)), Math.max(0.0001, safeGain(endIntensity)));
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

  public getRecruitment(): { aBeta: number; aDelta: number; cFiber: number } {
    if (!this.isRunning) return { aBeta: 0, aDelta: 0, cFiber: 0 };
    const freq = this.params.modFreq;
    const intensity = this.params.masterVolume;
    
    let aBeta = 0, aDelta = 0, cFiber = 0;
    
    // A-beta: 80-150Hz modulation
    if (freq >= 60 && freq <= 180) {
      aBeta = intensity * (1 - Math.abs(freq - 100) / 80);
    } else if (freq > 180) {
      aBeta = intensity * 0.2;
    }
    
    // A-delta: 2-30Hz modulation
    if (freq >= 1 && freq <= 40) {
      aDelta = intensity * (1 - Math.abs(freq - 10) / 30);
    }
    
    // C-fiber: Very high intensity or specific patterns (e.g. very low freq)
    if (intensity > 0.8 || freq < 1) {
      cFiber = intensity > 0.8 ? (intensity - 0.8) * 5 : intensity * 0.5;
    }
    
    return { 
      aBeta: Math.max(0, Math.min(1, aBeta)), 
      aDelta: Math.max(0, Math.min(1, aDelta)), 
      cFiber: Math.max(0, Math.min(1, cFiber)) 
    };
  }

  public getCurrentImpedance(): number { return this.currentImpedance; }

  public destroy(): void { 
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.jitterInterval) clearInterval(this.jitterInterval);
    if (this.sweatInterval) clearInterval(this.sweatInterval);
    this.stopClock();
    this.stop(); 
    
    try { this.carrierOscA?.stop(); } catch (e) {}
    try { this.carrierOscB?.stop(); } catch (e) {}
    try { this.modOsc?.stop(); } catch (e) {}
    try { this.modOffset?.stop(); } catch (e) {}
    
    this.carrierOscA?.disconnect();
    this.carrierOscB?.disconnect();
    this.carrierGainA?.disconnect();
    this.carrierGainB?.disconnect();
    this.phaseDelay?.disconnect();
    this.sequencerGain?.disconnect();
    this.vcaGain?.disconnect();
    this.modOsc?.disconnect();
    this.modGain?.disconnect();
    this.modOffset?.disconnect();
    this.masterGain?.disconnect();
    this.muteGain?.disconnect();
    this.watchdogGain?.disconnect();
    this.ceilingLimiter?.disconnect();
    this.analyser?.disconnect();
    this.envAnalyser?.disconnect();
    this.input.disconnect(); 
    this.output.disconnect(); 
  }
}

export class SignalEngine {
  private ctx: AudioContext | null = null;
  private merger: ChannelMergerNode | null = null;
  private isRunning: boolean = false;
  private chains: { left: SignalChain; right: SignalChain } | null = null;
  private params: { left: SignalParameters; right: SignalParameters };
  private steps: { left: SequencerStep[]; right: SequencerStep[] };
  private onStepCallbacks: { left: StepCallback | null; right: StepCallback | null } = { left: null, right: null };
  
  private crossFMConnection: GainNode | null = null;

  constructor(params: { left: SignalParameters; right: SignalParameters }, steps: { left: SequencerStep[]; right: SequencerStep[] }) {
    this.params = { left: { ...params.left }, right: { ...params.right } };
    this.steps = { left: [...steps.left], right: [...steps.right] };
  }

  public async initAudio(): Promise<boolean> {
    if (this.ctx && this.ctx.state !== 'closed') return true;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return false;
    this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    this.merger = this.ctx.createChannelMerger(2);
    this.merger.connect(this.ctx.destination);
    
    await this.mountPatch(this.params, this.steps, false);
    return true;
  }

  /**
   * Completely unmounts and silences any current audio nodes, oscillators,
   * intervals, and scheduled automations. Enforces: ONE PATCH AT A TIME.
   */
  public unmountCurrentPatch(): void {
    if (this.chains) {
      this.chains.left.destroy();
      this.chains.right.destroy();
      this.chains = null;
    }
    if (this.crossFMConnection) {
      try { this.crossFMConnection.disconnect(); } catch (e) {}
      this.crossFMConnection = null;
    }
    this.isRunning = false;
  }

  /**
   * Unmounts the previous patch and mounts a fresh, pristine signal chain.
   */
  public async mountPatch(
    params?: { left: SignalParameters; right: SignalParameters }, 
    steps?: { left: SequencerStep[]; right: SequencerStep[] }, 
    startImmediately: boolean = false
  ): Promise<void> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.merger = this.ctx.createChannelMerger(2);
      this.merger.connect(this.ctx.destination);
    } else {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.unmountCurrentPatch();
    }

    if (params) {
      this.params = { left: { ...params.left }, right: { ...params.right } };
    }
    if (steps) {
      this.steps = { left: [...steps.left], right: [...steps.right] };
    }

    if (!this.merger && this.ctx) {
      this.merger = this.ctx.createChannelMerger(2);
      this.merger.connect(this.ctx.destination);
    }

    this.chains = { 
      left: new SignalChain(this.ctx!, this.params.left, this.steps.left), 
      right: new SignalChain(this.ctx!, this.params.right, this.steps.right) 
    };
    
    this.chains.left.output.connect(this.merger!, 0, 0);
    this.chains.right.output.connect(this.merger!, 0, 1);

    if (this.onStepCallbacks.left) this.chains.left.setOnStepCallback(this.onStepCallbacks.left);
    if (this.onStepCallbacks.right) this.chains.right.setOnStepCallback(this.onStepCallbacks.right);

    // Cross-FM connection
    this.crossFMConnection = this.ctx!.createGain();
    const now = this.ctx!.currentTime;
    const fmGain = (this.params.left.crossChannelFM || this.params.right.crossChannelFM) ? 200 : 0;
    this.crossFMConnection.gain.setValueAtTime(fmGain, now);
    this.chains.left.modOutput!.connect(this.crossFMConnection);
    this.crossFMConnection.connect(this.chains.right.carrierA!.frequency);
    this.crossFMConnection.connect(this.chains.right.carrierB!.frequency);

    if (startImmediately) {
      this.chains.left.start();
      this.chains.right.start();
      this.isRunning = true;
    }
  }

  public heartbeat(): void {
    this.chains?.left.heartbeat();
    this.chains?.right.heartbeat();
  }

  public async start(): Promise<void> { 
    if (!this.ctx || !this.chains) {
      await this.initAudio();
    }
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    this.chains?.left.start(); 
    this.chains?.right.start(); 
    this.isRunning = true; 
  }
  
  public stop(): void { 
    this.chains?.left.stop(); 
    this.chains?.right.stop(); 
    this.isRunning = false; 
  }
  
  public setMute(ch: 'left' | 'right', muted: boolean): void { this.chains?.[ch].setMute(muted); }
  public setCarrierFrequency(ch: 'left' | 'right', f: number): void { this.params[ch].carrierFreq = f; this.chains?.[ch].setCarrierFrequency(f); }
  public setCarrierWaveform(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].carrierWaveform = w; this.chains?.[ch].setCarrierWaveform(w); }
  public setCarrierWaveformB(ch: 'left' | 'right', w: WaveformType): void { this.params[ch].carrierWaveformB = w; this.chains?.[ch].setCarrierWaveformB(w); }
  public setCarrierMorph(ch: 'left' | 'right', m: number): void { this.params[ch].carrierMorph = m; this.chains?.[ch].setCarrierMorph(m); }
  public setCarrierPhase(ch: 'left' | 'right', p: number): void { this.params[ch].carrierPhase = p; this.chains?.[ch].setCarrierPhase(p); }
  public setJitterAmount(ch: 'left' | 'right', a: number): void { this.params[ch].jitterAmount = a; this.chains?.[ch].setJitterAmount(a); }
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
  
  public updateSequencerSteps(ch: 'left' | 'right', s: SequencerStep[]): void { 
    this.steps[ch] = [...s]; 
    this.chains?.[ch].updateSequencerSteps(s); 
  }
  
  public setOnStepCallback(ch: 'left' | 'right', cb: StepCallback | null): void { 
    this.onStepCallbacks[ch] = cb;
    this.chains?.[ch].setOnStepCallback(cb); 
  }
  
  public setCrossChannelFM(enabled: boolean): void {
    this.params.left.crossChannelFM = enabled;
    this.params.right.crossChannelFM = enabled;
    if (!this.crossFMConnection || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Connect Ch1 Modulator to Ch2 Carrier Frequency
    // Amount: +/- 200Hz frequency shift
    this.crossFMConnection.gain.linearRampToValueAtTime(enabled ? 200 : 0, now + POP_FREE_RAMP_SEC);
  }

  public setSimulatedSweat(enabled: boolean): void {
    this.params.left.simulatedSweat = enabled;
    this.params.right.simulatedSweat = enabled;
    this.chains?.left.setSimulatedSweat(enabled);
    this.chains?.right.setSimulatedSweat(enabled);
  }

  public getLevels(ch: 'left' | 'right'): { peak: number; rms: number } { return this.chains?.[ch].getLevels() || { peak: 0, rms: 0 }; }
  public getRecruitment(ch: 'left' | 'right'): { aBeta: number; aDelta: number; cFiber: number } { return this.chains?.[ch].getRecruitment() || { aBeta: 0, aDelta: 0, cFiber: 0 }; }
  public getCurrentImpedance(ch: 'left' | 'right'): number { return this.chains?.[ch].getCurrentImpedance() || 1000; }
  
  public getOutputWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputWaveform(b); }
  public getOutputFrequency(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getOutputFrequency(b); }
  public getEnvelopeWaveform(ch: 'left' | 'right', b: Float32Array): void { this.chains?.[ch].getEnvelopeWaveform(b); }
  public getTransitionProgress(ch: 'left' | 'right'): { progress: number; type: 'none' | 'amplitude' | 'frequency' } { return this.chains?.[ch].getTransitionProgress() || { progress: 0, type: 'none' }; }
  public getIsRunning(): boolean { return this.isRunning; }

  /**
   * Schedules a multi-segment timeline protocol. Unmounts previous audio graph,
   * creates clean chains, and schedules segments strictly.
   */
  public async scheduleProtocol(p: StimulationProtocol): Promise<void> {
    await this.mountPatch(undefined, undefined, false);
    if (!this.ctx || !this.chains) return;
    const now = this.ctx.currentTime;
    
    // Warm up the chains with volume open
    this.chains.left.start();
    this.chains.right.start();
    
    (['left', 'right'] as const).forEach(ch => {
      let time = now;
      p.channels[ch].forEach(seg => { 
        this.chains?.[ch].scheduleSegment(seg, time, p.masterBpm); 
        time += seg.durationSec; 
      });
    });
    this.isRunning = true;
  }

  public destroy(): void { 
    this.unmountCurrentPatch();
    this.merger?.disconnect();
    this.ctx?.close(); 
  }
}
