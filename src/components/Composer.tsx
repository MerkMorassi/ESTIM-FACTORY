/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Composer: Clinical Protocol Design Studio
 * Timeline-based DAW for designing multi-stage stimulation sequences.
 */

import React, { useState } from 'react';
import { StimulationProtocol, ProtocolSegment, InterpolationType, BeatStep, SegmentType, BeatTemplate } from '../types/telemetry';
import { useProtocols } from '../lib/useProtocols';
import { useBeats } from '../lib/useBeats';
import { 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  Activity, 
  Layers,
  TrendingUp,
  Settings2,
  Lock,
  ArrowRight,
  GripVertical,
  Music,
  Zap,
  ListMusic,
  FilePlus,
  CirclePlay,
  SaveAll,
  Copy,
  Square
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';

interface ComposerProps {
  onPlayProtocol: (protocol: StimulationProtocol) => void;
  onStopProtocol: () => void;
}

const DEFAULT_BEAT_STEPS: BeatStep[] = Array(16).fill(null).map(() => ({ type: 'none' }));

const DEFAULT_SEGMENT: Omit<ProtocolSegment, 'id'> = {
  type: 'ramp',
  durationSec: 15,
  startIntensity: 0.1,
  endIntensity: 0.3,
  startCarrierFreq: 100,
  endCarrierFreq: 100,
  startModFreq: 10,
  endModFreq: 10,
  interpolation: 'linear',
  label: 'New Phase',
  bpm: 120,
  steps: [...DEFAULT_BEAT_STEPS],
};

const INITIAL_PROTOCOL: StimulationProtocol = {
  name: 'Standard Clinical Profile',
  description: 'Baseline arousal and recruitment sequence',
  totalDurationMs: 0,
  lastModified: Date.now(),
  masterBpm: 120,
  channels: {
    left: [
      {
        id: crypto.randomUUID(),
        type: 'ramp',
        durationSec: 10,
        startIntensity: 0.1,
        endIntensity: 0.4,
        startCarrierFreq: 100,
        endCarrierFreq: 100,
        startModFreq: 10,
        endModFreq: 10,
        interpolation: 'linear',
        label: 'Phase 1: Intro'
      },
      {
        id: crypto.randomUUID(),
        type: 'beat',
        durationSec: 10,
        startIntensity: 0.5,
        endIntensity: 0.5,
        startCarrierFreq: 100,
        endCarrierFreq: 100,
        startModFreq: 10,
        endModFreq: 10,
        interpolation: 'linear',
        bpm: 120,
        steps: Array(16).fill(null).map((_, i) => ({ type: i % 4 === 0 ? 'bass' : i % 4 === 2 ? 'snare' : 'none' })),
        label: 'Phase 2: Rhythmic'
      }
    ],
    right: [
      {
        id: crypto.randomUUID(),
        type: 'ramp',
        durationSec: 20,
        startIntensity: 0.2,
        endIntensity: 0.2,
        startCarrierFreq: 80,
        endCarrierFreq: 80,
        startModFreq: 5,
        endModFreq: 5,
        interpolation: 'linear',
        label: 'Baseline Mapping'
      },
      {
        id: crypto.randomUUID(),
        type: 'beat',
        durationSec: 15,
        startIntensity: 0.7,
        endIntensity: 0.7,
        startCarrierFreq: 120,
        endCarrierFreq: 120,
        startModFreq: 10,
        endModFreq: 10,
        interpolation: 'linear',
        bpm: 130,
        steps: Array(16).fill(null).map((_, i) => ({ type: (i % 4 === 0 || i % 4 === 1 || i % 4 === 3) ? 'bass' : 'none' })),
        label: 'Phase 3: The Gallop'
      }
    ]
  }
};

export const Composer: React.FC<ComposerProps> = ({ onPlayProtocol, onStopProtocol }) => {
  const [protocol, setProtocol] = useState<StimulationProtocol>(INITIAL_PROTOCOL);
  const { protocols: savedProtocols, saveProtocol: dbSave, deleteProtocol: dbDelete } = useProtocols();
  const { beats: savedBeats, saveBeat: dbSaveBeat, deleteBeat: dbDeleteBeat } = useBeats();
  const [activeChannel, setActiveChannel] = useState<'left' | 'right'>('left');
  const [sidebarTab, setSidebarTab] = useState<'protocols' | 'beats'>('protocols');
  
  // Playback tracking state
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  const totalTimeMs = React.useMemo(() => 
    protocol.channels[activeChannel].reduce((acc, s) => acc + s.durationSec, 0) * 1000
  , [protocol.channels, activeChannel]);

  React.useEffect(() => {
    let interval: number;
    if (isPlaying && startTime) {
      interval = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= totalTimeMs) {
          handleStop();
        } else {
          setElapsedTime(elapsed);
        }
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying, startTime, totalTimeMs]);

  const handlePlay = () => {
    onPlayProtocol(protocol);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsPlaying(true);
  };

  const handleStop = () => {
    onStopProtocol();
    setIsPlaying(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  const activeSegmentIndex = React.useMemo(() => {
    if (!isPlaying) return -1;
    let accumulated = 0;
    const currentSegments = protocol.channels[activeChannel];
    for (let i = 0; i < currentSegments.length; i++) {
      accumulated += currentSegments[i].durationSec * 1000;
      if (elapsedTime < accumulated) return i;
    }
    return -1;
  }, [isPlaying, elapsedTime, protocol.channels, activeChannel]);

  const addSegment = (type: SegmentType = 'ramp') => {
    const newSeg: ProtocolSegment = {
      ...DEFAULT_SEGMENT,
      type,
      id: crypto.randomUUID(),
      label: type === 'beat' ? 'New Beat' : `Phase ${protocol.channels[activeChannel].length + 1}`,
      steps: type === 'beat' ? [...DEFAULT_BEAT_STEPS] : undefined,
    };
    setProtocol(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [activeChannel]: [...prev.channels[activeChannel], newSeg]
      }
    }));
  };

  const addBeatFromTemplate = (template: BeatTemplate) => {
    const newSeg: ProtocolSegment = {
      ...DEFAULT_SEGMENT,
      type: 'beat',
      id: crypto.randomUUID(),
      label: template.name,
      bpm: template.bpm,
      steps: [...template.steps],
    };
    setProtocol(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [activeChannel]: [...prev.channels[activeChannel], newSeg]
      }
    }));
  };

  const removeSegment = (id: string) => {
    setProtocol(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [activeChannel]: prev.channels[activeChannel].filter(s => s.id !== id)
      }
    }));
  };

  const updateSegment = (id: string, updates: Partial<ProtocolSegment>) => {
    setProtocol(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [activeChannel]: prev.channels[activeChannel].map(s => s.id === id ? { ...s, ...updates } : s)
      }
    }));
  };

  const toggleBeatStep = (segId: string, stepIdx: number) => {
    const seg = protocol.channels[activeChannel].find(s => s.id === segId);
    if (!seg || !seg.steps) return;
    
    const currentType = seg.steps[stepIdx].type;
    let nextType: BeatStep['type'] = 'none';
    if (currentType === 'none') nextType = 'bass';
    else if (currentType === 'bass') nextType = 'snare';
    
    const newSteps = [...seg.steps];
    newSteps[stepIdx] = { type: nextType };
    updateSegment(segId, { steps: newSteps });
  };

  const saveSegmentAsBeat = async (seg: ProtocolSegment) => {
    if (seg.type !== 'beat' || !seg.steps) return;
    await dbSaveBeat({
      name: seg.label || 'Unnamed Beat',
      bpm: seg.bpm || 120,
      steps: [...seg.steps],
      lastModified: Date.now()
    });
  };

  const reorderSegments = (newOrder: ProtocolSegment[]) => {
    setProtocol(prev => ({
      ...prev,
      channels: {
        ...prev.channels,
        [activeChannel]: newOrder
      }
    }));
  };

  const saveProtocol = async () => {
    await dbSave({ ...protocol, lastModified: Date.now() });
  };

  const totalTime = protocol.channels[activeChannel].reduce((acc, s) => acc + s.durationSec, 0);
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-[750px] bg-[#070b0f] border border-[#1e293b] rounded-lg overflow-hidden font-mono text-xs">
      {/* Sidebar: Library */}
      <aside className="w-64 border-r border-[#1e293b] bg-[#0b1016] flex flex-col">
        <div className="p-4 border-b border-[#1e293b] flex items-center justify-between bg-[#0d141e]">
          <span className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <ListMusic className="w-3.5 h-3.5 text-cyan-500" />
            Library
          </span>
          <button 
            onClick={() => setProtocol({ ...INITIAL_PROTOCOL, id: undefined, name: 'New Protocol', masterBpm: 120, channels: { left: [], right: [] } })}
            className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-cyan-400"
            title="New Protocol"
          >
            <FilePlus className="w-4 h-4" />
          </button>
        </div>
        
        {/* Sidebar Tabs */}
        <div className="flex border-b border-[#16202c]">
          <button 
            onClick={() => setSidebarTab('protocols')}
            className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest border-b-2 transition-all ${sidebarTab === 'protocols' ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            Protocols
          </button>
          <button 
            onClick={() => setSidebarTab('beats')}
            className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest border-b-2 transition-all ${sidebarTab === 'beats' ? 'border-amber-500 text-amber-400 bg-amber-950/20' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
          >
            Beats
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 custom-scrollbar">
          {sidebarTab === 'protocols' ? (
            savedProtocols.map(p => (
              <button 
                key={p.id} 
                onClick={() => setProtocol(p)}
                className={`text-left p-3 rounded-lg border transition-all flex flex-col gap-1 group ${protocol.id === p.id ? 'bg-cyan-950/30 border-cyan-800' : 'bg-[#0d141e] border-[#16202c] hover:border-[#23384f]'}`}
              >
                <div className={`font-bold text-[11px] truncate ${protocol.id === p.id ? 'text-cyan-400' : 'text-slate-300'}`}>{p.name}</div>
                <div className="flex items-center justify-between text-[8px] text-slate-600 uppercase">
                  <span>{new Date(p.lastModified).toLocaleDateString()}</span>
                  <span className="group-hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); dbDelete(p.id!); }}>
                    <Trash2 className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))
          ) : (
            savedBeats.map(b => (
              <button 
                key={b.id} 
                onClick={() => addBeatFromTemplate(b)}
                className="text-left p-3 rounded-lg border bg-[#0d141e] border-[#16202c] hover:border-amber-800 transition-all flex flex-col gap-1 group"
              >
                <div className="font-bold text-[11px] truncate text-amber-400/80 group-hover:text-amber-400">{b.name}</div>
                <div className="flex items-center justify-between text-[8px] text-slate-600 uppercase">
                  <span>{b.bpm} BPM</span>
                  <span className="group-hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); dbDeleteBeat(b.id!); }}>
                    <Trash2 className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))
          )}
          {sidebarTab === 'protocols' && savedProtocols.length === 0 && <div className="py-8 text-center text-slate-700 italic text-[10px]">Empty Protocol List</div>}
          {sidebarTab === 'beats' && savedBeats.length === 0 && <div className="py-8 text-center text-slate-700 italic text-[10px]">No Beat Templates</div>}
        </div>
      </aside>

      {/* Main Editor */}
      <main className="flex-1 flex flex-col bg-[#0b1016]">
        {/* Editor Header */}
        <header className="p-4 border-b border-[#1e293b] flex flex-wrap items-center justify-between gap-4 bg-[#0d141e]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-cyan-900/50 flex items-center justify-center border border-cyan-800">
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <input 
                value={protocol.name}
                onChange={e => setProtocol({ ...protocol, name: e.target.value })}
                className="bg-transparent border-none text-sm font-black text-slate-100 focus:outline-none focus:ring-0 w-64"
                placeholder="Protocol Name..."
              />
              <div className="text-[9px] text-slate-500 uppercase tracking-widest font-black">Clinical Design Studio</div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-[#070b0f] border border-[#1e293b] rounded-lg">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Master BPM</span>
              <input 
                type="number"
                min="40"
                max="240"
                value={protocol.masterBpm}
                onChange={e => setProtocol({ ...protocol, masterBpm: Number(e.target.value) })}
                className="bg-transparent border-none text-amber-400 font-black text-sm focus:outline-none w-12 text-center"
              />
              <Music className="w-3.5 h-3.5 text-slate-700" />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={saveProtocol} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 rounded border border-emerald-800 transition-all font-black uppercase text-[10px]">
                <Save className="w-3.5 h-3.5" /> Commit
              </button>
              {!isPlaying ? (
                <button onClick={handlePlay} className="flex items-center gap-2 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-all font-black uppercase text-[10px] shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                  <CirclePlay className="w-3.5 h-3.5" /> Preview Sequence
                </button>
              ) : (
                <button onClick={handleStop} className="flex items-center gap-2 px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded transition-all font-black uppercase text-[10px] shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                  <Square className="w-3.5 h-3.5" /> Stop Preview
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Channel Switcher */}
        <nav className="px-6 pt-4 flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[#070b0f] p-1 rounded-lg border border-[#16202c]">
            <button 
              onClick={() => setActiveChannel('left')}
              className={`px-4 py-1.5 rounded font-black uppercase tracking-tighter transition-all flex items-center gap-2 ${activeChannel === 'left' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeChannel === 'left' ? 'bg-white' : 'bg-slate-700'}`} />
              CH 1 (L)
            </button>
            <button 
              onClick={() => setActiveChannel('right')}
              className={`px-4 py-1.5 rounded font-black uppercase tracking-tighter transition-all flex items-center gap-2 ${activeChannel === 'right' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeChannel === 'right' ? 'bg-white' : 'bg-slate-700'}`} />
              CH 2 (R)
            </button>
          </div>
          <div className="h-4 w-px bg-slate-800 mx-2" />
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              {formatTime(totalTime)}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-600" />
              {protocol.channels[activeChannel].length} Stages
            </span>
          </div>
        </nav>

        {/* Timeline Editor */}
        <section className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 custom-scrollbar">
          {/* Visual Timeline Minimap */}
          <div className="h-4 bg-[#070b0f] rounded-lg border border-[#16202c] overflow-hidden flex mb-2 relative">
            {protocol.channels[activeChannel].map((seg, idx) => (
              <div 
                key={seg.id}
                className={`h-full border-r border-[#0b1016] transition-all relative ${activeSegmentIndex === idx ? 'brightness-150' : 'brightness-100'}`}
                style={{ 
                  width: `${(seg.durationSec / Math.max(totalTime, 1)) * 100}%`,
                  backgroundColor: seg.type === 'beat' ? 'hsl(30, 80%, 45%)' : `hsl(${200 + (idx * 15)}, 70%, 40%)` 
                }}
              >
                {activeSegmentIndex === idx && (
                  <motion.div 
                    layoutId="active-seg-glow"
                    className="absolute inset-0 bg-white/20 animate-pulse"
                  />
                )}
              </div>
            ))}
            {/* Playhead */}
            {isPlaying && (
              <motion.div 
                className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_white]"
                style={{ left: `${(elapsedTime / totalTimeMs) * 100}%` }}
              />
            )}
          </div>

          <Reorder.Group axis="y" values={protocol.channels[activeChannel]} onReorder={reorderSegments} className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {protocol.channels[activeChannel].map((seg, idx) => (
                <Reorder.Item 
                  key={seg.id}
                  value={seg}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    borderColor: activeSegmentIndex === idx ? 'rgba(6, 182, 212, 0.5)' : 'rgba(26, 43, 60, 1)',
                    backgroundColor: activeSegmentIndex === idx ? 'rgba(13, 20, 30, 1)' : 'rgba(13, 20, 30, 1)'
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`group border rounded-xl p-4 flex flex-col gap-4 relative overflow-hidden transition-colors ${activeSegmentIndex === idx ? 'ring-1 ring-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : ''}`}
                >
                  <div className={`absolute top-0 left-0 w-1 h-full ${seg.type === 'beat' ? 'bg-amber-500/50' : 'bg-cyan-500/50'} ${activeSegmentIndex === idx ? 'animate-pulse shadow-[0_0_8px_currentColor]' : ''}`} />
                  
                  {/* Segment Header */}
                  <header className="flex items-center justify-between border-b border-[#16212e] pb-2">
                    <div className="flex items-center gap-3">
                      <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-[#162433] rounded transition-colors text-slate-600 group-hover:text-slate-400">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <input 
                        value={seg.label}
                        onChange={e => updateSegment(seg.id, { label: e.target.value })}
                        className="bg-transparent border-none text-slate-200 font-bold focus:outline-none w-48 text-[11px]"
                      />
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${seg.type === 'beat' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'}`}>
                        {seg.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {seg.type === 'beat' && (
                        <button 
                          onClick={() => saveSegmentAsBeat(seg)}
                          className="text-slate-700 hover:text-amber-400 transition-colors"
                          title="Save as Beat Template"
                        >
                          <SaveAll className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <input 
                          type="number"
                          value={seg.durationSec}
                          onChange={e => updateSegment(seg.id, { durationSec: Number(e.target.value) })}
                          className="bg-[#070b0f] border border-[#1e293b] rounded px-1.5 py-0.5 w-12 text-center text-slate-300 font-bold"
                        />
                        <span className="text-[8px] uppercase font-black">Sec</span>
                      </div>
                      <button onClick={() => removeSegment(seg.id)} className="text-slate-700 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </header>

                  {seg.type === 'ramp' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          <span>Intensity (VCA)</span>
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min="0" max="1" step="0.01" value={seg.startIntensity} onChange={e => updateSegment(seg.id, { startIntensity: Number(e.target.value) })} className="flex-1 accent-emerald-500 h-1.5" />
                          <ArrowRight className="w-3 h-3 text-slate-800" />
                          <input type="range" min="0" max="1" step="0.01" value={seg.endIntensity} onChange={e => updateSegment(seg.id, { endIntensity: Number(e.target.value) })} className="flex-1 accent-emerald-500 h-1.5" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          <span>Carrier (Hz)</span>
                          <Activity className="w-3 h-3 text-cyan-500" />
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min="10" max="4000" step="10" value={seg.startCarrierFreq} onChange={e => updateSegment(seg.id, { startCarrierFreq: Number(e.target.value) })} className="flex-1 accent-cyan-500 h-1.5" />
                          <ArrowRight className="w-3 h-3 text-slate-800" />
                          <input type="range" min="10" max="4000" step="10" value={seg.endCarrierFreq} onChange={e => updateSegment(seg.id, { endCarrierFreq: Number(e.target.value) })} className="flex-1 accent-cyan-500 h-1.5" />
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest">
                          <span>Mod Rate (Hz)</span>
                          <Settings2 className="w-3 h-3 text-amber-500" />
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="range" min="1" max="150" step="1" value={seg.startModFreq} onChange={e => updateSegment(seg.id, { startModFreq: Number(e.target.value) })} className="flex-1 accent-amber-500 h-1.5" />
                          <ArrowRight className="w-3 h-3 text-slate-800" />
                          <input type="range" min="1" max="150" step="1" value={seg.endModFreq} onChange={e => updateSegment(seg.id, { endModFreq: Number(e.target.value) })} className="flex-1 accent-amber-500 h-1.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 pt-2">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-600 font-black uppercase">Tempo</span>
                          <input 
                            type="number" 
                            value={seg.bpm} 
                            onChange={e => updateSegment(seg.id, { bpm: Number(e.target.value) })}
                            className="bg-[#070b0f] border border-[#1e293b] rounded px-1.5 py-0.5 w-12 text-center text-amber-400 font-bold"
                          />
                          <span className="text-[8px] text-slate-700 uppercase font-black">BPM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-600 font-black uppercase text-center">Intensity</span>
                          <input 
                            type="range" min="0" max="1" step="0.01" 
                            value={seg.startIntensity} 
                            onChange={e => updateSegment(seg.id, { startIntensity: Number(e.target.value), endIntensity: Number(e.target.value) })}
                            className="w-32 accent-amber-500 h-1.5"
                          />
                        </div>
                      </div>
                      
                      {/* Step Sequencer */}
                      <div className="flex gap-1 overflow-x-auto pb-2 custom-scrollbar">
                        {seg.steps?.map((step, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => toggleBeatStep(seg.id, sIdx)}
                            className={`flex-1 min-w-[32px] h-12 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${
                              step.type === 'bass' ? 'bg-amber-900/40 border-amber-500 shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]' :
                              step.type === 'snare' ? 'bg-cyan-900/40 border-cyan-500 shadow-[inset_0_0_8px_rgba(6,182,212,0.2)]' :
                              'bg-[#070b0f] border-[#1e293b] opacity-40 hover:opacity-100'
                            }`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${step.type === 'bass' ? 'bg-amber-400' : step.type === 'snare' ? 'bg-cyan-400' : 'bg-slate-800'}`} />
                            <span className="text-[7px] font-black uppercase">
                              {step.type === 'none' ? '.' : step.type === 'bass' ? 'B' : 'S'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <footer className="flex items-center justify-between mt-2 pt-2 border-t border-[#16212e]">
                    <div className="flex gap-3">
                       <span className="text-[9px] text-slate-600 font-black uppercase">Curve</span>
                       <div className="flex gap-1.5">
                        {(['linear', 'exponential'] as InterpolationType[]).map(t => (
                          <button 
                            key={t}
                            onClick={() => updateSegment(seg.id, { interpolation: t })}
                            className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase transition-all ${seg.interpolation === t ? 'bg-slate-700 text-white border-slate-600' : 'bg-[#070b0f] text-slate-700 border-[#1a2b3c]'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[9px] text-slate-600 font-black uppercase italic">
                       {seg.type === 'ramp' ? `f: ${seg.startCarrierFreq}-${seg.endCarrierFreq}Hz` : `rhythm: 16th notes`}
                    </div>
                  </footer>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          <div className="flex gap-2">
            <button 
              onClick={() => addSegment('ramp')}
              className="flex-1 py-4 border-2 border-dashed border-[#1e293b] rounded-xl text-slate-600 hover:border-cyan-800 hover:text-cyan-500 transition-all flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              <span className="font-black uppercase tracking-widest text-[10px]">Append Ramp Phase</span>
            </button>
            <button 
              onClick={() => addSegment('beat')}
              className="flex-1 py-4 border-2 border-dashed border-[#1e293b] rounded-xl text-slate-600 hover:border-amber-800 hover:text-amber-500 transition-all flex items-center justify-center gap-2 group"
            >
              <Music className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="font-black uppercase tracking-widest text-[10px]">Append Beat Rhythm</span>
            </button>
          </div>
        </section>

        {/* Timeline Footer */}
        <footer className="bg-[#0d141e] border-t border-[#1e293b] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#070b0f] border border-[#1a2b3c] rounded text-[10px] text-slate-600 font-black uppercase tracking-tighter">
            <Lock className="w-3.5 h-3.5 text-rose-800" />
            Safety Interlock: Ramping Enforced
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Stereo-Coherent Output Active
          </div>
        </footer>
      </main>
    </div>
  );
};
