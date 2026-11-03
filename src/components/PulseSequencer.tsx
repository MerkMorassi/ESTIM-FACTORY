/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Multi-Step Duty-Cycle Array Sequencer
 * Controls rhythmic pulse rates and custom discrete amplitude/duty sequences
 * with 30ms pop-free envelope ramps on every step boundary.
 */

import React from 'react';
import { SequencerStep } from '../types/telemetry';
import { Sliders, Volume2, Bell } from 'lucide-react';

interface PulseSequencerProps {
  steps: SequencerStep[];
  currentStep: number;
  loopStart: number;
  loopEnd: number;
  syncClickEnabled: boolean;
  onUpdateSteps: (newSteps: SequencerStep[]) => void;
  onUpdateLoopRange: (start: number, end: number) => void;
  onToggleSyncClick: (enabled: boolean) => void;
}

export const PulseSequencer: React.FC<PulseSequencerProps> = ({
  steps,
  currentStep,
  loopStart,
  loopEnd,
  syncClickEnabled,
  onUpdateSteps,
  onUpdateLoopRange,
  onToggleSyncClick,
}) => {
  const toggleStepActive = (idx: number) => {
    const updated = steps.map((s, i) => (i === idx ? { ...s, active: !s.active } : s));
    onUpdateSteps(updated);
  };

  const updateStepAmp = (idx: number, amp: number) => {
    const updated = steps.map((s, i) => (i === idx ? { ...s, amplitude: amp } : s));
    onUpdateSteps(updated);
  };

  const setPresetPattern = (type: 'burst4' | 'ramp' | 'alternating' | 'all') => {
    let updated: SequencerStep[] = [];
    if (type === 'burst4') {
      updated = steps.map((s, i) => ({
        ...s,
        active: i < 4,
        amplitude: 1.0,
        dutyCycle: 0.5,
      }));
    } else if (type === 'ramp') {
      updated = steps.map((s, i) => ({
        ...s,
        active: true,
        amplitude: (i + 1) / steps.length,
        dutyCycle: 0.5,
      }));
    } else if (type === 'alternating') {
      updated = steps.map((s, i) => ({
        ...s,
        active: i % 2 === 0,
        amplitude: i % 2 === 0 ? 1.0 : 0.0,
        dutyCycle: 0.5,
      }));
    } else {
      updated = steps.map((s) => ({
        ...s,
        active: true,
        amplitude: 1.0,
        dutyCycle: 0.5,
      }));
    }
    onUpdateSteps(updated);
  };

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-3 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b] pb-2 text-slate-400">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <Sliders className="w-3.5 h-3.5" />
          MULTI-STEP DUTY-CYCLE PULSE ARRAY (8-STEP MATRIX)
        </span>

        <div className="flex items-center gap-3">
          {/* Loop Range Settings */}
          <div className="flex items-center gap-2 px-3 py-1 bg-[#101720] border border-[#1e293b] rounded text-[10px]">
            <span className="text-slate-500 font-bold uppercase tracking-tighter">Loop Range:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max={loopEnd}
                value={loopStart}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value));
                  onUpdateLoopRange(Math.min(val, loopEnd), loopEnd);
                }}
                className="w-8 bg-[#070b0f] border border-[#1e293b] text-cyan-400 px-1 py-0.5 rounded text-center focus:outline-none focus:border-cyan-500"
              />
              <span className="text-slate-600">to</span>
              <input
                type="number"
                min={loopStart}
                max={steps.length - 1}
                value={loopEnd}
                onChange={(e) => {
                  const val = Math.min(steps.length - 1, Number(e.target.value));
                  onUpdateLoopRange(loopStart, Math.max(val, loopStart));
                }}
                className="w-8 bg-[#070b0f] border border-[#1e293b] text-cyan-400 px-1 py-0.5 rounded text-center focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <span className="text-slate-600">|</span>

          {/* Quick patterns */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPresetPattern('all')}
              className="px-2 py-0.5 bg-[#15202c] hover:bg-[#1f2d3d] text-slate-300 rounded text-[10px]"
            >
              ALL ON
            </button>
            <button
              type="button"
              onClick={() => setPresetPattern('burst4')}
              className="px-2 py-0.5 bg-[#15202c] hover:bg-[#1f2d3d] text-slate-300 rounded text-[10px]"
            >
              4-BURST
            </button>
            <button
              type="button"
              onClick={() => setPresetPattern('alternating')}
              className="px-2 py-0.5 bg-[#15202c] hover:bg-[#1f2d3d] text-slate-300 rounded text-[10px]"
            >
              ALT
            </button>
            <button
              type="button"
              onClick={() => setPresetPattern('ramp')}
              className="px-2 py-0.5 bg-[#15202c] hover:bg-[#1f2d3d] text-slate-300 rounded text-[10px]"
            >
              RAMP
            </button>
          </div>

          <span className="text-slate-600">|</span>

          {/* Sync Click Toggle */}
          <button
            type="button"
            onClick={() => onToggleSyncClick(!syncClickEnabled)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
              syncClickEnabled
                ? 'bg-amber-950 text-amber-300 border border-amber-700'
                : 'bg-[#15202c] text-slate-500 hover:text-slate-300'
            }`}
          >
            <Bell className="w-3 h-3" />
            SYNC CLICK: {syncClickEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Step Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {steps.map((step, idx) => {
          const isCurrent = currentStep === idx;
          const isInLoop = idx >= loopStart && idx <= loopEnd;
          return (
            <div
              key={idx}
              className={`flex flex-col items-center gap-2 p-2 rounded border transition-all ${
                isCurrent
                  ? 'bg-[#142332] border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : isInLoop
                  ? 'bg-[#0f1822] border-cyan-900/50'
                  : step.active
                  ? 'bg-[#0f1822] border-[#223347]'
                  : 'bg-[#0a0f15] border-[#16212e] opacity-60'
              }`}
            >
              {/* Step indicator header */}
              <div className="flex items-center justify-between w-full text-[10px]">
                <div className="flex items-center gap-1">
                  <span className={isCurrent ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
                    #{idx + 1}
                  </span>
                  {isInLoop && !isCurrent && (
                    <span className="text-[8px] text-cyan-700 font-bold uppercase tracking-tighter">Loop</span>
                  )}
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isCurrent
                      ? 'bg-cyan-400 shadow-[0_0_6px_#00f0ff]'
                      : step.active
                      ? 'bg-emerald-500'
                      : 'bg-slate-700'
                  }`}
                />
              </div>

              {/* Vertical amplitude slider bar */}
              <div className="relative w-full h-20 bg-[#070b0f] rounded flex items-end justify-center p-1 border border-[#172230]">
                <div
                  className={`w-full rounded-sm transition-all ${
                    step.active
                      ? isCurrent
                        ? 'bg-gradient-to-t from-cyan-600 to-cyan-300'
                        : 'bg-gradient-to-t from-slate-700 to-slate-400'
                      : 'bg-slate-800'
                  }`}
                  style={{ height: `${Math.round(step.amplitude * 100)}%` }}
                />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={step.amplitude}
                  disabled={!step.active}
                  onChange={(e) => updateStepAmp(idx, Number(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-ns-resize"
                  title={`Step ${idx + 1} Amplitude: ${Math.round(step.amplitude * 100)}%`}
                />
              </div>

              {/* Step amplitude label */}
              <span className="text-[10px] text-slate-400 font-mono">
                {step.active ? `${Math.round(step.amplitude * 100)}%` : 'MUTED'}
              </span>

              {/* Step Toggle Button */}
              <button
                type="button"
                onClick={() => toggleStepActive(idx)}
                className={`w-full py-1 text-[10px] font-bold rounded transition-colors ${
                  step.active
                    ? 'bg-[#1b2b3b] text-cyan-300 hover:bg-[#25394e]'
                    : 'bg-[#111922] text-slate-600 hover:text-slate-400'
                }`}
              >
                {step.active ? 'GATE' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
