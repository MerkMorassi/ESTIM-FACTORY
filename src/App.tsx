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
import { storage } from './lib/storage';
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
import { MidiMappingOverview } from './components/MidiMappingOverview';
import { AiCoPilot } from './components/AiCoPilot';
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
  SaveAll,
  Activity,
  BrainCircuit,
  Settings as SettingsIcon,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { midiService, MidiMappingType } from './audio/midiService';
import { Settings } from './components/Settings';
import { useUndoRedo } from './lib/useUndoRedo';

interface SessionState {
  params: { left: SignalParameters; right: SignalParameters };
  steps: { left: SequencerStep[]; right: SequencerStep[] };
}

const DEFAULT_PARAMS: SignalParameters = {
  carrierFreq: 100,
  carrierWaveform: 'sine',
  carrierWaveformB: 'triangle',
  carrierMorph: 0.0,
  carrierPhase: 0,
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
  masterBpm: 120,
  syncToMaster: false,
  seqLoopStart: 0,
  seqLoopEnd: 7,
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
  const { state: appState, setState: setAppState, undo, redo, canUndo, canRedo } = useUndoRedo<SessionState>({
    params: {
      left: { ...DEFAULT_PARAMS, carrierFreq: 2500, masterVolume: 0.7 },
      right: { ...DEFAULT_PARAMS, carrierFreq: 100, masterVolume: 0.7 },
    },
    steps: {
      left: DEFAULT_STEPS.map(s => ({ ...s })),
      right: DEFAULT_STEPS.map(s => ({ ...s })),
    }
  });

  const params = appState.params;
  const steps = appState.steps;

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
  const [activeTab, setActiveTab] = useState<'profiler' | 'sequencer' | 'spectrum' | 'standalone_module' | 'ayurvedic' | 'composer' | 'player' | 'midi' | 'ai' | 'settings'>('player');
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const [midiStatus, setMidiStatus] = useState<'idle' | 'active' | 'denied'>('idle');
  const [midiLastCC, setMidiLastCC] = useState<string>('');
  const [isLearning, setIsLearning] = useState<boolean>(false);
  const [isMpd218Connected, setIsMpd218Connected] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; param: MidiMappingType; channel: 'left' | 'right' | 'both' } | null>(null);

  const engineRef = useRef<SignalEngine | null>(null);

  useEffect(() => {
    const engine = new SignalEngine(params, steps);
    engine.setOnStepCallback('left', (step) => setCurrentStep(prev => ({ ...prev, left: step })));
    engine.setOnStepCallback('right', (step) => setCurrentStep(prev => ({ ...prev, right: step })));
    engineRef.current = engine;

    const initMidi = async () => {
      const granted = await midiService.requestAccess();
      setMidiStatus(granted ? 'active' : 'denied');
      
      if (granted) {
        const inputs = midiService.getInputs();
        setIsMpd218Connected(inputs.some(input => input.name?.includes('MPD218')));

        midiService.setCallback((param, value, channel) => {
          setMidiLastCC(`${param.toUpperCase()}`);
          
          if (param === 'masterVolume') {
            dispatchMasterVolume(channel, value);
          } else if (param === 'carrierFreq') {
            const freq = Math.round(10 + (value * 3990)); // 10-4000
            dispatchCarrierFreq(channel, freq);
          } else if (param === 'modFreq') {
            const freq = Math.round(1 + (value * 149)); // 1-150
            dispatchModFreq(channel, freq);
          } else if (param === 'modDepth') {
            dispatchModDepth(channel, value);
          } else if (param === 'carrierMorph') {
            dispatchCarrierMorph(channel, value);
          } else if (param === 'carrierPhase') {
            const phase = Math.round(value * 360);
            dispatchCarrierPhase(channel, phase);
          } else if (param === 'masterBpm') {
            const bpm = Math.round(40 + (value * 200)); // 40-240
            dispatchMasterBpm(bpm);
          } else if (param === 'power') {
            togglePower();
          } else if (param === 'mode') {
            // Cycle modes: continuous -> burst -> sequenced -> sweep
            const modes: ModulationMode[] = ['continuous', 'burst', 'sequenced', 'sweep'];
            const currentMode = appState.params[activeChannel].mode;
            const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
            dispatchMode(activeChannel, nextMode);
          } else if (param === 'sync') {
            dispatchSyncToMaster(activeChannel, !appState.params[activeChannel].syncToMaster);
          } else if (param === 'channelFocus') {
            setActiveChannel(prev => prev === 'left' ? 'right' : 'left');
          }
        });
      }
    };
    
    initMidi();

    midiService.setLearnCallback((param, id) => {
      const label = id.cc !== undefined ? `CC ${id.cc}` : `NOTE ${id.note}`;
      setMidiLastCC(`LEARNED ${label}`);
      setIsLearning(false);
    });

    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);

    return () => {
      engine.destroy();
      engineRef.current = null;
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleMidiLearn = (param: MidiMappingType, channel: 'left' | 'right' | 'both') => {
    setIsLearning(true);
    midiService.startLearning(param, channel);
    setContextMenu(null);
  };

  const onControlContextMenu = (e: React.MouseEvent, param: MidiMappingType, channel: 'left' | 'right' | 'both') => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, param, channel });
  };

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
    setAppState(prev => ({
      ...prev,
      params: {
        ...prev.params,
        [channel]: { ...prev.params[channel], [key]: value }
      }
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

  const dispatchCarrierWaveB = (channel: 'left' | 'right', wave: WaveformType) => {
    handleParamChange(channel, 'carrierWaveformB', wave);
    engineRef.current?.setCarrierWaveformB(channel, wave);
  };

  const dispatchCarrierMorph = (channel: 'left' | 'right', morph: number) => {
    handleParamChange(channel, 'carrierMorph', morph);
    engineRef.current?.setCarrierMorph(channel, morph);
  };

  const dispatchCarrierPhase = (channel: 'left' | 'right', phase: number) => {
    handleParamChange(channel, 'carrierPhase', phase);
    engineRef.current?.setCarrierPhase(channel, phase);
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

  const dispatchMasterBpm = (bpm: number) => {
    setAppState(prev => ({
      ...prev,
      params: {
        left: { ...prev.params.left, masterBpm: bpm },
        right: { ...prev.params.right, masterBpm: bpm },
      }
    }));
    engineRef.current?.setMasterBpm(bpm);
  };

  const dispatchSyncToMaster = (channel: 'left' | 'right', sync: boolean) => {
    handleParamChange(channel, 'syncToMaster', sync);
    engineRef.current?.setSyncToMaster(channel, sync);
  };

  const dispatchStepsUpdate = (channel: 'left' | 'right', newSteps: SequencerStep[]) => {
    setAppState(prev => ({
      ...prev,
      steps: { ...prev.steps, [channel]: newSteps }
    }));
    engineRef.current?.updateSequencerSteps(channel, newSteps);
  };
  
  const dispatchLoopRange = (channel: 'left' | 'right', start: number, end: number) => {
    handleParamChange(channel, 'seqLoopStart', start);
    handleParamChange(channel, 'seqLoopEnd', end);
    engineRef.current?.setLoopRange(channel, start, end);
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
    
    setAppState(prev => ({
      ...prev,
      params: { ...prev.params, [channel]: updated }
    }));
    
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
    setAppState(prev => ({
      ...prev,
      params: {
        left: { ...prev.params.left, ...preset.left, carrierWaveform: preset.left.carrierWave, modWaveform: preset.left.modWave },
        right: { ...prev.params.right, ...preset.right, carrierWaveform: preset.right.carrierWave, modWaveform: preset.right.modWave },
      }
    }));

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

  const handleAiCommand = (data: any) => {
    const ch = data.ch === 'both' ? ['left', 'right'] : [data.ch || activeChannel];
    
    (ch as ('left' | 'right')[]).forEach(c => {
      if (data.carrierFreq !== undefined) dispatchCarrierFreq(c, data.carrierFreq);
      if (data.modFreq !== undefined) dispatchModFreq(c, data.modFreq);
      if (data.modDepth !== undefined) dispatchModDepth(c, data.modDepth);
      if (data.masterVolume !== undefined) dispatchMasterVolume(c, data.masterVolume);
      if (data.mode !== undefined) dispatchMode(c, data.mode);
      if (data.carrierMorph !== undefined) dispatchCarrierMorph(c, data.carrierMorph);
      if (data.carrierPhase !== undefined) dispatchCarrierPhase(c, data.carrierPhase);
    });

    if (data.power !== undefined) {
      if (data.power && !isRunning) togglePower();
      if (!data.power && isRunning) togglePower();
    }
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

            {/* Undo/Redo */}
            <div className="flex p-1 bg-[#101720] border border-[#1a2634] rounded-lg">
              <button
                onClick={undo}
                disabled={!canUndo}
                className={`p-1.5 rounded transition-all ${canUndo ? 'text-cyan-400 hover:bg-cyan-900/30' : 'text-slate-700 pointer-events-none'}`}
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={`p-1.5 rounded transition-all ${canRedo ? 'text-cyan-400 hover:bg-cyan-900/30' : 'text-slate-700 pointer-events-none'}`}
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* MIDI Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-bold ${midiStatus === 'active' ? 'bg-cyan-950/30 border-cyan-800 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
              <Activity className={`w-3.5 h-3.5 ${midiStatus === 'active' ? (isLearning ? 'animate-bounce text-amber-400' : 'animate-pulse') : ''}`} />
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className={isLearning ? 'text-amber-400' : ''}>{isLearning ? 'LEARNING...' : `MIDI ${midiStatus.toUpperCase()}`}</span>
                  {isMpd218Connected && (
                    <span className="bg-cyan-500/20 text-cyan-500 px-1 rounded-[2px] text-[7px] border border-cyan-500/30">AKAI MPD218</span>
                  )}
                </div>
                {midiLastCC && <span className="text-[8px] text-cyan-600 truncate max-w-[80px]">{midiLastCC}</span>}
              </div>
            </div>

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
                  onContextMenu={(e) => onControlContextMenu(e, 'carrierFreq', activeChannel)}
                  onChange={(e) => dispatchCarrierFreq(activeChannel, Number(e.target.value))}
                  className="w-full h-2 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Base (A)</div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['sine', 'triangle'] as const).map(w => (
                        <button key={w} onClick={() => dispatchCarrierWave(activeChannel, w)} className={`py-1 text-[9px] rounded font-bold uppercase transition-all ${currentParams.carrierWaveform === w ? 'bg-slate-700 text-white border border-slate-600' : 'bg-[#121c27] text-slate-500 border border-transparent'}`}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-slate-500 font-bold uppercase">Morph (B)</div>
                    <div className="grid grid-cols-2 gap-1">
                      {(['sine', 'triangle'] as const).map(w => (
                        <button key={w} onClick={() => dispatchCarrierWaveB(activeChannel, w)} className={`py-1 text-[9px] rounded font-bold uppercase transition-all ${currentParams.carrierWaveformB === w ? 'bg-slate-700 text-white border border-slate-600' : 'bg-[#121c27] text-slate-500 border border-transparent'}`}>
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">
                    Waveform Morph: {Math.round(currentParams.carrierMorph * 100)}%
                    <span className="text-cyan-600">{currentParams.carrierWaveform} → {currentParams.carrierWaveformB}</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={currentParams.carrierMorph}
                    onContextMenu={(e) => onControlContextMenu(e, 'carrierMorph', activeChannel)}
                    onChange={(e) => dispatchCarrierMorph(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">
                    Phase Shift: {currentParams.carrierPhase}°
                  </div>
                  <input
                    type="range" min={0} max={360} step={1}
                    value={currentParams.carrierPhase}
                    onContextMenu={(e) => onControlContextMenu(e, 'carrierPhase', activeChannel)}
                    onChange={(e) => dispatchCarrierPhase(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-emerald-500"
                  />
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
                  {(['continuous', 'burst', 'sequenced', 'sweep'] as const).map(m => (
                    <button key={m} onClick={() => dispatchMode(activeChannel, m)} className={`py-1.5 rounded font-bold uppercase transition-all ${currentParams.mode === m ? 'bg-slate-700 text-white' : 'bg-[#121c27] text-slate-500'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                
                {/* BPM Sync Control */}
                <div className="bg-[#101720] border border-[#1e293b] rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5">
                      <Music className="w-3 h-3" />
                      Global Master BPM
                    </span>
                    <button 
                      onClick={() => dispatchSyncToMaster(activeChannel, !currentParams.syncToMaster)}
                      className={`px-2 py-0.5 rounded border transition-all ${currentParams.syncToMaster ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-slate-900 text-slate-600 border-slate-800'}`}
                    >
                      {currentParams.syncToMaster ? 'SYNC LOCKED' : 'SYNC OFF'}
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="range" min={40} max={240} step={1}
                      value={currentParams.masterBpm}
                      onChange={(e) => dispatchMasterBpm(Number(e.target.value))}
                      className="flex-1 h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-amber-500"
                    />
                    <span className="w-12 text-center text-xs font-bold text-amber-400">{currentParams.masterBpm}</span>
                  </div>
                </div>

                <input
                  type="range" min={1} max={150} step={1}
                  value={currentParams.modFreq}
                  disabled={currentParams.syncToMaster}
                  onContextMenu={(e) => onControlContextMenu(e, 'modFreq', activeChannel)}
                  onChange={(e) => dispatchModFreq(activeChannel, Number(e.target.value))}
                  className={`w-full h-2 rounded appearance-none cursor-pointer accent-current ${currentParams.syncToMaster ? 'bg-[#0b1016] opacity-30' : 'bg-[#1e293b]'}`}
                />
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">Depth: {Math.round(currentParams.modDepth * 100)}%</div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={currentParams.modDepth}
                    onContextMenu={(e) => onControlContextMenu(e, 'modDepth', activeChannel)}
                    onChange={(e) => dispatchModDepth(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] text-slate-500 uppercase font-black">Ch. Volume: {Math.round(currentParams.masterVolume * 100)}%</div>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={currentParams.masterVolume}
                    onContextMenu={(e) => onControlContextMenu(e, 'masterVolume', activeChannel)}
                    onChange={(e) => dispatchMasterVolume(activeChannel, Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1e293b] rounded appearance-none cursor-pointer accent-current"
                  />
                </div>
              </div>
            </div>

            {/* Research Actions */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-3 flex flex-col gap-2">
              <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                <Download className="w-3 h-3" />
                Research Data Portability
              </div>
              <div className="grid grid-cols-2 gap-2">
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
                  className="py-2 bg-[#132230] text-slate-300 hover:text-cyan-300 rounded border border-[#23384f] text-[9px] uppercase font-black transition-colors"
                >
                  Export Session
                </button>
                <button 
                  onClick={async () => {
                    try {
                      const protocols = await storage.getProtocols();
                      const beats = await storage.getBeats();
                      const bundle = {
                        version: '2.0',
                        exportedAt: new Date().toISOString(),
                        library: {
                          protocols,
                          beats
                        }
                      };
                      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `stim-library-bulk-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error("Bulk export failed:", err);
                    }
                  }}
                  className="py-2 bg-[#1a2d40] text-cyan-400 hover:text-cyan-300 rounded border border-cyan-800/50 text-[9px] uppercase font-black transition-colors flex items-center justify-center gap-2"
                >
                  <SaveAll className="w-3 h-3" />
                  Bulk Export
                </button>
              </div>
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
              {(['player', 'composer', 'ai', 'midi', 'profiler', 'sequencer', 'spectrum', 'ayurvedic', 'settings'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`py-1.5 px-3 text-[10px] font-black rounded uppercase whitespace-nowrap ${activeTab === t ? 'bg-[#162433] text-cyan-300 border border-cyan-800' : 'text-slate-400 hover:text-slate-200 transition-colors'}`}>
                  {t === 'player' ? (
                    <span className="flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5" />
                      Player
                    </span>
                  ) : t === 'composer' ? 'Composer' : t === 'midi' ? 'MIDI MAP' : t === 'ai' ? (
                    <span className="flex items-center gap-1.5">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      AI Co-Pilot
                    </span>
                  ) : t === 'settings' ? (
                    <span className="flex items-center gap-1.5">
                      <SettingsIcon className="w-3.5 h-3.5" />
                      Settings
                    </span>
                  ) : t}
                </button>
              ))}
            </div>

            {activeTab === 'profiler' && <ImpedanceProfiler params={currentParams} impedanceModel={impedanceModel} onUpdateModel={setImpedanceModel} />}
            {activeTab === 'sequencer' && (
              <PulseSequencer 
                steps={steps[activeChannel]} 
                currentStep={currentStep[activeChannel]} 
                loopStart={currentParams.seqLoopStart}
                loopEnd={currentParams.seqLoopEnd}
                syncClickEnabled={false} 
                onUpdateSteps={s => dispatchStepsUpdate(activeChannel, s)} 
                onUpdateLoopRange={(start, end) => dispatchLoopRange(activeChannel, start, end)}
                onToggleSyncClick={() => {}} 
              />
            )}
            {activeTab === 'spectrum' && <SpectrumAnalyzer engine={engineRef.current} isRunning={isRunning} activeChannel={activeChannel} params={params} />}
            {activeTab === 'ayurvedic' && <AyurvedicHarmonics />}
            {activeTab === 'composer' && <Composer onPlayProtocol={(p) => engineRef.current?.scheduleProtocol(p)} onStopProtocol={() => engineRef.current?.stop()} />}
            {activeTab === 'player' && <Player engine={engineRef.current} />}
            {activeTab === 'midi' && <MidiMappingOverview onRefresh={() => {}} />}
            {activeTab === 'ai' && (
              <AiCoPilot 
                currentState={{ params, isRunning, activeChannel }}
                onExecuteCommand={handleAiCommand}
                onLoadProtocol={(p) => {
                  engineRef.current?.scheduleProtocol(p);
                  if (!isRunning) togglePower();
                }}
              />
            )}
            {activeTab === 'settings' && <Settings />}
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

      {/* MIDI Learn Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-[#0b1016] border border-cyan-800 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden min-w-[140px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => handleMidiLearn(contextMenu.param, contextMenu.channel)}
            className="w-full text-left px-4 py-2 text-[10px] font-bold text-cyan-400 hover:bg-cyan-900/30 flex items-center gap-2 border-b border-[#1a2634]"
          >
            <Activity className="w-3.5 h-3.5" />
            LEARN MIDI CC
          </button>
          <button
            onClick={() => setContextMenu(null)}
            className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-[#15202c]"
          >
            CANCEL
          </button>
        </div>
      )}

      {/* Learning Overlay */}
      {isLearning && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-[#0b1016] border-2 border-amber-500 p-8 rounded-2xl flex flex-col items-center gap-4 animate-pulse">
            <Activity className="w-12 h-12 text-amber-500" />
            <div className="text-center">
              <h3 className="text-xl font-black text-amber-500 uppercase tracking-tighter">MIDI Learning Active</h3>
              <p className="text-xs text-slate-400 mt-2">Move a physical slider or knob on your controller now...</p>
            </div>
            <button 
              className="mt-4 px-6 py-2 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] font-bold rounded-full pointer-events-auto hover:bg-slate-800"
              onClick={() => {
                midiService.stopLearning();
                setIsLearning(false);
              }}
            >
              CANCEL LEARN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
