/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Ayurvedic Harmonics Module
 * Additive synthesis with ADSR envelopes and A432 tuning.
 */

import React, { useState, useEffect, useRef } from 'react';
import { HarmonicEngine, HarmonicParams, ADSRParams } from '../audio/harmonicEngine';
import { Music, Play, Square, Zap, Sliders, Wind } from 'lucide-react';

const INITIAL_ADSR: ADSRParams = {
  attack: 0.5,
  decay: 0.8,
  sustain: 0.6,
  release: 1.2,
};

const INITIAL_HARMONIC_PARAMS: HarmonicParams = {
  baseFreq: 108, // Default sacred frequency
  masterVolume: 0.5,
  harmonicCount: 8,
  harmonicSlope: 0.7,
  adsr: INITIAL_ADSR,
};

interface AyurvedicHarmonicsProps {
  onDroneToggle?: (active: boolean) => void;
  externalStopTrigger?: number;
}

export const AyurvedicHarmonics: React.FC<AyurvedicHarmonicsProps> = ({
  onDroneToggle,
  externalStopTrigger,
}) => {
  const [params, setParams] = useState<HarmonicParams>(INITIAL_HARMONIC_PARAMS);
  const [isActive, setIsActive] = useState<boolean>(false);
  const engineRef = useRef<HarmonicEngine | null>(null);

  useEffect(() => {
    engineRef.current = new HarmonicEngine(params);
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (externalStopTrigger && isActive && engineRef.current) {
      engineRef.current.triggerRelease();
      setIsActive(false);
    }
  }, [externalStopTrigger]);

  const handleToggle = async () => {
    if (!engineRef.current) return;
    
    if (isActive) {
      engineRef.current.triggerRelease();
      setIsActive(false);
      onDroneToggle?.(false);
    } else {
      await engineRef.current.init();
      engineRef.current.triggerAttack();
      setIsActive(true);
      onDroneToggle?.(true);
    }
  };

  const updateFreq = (freq: number) => {
    setParams(p => ({ ...p, baseFreq: freq }));
    engineRef.current?.setBaseFrequency(freq);
  };

  const updateVol = (vol: number) => {
    setParams(p => ({ ...p, masterVolume: vol }));
    engineRef.current?.setMasterVolume(vol);
  };

  const updateHarmonicCount = (count: number) => {
    setParams(p => ({ ...p, harmonicCount: count }));
    engineRef.current?.updateParams({ harmonicCount: count });
  };

  const updateSlope = (slope: number) => {
    setParams(p => ({ ...p, harmonicSlope: slope }));
    engineRef.current?.updateParams({ harmonicSlope: slope });
  };

  const updateADSR = (key: keyof ADSRParams, val: number) => {
    const nextADSR = { ...params.adsr, [key]: val };
    setParams(p => ({ ...p, adsr: nextADSR }));
    engineRef.current?.updateParams({ adsr: nextADSR });
  };

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-6 flex flex-col gap-6 font-mono text-xs shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-4">
        <div className="flex items-center gap-3">
          <Wind className="w-5 h-5 text-emerald-400" />
          <h2 className="text-sm font-black tracking-widest text-slate-300 uppercase">
            Ayurvedic Harmonic Oscillator
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
            A4 = 432 Hz
          </span>
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-6 py-2 rounded font-black transition-all ${
              isActive 
                ? 'bg-rose-950 text-rose-300 border border-rose-700 shadow-[0_0_15px_rgba(244,63,94,0.2)]' 
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            }`}
          >
            {isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isActive ? 'STOP DRONE' : 'START DRONE'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Frequency & Master Volume */}
        <div className="flex flex-col gap-6 bg-[#080d12] p-5 rounded-xl border border-[#16202c]">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] uppercase text-slate-500 font-black tracking-tighter">Base Frequency</label>
              <span className="text-cyan-400 text-lg font-black">{params.baseFreq} Hz</span>
            </div>
            <input
              type="range"
              min="10"
              max="20000"
              step="1"
              value={params.baseFreq}
              onChange={(e) => updateFreq(Number(e.target.value))}
              className="w-full h-2 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[9px] text-slate-600 font-bold px-1">
              <span>10 Hz</span>
              <button onClick={() => updateFreq(108)} className="hover:text-cyan-400">108 Hz (OM)</button>
              <button onClick={() => updateFreq(432)} className="hover:text-cyan-400">432 Hz (A4)</button>
              <span>20 kHz</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <label className="text-[10px] uppercase text-slate-500 font-black tracking-tighter">Master Volume</label>
              <span className="text-slate-300 font-bold">{Math.round(params.masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.masterVolume}
              onChange={(e) => updateVol(Number(e.target.value))}
              className="w-full h-1.5 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase text-slate-500 font-black">Harmonic Count</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="12"
                  step="1"
                  value={params.harmonicCount}
                  onChange={(e) => updateHarmonicCount(Number(e.target.value))}
                  className="flex-1 h-1 bg-[#1e293b] rounded-lg accent-emerald-500"
                />
                <span className="text-emerald-400 font-bold w-4">{params.harmonicCount}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase text-slate-500 font-black">Harmonic Tilt</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.harmonicSlope}
                onChange={(e) => updateSlope(Number(e.target.value))}
                className="w-full h-1 bg-[#1e293b] rounded-lg accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* ADSR Envelope Controls */}
        <div className="flex flex-col gap-4 bg-[#080d12] p-5 rounded-xl border border-[#16202c]">
          <div className="flex items-center gap-2 mb-2 text-slate-500">
            <Sliders className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Envelope (ADSR)</span>
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            {(Object.keys(INITIAL_ADSR) as Array<keyof ADSRParams>).map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex justify-between text-[9px] uppercase font-black tracking-tight text-slate-600">
                  <span>{key}</span>
                  <span className="text-emerald-500/80">{key === 'sustain' ? `${Math.round(params.adsr[key] * 100)}%` : `${params.adsr[key]}s`}</span>
                </div>
                <input
                  type="range"
                  min={key === 'sustain' ? 0 : 0.01}
                  max={key === 'sustain' ? 1 : 2.0}
                  step={0.01}
                  value={params.adsr[key]}
                  onChange={(e) => updateADSR(key, Number(e.target.value))}
                  className="w-full h-1 bg-[#1e293b] rounded-lg accent-emerald-400"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded bg-[#0b141e] border border-[#1a2b3c] flex items-center gap-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <p className="text-[10px] leading-relaxed text-slate-500">
              <strong className="text-slate-400">Acoustic Invariant:</strong> The harmonic series is tuned to the natural Pythagorean ratios. Attack and Release durations are strictly enforced with high-precision sub-millisecond scheduling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
