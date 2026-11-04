import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Square, 
  Database, 
  Zap, 
  Activity, 
  Clock, 
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useProtocols } from '../lib/useProtocols';
import { StimulationProtocol, ProtocolSegment } from '../types/telemetry';
import { SignalEngine } from '../audio/signalEngine';

interface PlayerProps {
  engine: SignalEngine | null;
  onPlayStateChange?: (playing: boolean) => void;
  externalStopTrigger?: number;
}

export const Player: React.FC<PlayerProps> = ({ engine, onPlayStateChange, externalStopTrigger }) => {
  const { protocols, isLoading } = useProtocols();
  const [selectedProtocol, setSelectedProtocol] = useState<StimulationProtocol | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Stats calculation
  const stats = useMemo(() => {
    if (!selectedProtocol) return null;
    const totalDurationMs = selectedProtocol.totalDurationMs;
    const leftSegments = selectedProtocol.channels.left.length;
    const rightSegments = selectedProtocol.channels.right.length;
    return {
      totalDurationMs,
      leftSegments,
      rightSegments,
      formattedDuration: new Date(totalDurationMs).toISOString().substr(14, 5)
    };
  }, [selectedProtocol]);

  useEffect(() => {
    if (externalStopTrigger && isPlaying) {
      if (engine) {
        engine.stop();
      }
      setIsPlaying(false);
      setStartTime(null);
      onPlayStateChange?.(false);
    }
  }, [externalStopTrigger]);

  useEffect(() => {
    let interval: number;
    if (isPlaying && startTime && selectedProtocol) {
      interval = window.setInterval(() => {
        const elapsed = (Date.now() - startTime);
        setElapsedTime(elapsed);
        const p = (elapsed / selectedProtocol.totalDurationMs) * 100;
        if (p >= 100) {
          stopProtocol();
        } else {
          setProgress(p);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, startTime, selectedProtocol]);

  const playProtocol = async () => {
    if (!selectedProtocol || !engine) return;
    
    try {
      await engine.scheduleProtocol(selectedProtocol);
      setStartTime(Date.now());
      setIsPlaying(true);
      setProgress(0);
      setElapsedTime(0);
      onPlayStateChange?.(true);
    } catch (error) {
      console.error("Playback failed:", error);
    }
  };

  const stopProtocol = () => {
    if (engine) {
      engine.stop();
    }
    setIsPlaying(false);
    setStartTime(null);
    setProgress(100);
    setElapsedTime(selectedProtocol?.totalDurationMs || 0);
    onPlayStateChange?.(false);
  };

  const resetProtocol = () => {
    if (engine) {
      engine.stop();
    }
    setIsPlaying(false);
    setStartTime(null);
    setProgress(0);
    setElapsedTime(0);
    onPlayStateChange?.(false);
  };

  const formatMs = (ms: number) => {
    return new Date(ms).toISOString().substr(14, 5);
  };

  return (
    <div className="flex flex-col h-full gap-4 font-mono">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        
        {/* Protocol Library Sidebar */}
        <aside className="lg:col-span-3 bg-[#0b1016] border border-[#1e293b] rounded-xl flex flex-col overflow-hidden">
          <div className="p-3 bg-[#131b26] border-b border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
              <Database className="w-3.5 h-3.5" />
              Protocol Library
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex items-center justify-center h-20 text-slate-500 text-[10px]">
                Loading library...
              </div>
            ) : protocols.length === 0 ? (
              <div className="text-center p-4 text-slate-500 text-[10px] italic">
                No saved protocols. Create one in the Composer.
              </div>
            ) : (
              protocols.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProtocol(p);
                    resetProtocol();
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-all group ${
                    selectedProtocol?.id === p.id 
                    ? 'bg-cyan-950/20 border-cyan-800' 
                    : 'bg-[#0e141c] border-transparent hover:border-[#23384f] hover:bg-[#121c27]'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.totalDurationMs).toISOString().substr(14, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {p.channels.left.length + p.channels.right.length} seg
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Player Interface */}
        <main className="lg:col-span-9 flex flex-col gap-4">
          
          {/* Main Control Panel */}
          <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-6 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
            
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none opacity-5">
              <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent" />
            </div>

            {!selectedProtocol ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
                  <Activity className="w-8 h-8 text-slate-700" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-400">SELECT A PROTOCOL</h3>
                  <p className="text-[10px] text-slate-600">Choose a saved sequence from the library to begin stimulation</p>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-8 z-10">
                {/* Protocol Info */}
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black text-slate-100 tracking-tighter uppercase">
                    {selectedProtocol.name}
                  </h2>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    {selectedProtocol.description || "No description provided."}
                  </p>
                </div>

                {/* Progress Circle / Display */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="96" cy="96" r="88"
                      className="stroke-[#131b26] fill-transparent"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="96" cy="96" r="88"
                      className="stroke-cyan-500 fill-transparent"
                      strokeWidth="8"
                      strokeDasharray="552.92"
                      animate={{ strokeDashoffset: 552.92 - (552.92 * progress) / 100 }}
                      transition={{ type: 'spring', damping: 20, stiffness: 50 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-1">
                    <span className="text-4xl font-black text-white tracking-tighter tabular-nums">
                      {formatMs(elapsedTime)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      / {stats?.formattedDuration}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
                  <AnimatePresence mode="wait">
                    {!isPlaying ? (
                      <motion.button
                        key="play"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={playProtocol}
                        className="w-20 h-20 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all group"
                      >
                        <Play className="w-10 h-10 fill-current group-hover:scale-110 transition-transform" />
                      </motion.button>
                    ) : (
                      <motion.button
                        key="stop"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={stopProtocol}
                        className="w-20 h-20 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.3)] transition-all group"
                      >
                        <Square className="w-8 h-8 fill-current group-hover:scale-110 transition-transform" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Segment Preview Bar */}
                <div className="w-full max-w-2xl space-y-2">
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    <span>Protocol Timeline</span>
                    <span>{Math.round(progress)}% Complete</span>
                  </div>
                  <div className="h-12 bg-[#0e141c] border border-[#1e293b] rounded-lg overflow-hidden flex relative">
                    {/* Progress Indicator Line */}
                    <motion.div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_white]"
                      animate={{ left: `${progress}%` }}
                      transition={{ ease: 'linear', duration: 0.1 }}
                    />
                    
                    {/* Channels Preview */}
                    <div className="flex-1 flex flex-col">
                      {/* Left Channel */}
                      <div className="flex-1 flex border-b border-[#1a2634]">
                        {selectedProtocol.channels.left.map((seg, idx) => (
                          <div 
                            key={idx}
                            style={{ width: `${(seg.durationSec * 1000 / selectedProtocol.totalDurationMs) * 100}%` }}
                            className={`h-full border-r border-[#1a2634] relative group/seg ${seg.type === 'beat' ? 'bg-cyan-900/40' : 'bg-slate-800/40'}`}
                          >
                            <div className="absolute inset-0 opacity-0 group-hover/seg:opacity-100 bg-white/5 transition-opacity flex items-center justify-center">
                              <span className="text-[8px] text-white whitespace-nowrap px-1 bg-black/50 rounded">{seg.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Right Channel */}
                      <div className="flex-1 flex">
                        {selectedProtocol.channels.right.map((seg, idx) => (
                          <div 
                            key={idx}
                            style={{ width: `${(seg.durationSec * 1000 / selectedProtocol.totalDurationMs) * 100}%` }}
                            className={`h-full border-r border-[#1a2634] relative group/seg ${seg.type === 'beat' ? 'bg-emerald-900/40' : 'bg-slate-800/40'}`}
                          >
                            <div className="absolute inset-0 opacity-0 group-hover/seg:opacity-100 bg-white/5 transition-opacity flex items-center justify-center">
                              <span className="text-[8px] text-white whitespace-nowrap px-1 bg-black/50 rounded">{seg.label}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hardware & Safety Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Leads Status */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
                <Zap className="w-3.5 h-3.5" />
                Connection Interface
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Probe L</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] text-emerald-400 font-bold">CONNECTED</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] text-slate-500 font-bold uppercase">Probe R</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] text-emerald-400 font-bold">CONNECTED</span>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-[#101720] rounded border border-[#1a2634] flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
                <span className="text-[9px] text-slate-400">ISOLATION BARRIER: <span className="text-cyan-400 font-bold">ACTIVE</span></span>
              </div>
            </div>

            {/* Safety Monitoring */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                Tissue Safety Monitor
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500">PEAK VOLTAGE</span>
                  <span className="text-[10px] text-slate-200 font-bold">12.4V</span>
                </div>
                <div className="h-1.5 bg-[#1a2634] rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 w-[40%]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500">CURRENT RMS</span>
                  <span className="text-[10px] text-slate-200 font-bold">8.2mA</span>
                </div>
                <div className="h-1.5 bg-[#1a2634] rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[25%]" />
                </div>
              </div>
            </div>

            {/* Protocol Summary */}
            <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-[#1e293b] pb-2">
                <Info className="w-3.5 h-3.5" />
                Execution Meta
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-[10px]">
                <div className="text-slate-500">SAMPLING</div>
                <div className="text-slate-200 font-bold text-right tracking-tight">48.0 KHZ</div>
                <div className="text-slate-500">BIT DEPTH</div>
                <div className="text-slate-200 font-bold text-right tracking-tight">32-BIT FLOAT</div>
                <div className="text-slate-500">LATENCY</div>
                <div className="text-slate-200 font-bold text-right tracking-tight">12.5 MS</div>
                <div className="text-slate-500">RAMP MODE</div>
                <div className="text-cyan-400 font-bold text-right tracking-tight">POPFREE-V2</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
