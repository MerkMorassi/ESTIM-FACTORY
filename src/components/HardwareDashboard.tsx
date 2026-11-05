/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Stereo Hardware Dashboard & VU Console
 * Real-time monitoring of dual-channel telemetry and output magnitude.
 */

import React, { useEffect, useRef, useState } from 'react';
import { SignalEngine } from '../audio/signalEngine';
import { SignalParameters } from '../types/telemetry';
import { motion, AnimatePresence } from 'motion/react';
import { Power, Zap, Activity, ShieldCheck, Speaker, Split } from 'lucide-react';

interface HardwareDashboardProps {
  engine: SignalEngine | null;
  isRunning: boolean;
  onTogglePower: () => void;
  params: { left: SignalParameters; right: SignalParameters };
}

export const HardwareDashboard: React.FC<HardwareDashboardProps> = ({
  engine,
  isRunning,
  onTogglePower,
  params,
}) => {
  const [levels, setLevels] = useState({ 
    left: { peak: 0, rms: 0 }, 
    right: { peak: 0, rms: 0 } 
  });
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (engine && isRunning) {
        setLevels({
          left: engine.getLevels('left'),
          right: engine.getLevels('right'),
        });
      } else {
        setLevels({ left: { peak: 0, rms: 0 }, right: { peak: 0, rms: 0 } });
      }
      requestRef.current = requestAnimationFrame(update);
    };
    requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [engine, isRunning]);

  const ledCount = 12;
  const renderMeter = (data: { peak: number, rms: number }, color: string, label: string) => (
    <div className="flex flex-col gap-2 flex-1">
      <div className="flex items-center justify-between text-[8px] text-slate-500 font-black uppercase tracking-tighter">
        <span>{label}</span>
        <span className={data.peak > 0.9 ? 'text-rose-500' : ''}>{Math.round(data.rms * 100)}%</span>
      </div>
      <div className="flex gap-1 h-8 items-end">
        {Array.from({ length: ledCount }).map((_, i) => {
          const threshold = (i + 1) / ledCount;
          const isPeak = data.peak >= threshold;
          const isRms = data.rms >= threshold;
          let cls = 'bg-slate-900';
          if (isPeak) {
             if (i >= 10) cls = 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
             else if (i >= 7) cls = 'bg-amber-400 shadow-[0_0_8px_#fbbf24]';
             else cls = `${color} shadow-[0_0_8px_currentColor]`;
          } else if (isRms) {
             cls = i >= 10 ? 'bg-rose-900' : i >= 7 ? 'bg-amber-900' : 'bg-slate-700';
          }
          return <div key={i} className={`flex-1 h-full rounded-sm transition-all duration-75 ${cls}`} />;
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-xl p-5 flex flex-col gap-5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">Dual-Stim Hardware Console</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
            <span className={`text-[9px] font-bold uppercase tracking-widest ${isRunning ? 'text-emerald-400' : 'text-slate-500'}`}>{isRunning ? 'TRANSMITTING' : 'STANDBY'}</span>
          </div>
        </div>

        <button onClick={onTogglePower} className={`group relative w-12 h-12 rounded-full border-2 transition-all ${isRunning ? 'bg-rose-950/30 border-rose-600 shadow-[0_0_15px_rgba(225,29,72,0.3)]' : 'bg-slate-900 border-slate-700 hover:border-emerald-600'}`}>
          <Power className={`w-5 h-5 m-auto ${isRunning ? 'text-rose-400' : 'text-slate-600 group-hover:text-emerald-400'}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="bg-[#070b0f] p-4 rounded-lg border border-[#16202c] flex flex-col gap-4">
          {renderMeter(levels.left, 'text-cyan-400 bg-cyan-400', 'CH1 (Left)')}
          {renderMeter(levels.right, 'text-emerald-400 bg-emerald-400', 'CH2 (Right)')}
        </div>

        <div className="flex flex-col gap-3">
          <div className="bg-[#101720] border border-[#1a2634] p-3 rounded-lg flex items-center gap-4 relative overflow-hidden">
            <AnimatePresence>{isRunning && <motion.div animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 bg-cyan-500/5" />}</AnimatePresence>
            <div className={`p-2 rounded-full ${isRunning ? 'bg-cyan-950 text-cyan-400' : 'bg-slate-800 text-slate-700'}`}><Speaker className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
               <div className="text-[8px] font-black text-slate-500 uppercase">Stereo Magnitude</div>
               <div className="h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                 <div className="h-full bg-cyan-500 transition-all" style={{ width: `${((params.left.masterVolume + params.right.masterVolume)/2) * 100}%` }} />
               </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#070b0f] border border-[#16202c] p-2 rounded flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-cyan-400' : 'bg-slate-800'}`} />
              <span className="text-[8px] text-slate-400 font-bold uppercase truncate">LEAD A: OK</span>
            </div>
            <div className="bg-[#070b0f] border border-[#16202c] p-2 rounded flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-slate-800'}`} />
              <span className="text-[8px] text-slate-400 font-bold uppercase truncate">LEAD B: OK</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Advanced Signal Link</div>
          <button 
            onClick={() => engine?.setCrossChannelFM(!params.left.crossChannelFM)}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${params.left.crossChannelFM ? 'bg-cyan-950/30 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <Split className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Cross-Channel FM</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${params.left.crossChannelFM ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]' : 'bg-slate-800'}`} />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Skin Environment</div>
          <button 
            onClick={() => engine?.setSimulatedSweat(!params.left.simulatedSweat)}
            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${params.left.simulatedSweat ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase">Simulated Sweat</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${params.left.simulatedSweat ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-slate-800'}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-[8px] text-slate-500 bg-[#0d141e] p-3 rounded border border-[#172230]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>STEREO OUTPUT: 2 AUDIO CHANNELS. CHANNEL ISOLATION DEPENDS ON YOUR STIM BOX.</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[7px] text-slate-600 font-black">CH1 IMPEDANCE</span>
            <span className={`text-[10px] font-mono font-bold ${params.left.simulatedSweat ? 'text-emerald-400' : 'text-slate-400'}`}>
              {Math.round(engine?.getCurrentImpedance('left') || 1000)} Ω
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[7px] text-slate-600 font-black">CH2 IMPEDANCE</span>
            <span className={`text-[10px] font-mono font-bold ${params.right.simulatedSweat ? 'text-emerald-400' : 'text-slate-400'}`}>
              {Math.round(engine?.getCurrentImpedance('right') || 1000)} Ω
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
