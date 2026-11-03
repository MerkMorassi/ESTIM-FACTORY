/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SIGNAL TELEMETRY PROFILER // E-Stim Simulation Audio Workbench
 * Precision Web Audio API low-level dual-layer signal architecture.
 * Strictly enforces 30ms linear/exponential pop-free ramping across envelope transitions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  SignalParameters,
  SequencerStep,
  ImpedanceModel,
  WaveformType,
  ModulationMode,
  TelemetryPreset,
  DualChannelPreset,
} from './types/telemetry';
import { SignalEngine, POP_FREE_RAMP_SEC } from './audio/signalEngine';
import { Oscilloscope } from './components/Oscilloscope';
import { SpectrumAnalyzer } from './components/SpectrumAnalyzer';
import { ImpedanceProfiler } from './components/ImpedanceProfiler';
import { PulseSequencer } from './components/PulseSequencer';
import { PresetSelector } from './components/PresetSelector';
import { VanillaModuleInspector } from './components/VanillaModuleInspector';
import { HardwareDashboard } from './components/HardwareDashboard';
import { AyurvedicHarmonics } from './components/AyurvedicHarmonics';
import { Composer } from './components/Composer';
import { Player } from './components/Player';
import {
  Power,
  Volume2,
  VolumeX,
  Download,
  FileText,
  ShieldAlert,
  SlidersHorizontal,
  Waves,
  Zap,
  Terminal,
  Speaker,
  Split,
  ChevronRight,
  Monitor,
  Music,
  PlayCircle,
} from 'lucide-react';

const DEFAULT_PARAMS: SignalParameters = {
  carrierFreq: 100,
  carrierWaveform: 'sine',
  modFreq: 10,
  modWaveform: 'sine',
  modDepth: 0.5,
  dutyCycle: 0.5,
  burstDurationMs: 50,
  syncClickEnabled: false,
  syncClickVol: 0.3,
  sweepStartFreq: 1000,
  sweepEndFreq: 3500,
  sweepPeriodSec: 4.0,
  masterVolume: 0.5,
  mode: 'continuous',
};

const DEFAULT_STEPS: SequencerStep[] = [
  { active: true, amplitude: 1.0, dutyCycle: 0.5 },
  { active: true, amplitude: 0.8, dutyCycle: 0.5 },
  { active: true, amplitude: 0.6, dutyCycle: 0.5 },
  { active: true, amplitude: 0.4, dutyCycle: 0.5 },
  { active: true, amplitude: 1.0, dutyCycle: 0.5 },
  { active: true, amplitude: 0.8, dutyCycle: 0.5 },
  { active: true, amplitude: 0.6, dutyCycle: 0.5 },
  { active: true, amplitude: 0.2, dutyCycle: 0.5 },
];

export default function App() {
  const [params, setParams] = useState<{ left: SignalParameters; right: SignalParameters }>({
    left: { ...DEFAULT_PARAMS, carrierFreq: 2500, masterVolume: 0.7 },
    right: { ...DEFAULT_PARAMS, carrierFreq: 100, masterVolume: 0.7 },
  });
  const [steps, setSteps] = useState<{ left: SequencerStep[]; right: SequencerStep[] }>({
    left: DEFAULT_STEPS.map(s => ({ ...s })),
    right: DEFAULT_STEPS.map(s => ({ ...s })),
  });
  const [impedanceModel, setImpedanceModel] = useState<ImpedanceModel>({
    nominalResistance: 800,
    capacitanceNf: 33,
    electrodeAreaCm2: 4.0,
  });
  
  const [activeChannel, setActiveChannel] = useState<'left' | 'right'>('left');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'profiler' | 'sequencer' | 'spectrum' | 'standalone_module' | 'ayurvedic' | 'composer' | 'player'>('player');
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);

  const engineRef = useRef<SignalEngine | null>(null);

  useEffect(() => {
    const engine = new SignalEngine(params, steps);
    engine.setOnStepCallback('left', (step) => setCurrentStep(prev => ({ ...prev, left: step })));
    engine.setOnStepCallback('right', (step) => setCurrentStep(prev => ({ ...prev, right: step })));
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const togglePower = async () => {
    if (!engineRef.current) return;
    if (isRunning) {
      engineRef.current.stop();
      setIsRunning(false);
    } else {
      await engineRef.current.start();
      setIsRunning(true);
    }
  };

  const handleParamChange = (channel: 'left' | 'right', key: keyof SignalParameters, value: any) => {
    setParams(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [key]: value }
    }));
    setActivePresetId(null);
  };

  const dispatchCarrierFreq = (channel: 'left' | 'right', freq: number) => {
    handleParamChange(channel, 'carrierFreq', freq);
    engineRef.current?.setCarrierFrequency(channel, freq);
  };

  const dispatchCarrierWave = (channel: 'left' | 'right', wave: WaveformType) => {
    handleParamChange(channel, 'carrierWaveform', wave);
    engineRef.current?.setCarrierWaveform(channel, wave);
  };

  const dispatchModFreq = (channel: 'left' | 'right', freq: number) => {
    handleParamChange(channel, 'modFreq', freq);
    engineRef.current?.setModFrequency(channel, freq);
  };

  const dispatchModWave = (channel: 'left' | 'right', wave: WaveformType) => {
    handleParamChange(channel, 'modWaveform', wave);
    engineRef.current?.setModWaveform(channel, wave);
  };

  const dispatchModDepth = (channel: 'left' | 'right', depth: number) => {
    handleParamChange(channel, 'modDepth', depth);
    engineRef.current?.setModDepth(channel, depth);
  };

  const dispatchMasterVolume = (channel: 'left' | 'right', vol: number) => {
    handleParamChange(channel, 'masterVolume', vol);
    engineRef.current?.setMasterVolume(channel, vol);
  };

  const dispatchMode = (channel: 'left' | 'right', mode: ModulationMode) => {
    handleParamChange(channel, 'mode', mode);
    engineRef.current?.setMode(channel, mode);
  };

  const dispatchBurstDuration = (channel: 'left' | 'right', ms: number) => {
    handleParamChange(channel, 'burstDurationMs', ms);
    engineRef.current?.setBurstDuration(channel, ms);
  };

  const dispatchStepsUpdate = (channel: 'left' | 'right', newSteps: SequencerStep[]) => {
    setSteps(prev => ({ ...prev, [channel]: newSteps }));
    engineRef.current?.updateSequencerSteps(channel, newSteps);
  };

  const handleSelectPreset = (preset: TelemetryPreset) => {
    setActivePresetId(preset.id);
    const channel = activeChannel;
    const updated = {
      ...params[channel],
      carrierFreq: preset.carrierFreq,
      carrierWaveform: preset.carrierWave,
      modFreq: preset.modFreq,
      modWaveform: preset.modWave,
      modDepth: preset.modDepth,
      mode: preset.mode,
      dutyCycle: preset.dutyCycle,
      burstDurationMs: preset.burstDurationMs,
    };
    
    setParams(prev => ({ ...prev, [channel]: updated }));
    
    if (engineRef.current) {
      engineRef.current.setCarrierFrequency(channel, preset.carrierFreq);
      engineRef.current.setCarrierWaveform(channel, preset.carrierWave);
      engineRef.current.setModFrequency(channel, preset.modFreq);
      engineRef.current.setModWaveform(channel, preset.modWave);
      engineRef.current.setModDepth(channel, preset.modDepth);
      engineRef.current.setMode(channel, preset.mode);
      engineRef.current.setBurstDuration(channel, preset.burstDurationMs);
      engineRef.current.setDutyCycle(channel, preset.dutyCycle);
    }
  };

  const handleSelectDualPreset = (preset: DualChannelPreset) => {
    setActivePresetId(preset.id);
    setParams({
      left: { ...params.left, ...preset.left, carrierWaveform: preset.left.carrierWave, modWaveform: preset.left.modWave },
      right: { ...params.right, ...preset.right, carrierWaveform: preset.right.carrierWave, modWaveform: preset.right.modWave },
    });

    if (engineRef.current) {
      (['left', 'right'] as const).forEach(ch => {
        const p = preset[ch];
        engineRef.current!.setCarrierFrequency(ch, p.carrierFreq);
        engineRef.current!.setCarrierWaveform(ch, p.carrierWave);
        engineRef.current!.setModFrequency(ch, p.modFreq);
        engineRef.current!.setModWaveform(ch, p.modWave);
        engineRef.current!.setModDepth(ch, p.modDepth);
        engineRef.current!.setMode(ch, p.mode);
        engineRef.current!.setBurstDuration(ch, p.burstDurationMs);
        engineRef.current!.setDutyCycle(ch, p.dutyCycle);
      });
    }
  };

  const handleSpeakerTest = async () => {
    if (!engineRef.current || isTestingAudio) return;
    setIsTestingAudio(true);
    await engineRef.current.initAudio();
    
    const originalLeft = { freq: params.left.carrierFreq, vol: params.left.masterVolume };
    const originalRight = { freq: params.right.carrierFreq, vol: params.right.masterVolume };
    
    engineRef.current.setCarrierFrequency('left', 3000);
    engineRef.current.setMasterVolume('left', 0.3);
    engineRef.current.setCarrierFrequency('right', 3500);
    engineRef.current.setMasterVolume('right', 0.3);
    
    await engineRef.current.start();
    setTimeout(() => {
      engineRef.current?.stop();
      engineRef.current?.setCarrierFrequency('left', originalLeft.freq);
      engineRef.current?.setMasterVolume('left', originalLeft.vol);
      engineRef.current?.setCarrierFrequency('right', originalRight.freq);
      engineRef.current?.setMasterVolume('right', originalRight.vol);
      setIsTestingAudio(false);
      setIsRunning(false);
    }, 600);
  };

  const currentParams = params[activeChannel];

  return (
    <div className="min-h-screen bg-[#070b0f] text-slate-200 font-mono flex flex-col selection:bg-cyan-900 selection:text-cyan-200">
      {/* Top Header */}
      <header className="bg-[#0b1016] border-b border-[#1a2634] px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-pulse" />
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 flex items-center gap-2 uppercase">
              Stereo Telemetry Profiler
              <span className="text-[10px] text-cyan-400 font-normal">v2.0 // Dual-Stim Enabled</span>
            </h1>
            <div className="text-[10px] text-slate-500">
              Independent L/R Channel Control · Precision Signal Modeling
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Channel Selector */}
          <div className="flex p-1 bg-[#101720] border border-[#1a2634] rounded-lg">
            <button
              onClick={() => setActiveChannel('left')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${activeChannel === 'left' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              CHANNEL 1 (L)
            </button>
            <button
              onClick={() => setActiveChannel('right')}
              className={`px-3 py-1 text-[10px] font-bold rounded transition-all ${activeChannel === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              CHANNEL 2 (R)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSpeakerTest}
              disabled={isTestingAudio}
              className={`flex items-center gap-2 px-3 py-1.5 rounded font-bold text-[10px] border ${isTestingAudio ? 'bg-cyan-900 text-cyan-300 border-cyan-700 animate-pulse' : 'bg-[#15202c] text-slate-400 border-[#23384f] hover:text-cyan-300'}`}
            >
              <Speaker className="w-3.5 h-3.5" />
              VERIFY OUTPUT
            </button>

            <button
              onClick={togglePower}
              className={`flex items-center gap-2 px-4 py-1.5 rounded font-bold text-xs tracking-wider transition-all shadow-md ${isRunning ? 'bg-rose-950 text-rose-300 border border-rose-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}`}
            >
              <Power className="w-4 h-4" />
              {isRunning ? 'DISARM' : 'ARM'}
            </button>
          </div>
        </div>
      </header>

      {/* Safety Notice */}
      <div className="bg-[#12080a] border-b border-[#3b1219] px-4 py-1.5 text-[11px] flex items-center justify-between text-rose-300">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span><strong>CLINICAL SIMULATION ONLY:</strong> High-voltage leads isolation active. 30ms ramp invariants enforced.</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
          <Split className="w-3 h-3" />
          <span>STEREO PHASE COHERENCE ACTIVE</span>
        </div>
      </div>

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-[1600px] w-full mx-auto">
        <PresetSelector
          activePresetId={activePresetId}
          onSelectPreset={handleSelectPreset}
          onSelectDualPreset={handleSelectDualPreset}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Controls */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* ACTIVE CHANNEL STATUS */}
            <div className={`p-2 rounded-t-lg border-x border-t font-black text-[10px] flex items-center justify-between ${activeChannel === 'left' ? 'bg-cyan-950/30 border-cyan-800 text-cyan-400' : 'bg-emerald-950/30 border-emerald-800 text-emerald-400'}`}>
              <div className="flex items-center gap-2 uppercase tracking-widest">
                <ChevronRight className="w-3 h-3" />
                Editing: Channel {activeChannel === 'left' ? '1 (Left)' : '2 (Right)'}
              </div>
              <Monitor className="w-3.5 h-3.5" />
            </div>

            <div className={`bg-[#0b1016] border border-[#1e293b] rounded-b-lg p-4 flex flex-col gap-4 font-mono text-xs ${activeChannel === 'left' ? 'border-t-cyan-600' : 'border-t-emerald-600'}`}>
              {/* Carrier */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Waves className="w-3.5 h-3.5" />
                    CARRIER LAYER
                  </span>
                  <span className="font-bold text-sm">{currentParams.carrierFreq} Hz</span>
                </div>
                <input
                  type="range" min={10} max={4000} step={10}
                  value={currentParams.carrierFreq}
                  onChange={(e) => dispatchCarrierFreq(activeChannel, Number(e.target.value))}
                  className="w-full h-2 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                />
                <div className="grid grid-cols-2 gap-2">
                  {(['sine', 'triangle'] as const).map(w => (
                    <button key={w} onClick={() => dispatchCarrierWave(activeChannel, w)} className={`py-1.5 rounded font-bold uppercase transition-all ${currentParams.carrierWaveform === w ? 'bg-slate-700 text-white' : 'bg-[#121c27] text-slate-500'}`}>
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modulation */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    MODULATION LAYER
                  </span>
                  <span className="font-bold text-sm">{currentParams.modFreq} Hz</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['continuous', 'burst', 'sequenced'] as const).map(m => (
                    <button key={m} onClick={() => dispatchMode(activeChannel, m)} className={`py-1.5 rounded font-bold uppercase transition-all ${currentParams.mode === m ? 'bg-slate-700 text-white' : 'bg-[#121c27] text-slate-500'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  type="range" min={1} max={150} step={1}
                  value={currentParams.modFreq}
                  onChange={(e) => dispatchModFreq(activeChannel, Number(e.target.value))}
                  className="w-full h-2 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">Depth: {Math.round(currentParams.modDepth * 100)}%</div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={currentParams.modDepth}
                    onChange={(e) => dispatchModDepth(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">Ch. Volume: {Math.round(currentParams.masterVolume * 100)}%</div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={currentParams.masterVolume}
                    onChange={(e) => dispatchMasterVolume(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-3 flex gap-2">
              <button 
                onClick={() => {
                  const data = {
                    timestamp: new Date().toISOString(),
                    params,
                    steps,
                    impedanceModel
                  };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `telemetry-session-${Date.now()}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex-1 py-2 bg-[#132230] text-slate-300 hover:text-cyan-300 rounded border border-[#23384f] text-[10px] uppercase font-black transition-colors"
              >
                Export Session
              </button>
              <button onClick={() => console.log(params)} className="flex-1 py-2 bg-[#132230] text-cyan-300 rounded border border-[#23384f] text-[10px] uppercase font-black">
                Dump Telemetry
              </button>
            </div>
          </div>

          {/* Viz */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Simple Meter Integration */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-[#1e293b] pb-2">
                 <Zap className="w-3.5 h-3.5" />
                 Hardware Output Status (Stereo)
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border ${isRunning ? 'bg-cyan-950/20 border-cyan-800' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="text-[9px] text-slate-500 font-bold mb-1">CH1 (L)</div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: isRunning ? `${params.left.masterVolume * 100}%` : '0%' }} />
                    </div>
                  </div>
                  <div className={`p-3 rounded-lg border ${isRunning ? 'bg-emerald-950/20 border-emerald-800' : 'bg-slate-900 border-slate-800'}`}>
                    <div className="text-[9px] text-slate-500 font-bold mb-1">CH2 (R)</div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: isRunning ? `${params.right.masterVolume * 100}%` : '0%' }} />
                    </div>
                  </div>
               </div>
            </div>

            <Oscilloscope
              engine={engineRef.current}
              isRunning={isRunning}
              activeChannel={activeChannel}
              params={params}
            />

            <div className="flex items-center gap-2 border-b border-[#1a2634] pb-1 overflow-x-auto">
              {(['player', 'composer', 'profiler', 'sequencer', 'spectrum', 'ayurvedic'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`py-1.5 px-3 text-[10px] font-black rounded uppercase whitespace-nowrap ${activeTab === t ? 'bg-[#162433] text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-slate-200 transition-colors'}`}>
                  {t === 'player' ? (
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5" />
                      Player
                    </span>
                  ) : t === 'composer' ? 'Composer' : t}
                </button>
              ))}
            </div>

            {activeTab === 'profiler' && <ImpedanceProfiler params={currentParams} impedanceModel={impedanceModel} onUpdateModel={setImpedanceModel} />}
            {activeTab === 'sequencer' && <PulseSequencer steps={steps[activeChannel]} currentStep={currentStep[activeChannel]} syncClickEnabled={false} onUpdateSteps={s => dispatchStepsUpdate(activeChannel, s)} onToggleSyncClick={() => {}} />}
            {activeTab === 'spectrum' && <SpectrumAnalyzer engine={engineRef.current} isRunning={isRunning} activeChannel={activeChannel} params={params} />}
            {activeTab === 'ayurvedic' && <AyurvedicHarmonics />}
            {activeTab === 'composer' && <Composer onPlayProtocol={(p) => engineRef.current?.scheduleProtocol(p)} />}
            {activeTab === 'player' && <Player engine={engineRef.current} />}
          </div>
        </div>
      </main>

      <footer className="bg-[#0b1016] border-t border-[#1a2634] px-4 py-2 text-[9px] text-slate-600 flex justify-between font-mono">
        <div className="flex items-center gap-4">
          <Terminal className="w-3 h-3 text-cyan-500" />
          <span>DUAL-CH SYNTHESIS</span>
          <span>48kHz</span>
          <span>SENSORY ISOLATION: ACTIVE</span>
        </div>
        <div className={isRunning ? 'text-emerald-500' : 'text-slate-700'}>
          {isRunning ? 'TRANSMITTING STEREO' : 'IDLE'}
        </div>
      </footer>
    </div>
  );
}
