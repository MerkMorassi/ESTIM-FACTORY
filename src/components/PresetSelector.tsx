/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standard Telemetry Presets for Electro-Stimulation Simulation Research
 */

import React from 'react';
import { TelemetryPreset, DualChannelPreset } from '../types/telemetry';
import { Bookmark, Layers } from 'lucide-react';

export const CLINICAL_TENS_PRESETS: TelemetryPreset[] = [
  {
    id: 'interferential-4k',
    name: 'INTERFERENTIAL CARRIER',
    description: '4000 Hz sinusoidal carrier with 100 Hz beat modulation. Minimizes skin impedance for deep penetrative recruitment.',
    carrierFreq: 4000,
    carrierWave: 'sine',
    modFreq: 100,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 100,
    targetImpedanceOhms: 450,
  },
  {
    id: 'tens-symmetrical-1200',
    name: 'TENS BIPHASIC MODULATION',
    description: '1200 Hz symmetrical triangular carrier with 80 Hz rhythmic rate. Symmetrical recruitment contour.',
    carrierFreq: 1200,
    carrierWave: 'triangle',
    modFreq: 80,
    modWave: 'triangle',
    modDepth: 0.85,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 1100,
  },
  {
    id: 'tonic-relaxation-20',
    name: 'TONIC RELAXATION SCAN (20Hz)',
    description: '20 Hz ultra-low frequency for pelvic floor relaxation research and parasympathetic mapping.',
    carrierFreq: 20,
    carrierWave: 'sine',
    modFreq: 2,
    modWave: 'sine',
    modDepth: 0.6,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 2800,
  },
];

export const NEUROMUSCULAR_PRESETS: TelemetryPreset[] = [
  {
    id: 'russian-2500',
    name: 'RUSSIAN BURST PROTOCOL',
    description: '2500 Hz sinusoidal carrier modulated into 50 Hz discrete burst packets (10ms on, 10ms off 50% duty cycle).',
    carrierFreq: 2500,
    carrierWave: 'sine',
    modFreq: 50,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'burst',
    dutyCycle: 0.5,
    burstDurationMs: 10,
    targetImpedanceOhms: 650,
  },
  {
    id: 'deep-pelvic-30',
    name: 'DEEP MOTOR RECRUITMENT (30Hz)',
    description: '30 Hz motor-nerve carrier for pelvic floor muscle activation and tonic response research.',
    carrierFreq: 30,
    carrierWave: 'sine',
    modFreq: 5,
    modWave: 'triangle',
    modDepth: 0.8,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 2500,
  },
  {
    id: 'sequenced-recruitment',
    name: '8-STEP RECRUITMENT RAMP',
    description: '2000 Hz carrier through an 8-step crescendo pulse matrix with 30ms pop-free envelope ramps.',
    carrierFreq: 2000,
    carrierWave: 'sine',
    modFreq: 12,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'sequenced',
    dutyCycle: 0.5,
    burstDurationMs: 40,
    targetImpedanceOhms: 800,
  },
  {
    id: 'climbing-crescendo',
    name: 'SEQUENCED CRESCENDO (CLIMB)',
    description: '120 Hz carrier through an 8-step crescendo pulse matrix. Simulates intensity ramp protocols.',
    carrierFreq: 120,
    carrierWave: 'sine',
    modFreq: 15,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'sequenced',
    dutyCycle: 0.5,
    burstDurationMs: 40,
    targetImpedanceOhms: 1900,
  },
  {
    id: 'burst-reflex-150',
    name: 'HIGH-FREQ BURST REFLEX',
    description: '150 Hz carrier in 100ms burst packets. Calibrated for rapid reflex response telemetry.',
    carrierFreq: 150,
    carrierWave: 'sine',
    modFreq: 2,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'burst',
    dutyCycle: 0.5,
    burstDurationMs: 100,
    targetImpedanceOhms: 1700,
  },
];

export const EXPERIENCE_PROTOCOLS: TelemetryPreset[] = [
  {
    id: 'phase-swirl',
    name: 'PHASE-ROTATIONAL SWIRL',
    description: '100Hz Sine carrier with 180° phase offset. Creates a sensation of spatial "movement" between electrodes.',
    carrierFreq: 100,
    carrierWave: 'sine',
    modFreq: 8,
    modWave: 'sine',
    modDepth: 0.8,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 1800,
  },
  {
    id: 'edge-crescendo',
    name: 'THE EDGE CRESCENDO',
    description: 'Sequenced 8-step build-up with a sudden drop-out on step 8 to prevent sensory overload and build tension.',
    carrierFreq: 2500,
    carrierWave: 'sine',
    modFreq: 15,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'sequenced',
    dutyCycle: 0.5,
    burstDurationMs: 40,
    targetImpedanceOhms: 650,
  },
  {
    id: 'harmonic-scan',
    name: 'NERVE-FIBER HARMONIC SCAN',
    description: '4000Hz high-carrier targets deep tissue with ultra-slow (0.5Hz) triangle modulation for rolling recruitment.',
    carrierFreq: 4000,
    carrierWave: 'sine',
    modFreq: 0.5,
    modWave: 'triangle',
    modDepth: 1.0,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 450,
  },
  {
    id: 'gallop-sequence',
    name: 'THE GALLOP SEQUENCE',
    description: 'Non-metronomic "urgent" rhythmic pulse sequence at 130 BPM. Urgent recruitment profile.',
    carrierFreq: 120,
    carrierWave: 'triangle',
    modFreq: 10,
    modWave: 'sine',
    modDepth: 0.7,
    mode: 'burst',
    dutyCycle: 0.3,
    burstDurationMs: 80,
    targetImpedanceOhms: 1900,
  },
  {
    id: 'somatic-breath',
    name: 'SOMATIC BREATH',
    description: 'Ultra-low 20Hz carrier with 4Hz sine modulation. Mimics deep biological breathing rhythms for relaxation research.',
    carrierFreq: 20,
    carrierWave: 'sine',
    modFreq: 4,
    modWave: 'sine',
    modDepth: 0.5,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 2800,
  },
];

export const SENSORY_MAPPING_PRESETS: TelemetryPreset[] = [
  {
    id: 'prostate-sensory-100',
    name: 'SENSORY MAPPING (100Hz)',
    description: '100 Hz continuous sine for conductive silicone probes. Calibrated for standard A-beta sensory threshold mapping.',
    carrierFreq: 100,
    carrierWave: 'sine',
    modFreq: 10,
    modWave: 'sine',
    modDepth: 0.4,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 1800,
  },
  {
    id: 'arousal-pulsed-80',
    name: 'PULSED AROUSAL PROFILE (80Hz)',
    description: '80 Hz rhythmic rate optimized for arousal response mapping and mucosal recruitment.',
    carrierFreq: 80,
    carrierWave: 'sine',
    modFreq: 25,
    modWave: 'sine',
    modDepth: 1.0,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 50,
    targetImpedanceOhms: 2100,
  },
  {
    id: 'soft-sensory-800',
    name: 'LOW-FREQUENCY SENSORY SCAN',
    description: '800 Hz low-carrier baseline with 20 Hz delta-rate modulation for baseline surface impedance mapping.',
    carrierFreq: 800,
    carrierWave: 'triangle',
    modFreq: 20,
    modWave: 'sine',
    modDepth: 0.70,
    mode: 'continuous',
    dutyCycle: 0.5,
    burstDurationMs: 60,
    targetImpedanceOhms: 1650,
  },
];

export const DUAL_STIM_LABIAL_VAGINAL: DualChannelPreset[] = [
  {
    id: 'lv-sync-sensory',
    name: 'PUDENDAL + INTRAVAGINAL SYNC',
    description: 'Synchronized sensory mapping for labial and intravaginal recruitment research.',
    left: { carrierFreq: 100, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 0.5, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1800 },
    right: { carrierFreq: 100, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 0.5, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1500 },
  },
  {
    id: 'lv-cross-rate',
    name: 'LV CROSS-RATE RECRUITMENT',
    description: 'Dual-frequency mapping for complex pelvic floor sensory response telemetry.',
    left: { carrierFreq: 80, carrierWave: 'sine', modFreq: 20, modWave: 'sine', modDepth: 0.8, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2100 },
    right: { carrierFreq: 120, carrierWave: 'triangle', modFreq: 5, modWave: 'sine', modDepth: 1.0, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1900 },
  },
  {
    id: 'lv-burst-tonic',
    name: 'LV BURST-TONIC PROFILE',
    description: 'External burst stimulation with internal tonic relaxation carrier mapping.',
    left: { carrierFreq: 150, carrierWave: 'sine', modFreq: 5, modWave: 'sine', modDepth: 1.0, mode: 'burst', dutyCycle: 0.5, burstDurationMs: 100, targetImpedanceOhms: 1700 },
    right: { carrierFreq: 30, carrierWave: 'sine', modFreq: 2, modWave: 'sine', modDepth: 0.4, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2500 },
  },
  {
    id: 'lv-crescendo-duo',
    name: 'LV SEQUENCED CRESCENDO',
    description: 'Dual-path crescendo matrix for threshold research across labial and vaginal sensors.',
    left: { carrierFreq: 120, carrierWave: 'sine', modFreq: 15, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 1900 },
    right: { carrierFreq: 100, carrierWave: 'sine', modFreq: 15, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 1800 },
  },
  {
    id: 'binaural-tissue-beat',
    name: 'BINAURAL TISSUE BEAT',
    description: '100Hz (L) vs 102Hz (R). Generates a deep 2Hz interference beat directly within the nerve clusters.',
    left: { carrierFreq: 100, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 0.8, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1800 },
    right: { carrierFreq: 102, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 0.8, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1500 },
  },
];

export const DUAL_STIM_PENILE_RECTAL: DualChannelPreset[] = [
  {
    id: 'pr-harmonic-sync',
    name: 'EXTERNAL + INTRARECTAL SYNC',
    description: 'Calibrated sync stimulus for external genital and deep intrarectal response mapping.',
    left: { carrierFreq: 100, carrierWave: 'sine', modFreq: 12, modWave: 'sine', modDepth: 0.6, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1900 },
    right: { carrierFreq: 80, carrierWave: 'sine', modFreq: 12, modWave: 'sine', modDepth: 0.6, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2300 },
  },
  {
    id: 'pr-tonic-reflex',
    name: 'PR TONIC-REFLEX MAPPING',
    description: 'Internal tonic relaxation with external reflex burst telemetry.',
    left: { carrierFreq: 150, carrierWave: 'sine', modFreq: 3, modWave: 'sine', modDepth: 1.0, mode: 'burst', dutyCycle: 0.5, burstDurationMs: 80, targetImpedanceOhms: 1700 },
    right: { carrierFreq: 20, carrierWave: 'sine', modFreq: 2, modWave: 'sine', modDepth: 0.5, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2800 },
  },
  {
    id: 'pr-climb-pulse',
    name: 'PR DUAL-CLIMB PROTOCOL',
    description: 'Synchronized crescendo sequences for deep neuromuscular recruitment research.',
    left: { carrierFreq: 120, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 1900 },
    right: { carrierFreq: 120, carrierWave: 'sine', modFreq: 10, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 2100 },
  },
  {
    id: 'pr-cross-theta',
    name: 'PR CROSS-THETA SCAN',
    description: 'Theta-rate modulation across external and internal pelvic nerve pathways.',
    left: { carrierFreq: 1000, carrierWave: 'sine', modFreq: 7, modWave: 'sine', modDepth: 1.0, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1200 },
    right: { carrierFreq: 800, carrierWave: 'triangle', modFreq: 4, modWave: 'sine', modDepth: 0.8, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 1400 },
  },
];

export const DUAL_STIM_LABIAL_ANORECTAL: DualChannelPreset[] = [
  {
    id: 'la-sync-recruitment',
    name: 'PUDENDAL + ANORECTAL SYNC',
    description: 'Coordinated recruitment for external labial and anorectal stimulation profiling.',
    left: { carrierFreq: 80, carrierWave: 'sine', modFreq: 15, modWave: 'sine', modDepth: 0.7, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2100 },
    right: { carrierFreq: 80, carrierWave: 'sine', modFreq: 15, modWave: 'sine', modDepth: 0.7, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2400 },
  },
  {
    id: 'la-delta-burst',
    name: 'LA DELTA-BURST REFLEX',
    description: 'Ultra-low delta rate modulation with internal burst reflex tracking.',
    left: { carrierFreq: 2500, carrierWave: 'sine', modFreq: 1.5, modWave: 'sine', modDepth: 1.0, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 650 },
    right: { carrierFreq: 150, carrierWave: 'sine', modFreq: 1.5, modWave: 'sine', modDepth: 1.0, mode: 'burst', dutyCycle: 0.5, burstDurationMs: 120, targetImpedanceOhms: 1700 },
  },
  {
    id: 'la-ramp-matrix',
    name: 'LA RAMP-MATRIX PROTOCOL',
    description: '8-step ramp matrix for comparative threshold telemetry between sites.',
    left: { carrierFreq: 100, carrierWave: 'sine', modFreq: 20, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 1800 },
    right: { carrierFreq: 100, carrierWave: 'sine', modFreq: 20, modWave: 'sine', modDepth: 1.0, mode: 'sequenced', dutyCycle: 0.5, burstDurationMs: 40, targetImpedanceOhms: 2200 },
  },
  {
    id: 'la-theta-arousal',
    name: 'LA THETA AROUSAL PROFILE',
    description: 'Calibrated arousal mapping for pudendal and anorectal nerve centers.',
    left: { carrierFreq: 80, carrierWave: 'sine', modFreq: 8, modWave: 'sine', modDepth: 1.0, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2100 },
    right: { carrierFreq: 120, carrierWave: 'sine', modFreq: 8, modWave: 'sine', modDepth: 1.0, mode: 'continuous', dutyCycle: 0.5, burstDurationMs: 50, targetImpedanceOhms: 2000 },
  },
];

interface PresetSelectorProps {
  activePresetId: string | null;
  onSelectPreset: (preset: TelemetryPreset) => void;
  onSelectDualPreset: (preset: DualChannelPreset) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  activePresetId,
  onSelectPreset,
  onSelectDualPreset,
}) => {
  const renderPresetGrid = (presets: TelemetryPreset[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
      {presets.map((p) => {
        const isSelected = activePresetId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPreset(p)}
            className={`text-left p-2.5 rounded border transition-all flex flex-col justify-between gap-1.5 ${
              isSelected
                ? 'bg-[#152535] border-cyan-400 shadow-[0_0_8px_rgba(0,240,255,0.2)] text-slate-100'
                : 'bg-[#0f1722] border-[#1d2a3a] text-slate-400 hover:text-slate-200 hover:border-[#2d4158]'
            }`}
          >
            <div>
              <div className={`font-bold text-[11px] ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                {p.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {p.description}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-[#1d2b3c] pt-1.5 mt-1 font-mono">
              <span>fc: {p.carrierFreq}Hz</span>
              <span>fm: {p.modFreq}Hz</span>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderDualGrid = (presets: DualChannelPreset[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
      {presets.map((p) => {
        const isSelected = activePresetId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectDualPreset(p)}
            className={`text-left p-2.5 rounded border transition-all flex flex-col justify-between gap-2 ${
              isSelected
                ? 'bg-[#1a2e3f] border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.2)] text-slate-100'
                : 'bg-[#0f1b25] border-[#1d3544] text-slate-400 hover:text-slate-200 hover:border-[#2d5265]'
            }`}
          >
            <div>
              <div className={`font-bold text-[11px] ${isSelected ? 'text-emerald-300' : 'text-slate-300'}`}>
                {p.name}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                {p.description}
              </div>
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-[#1d3b4d] pt-1.5 mt-1 font-mono uppercase tracking-tighter">
              <span className="flex flex-col">
                <span className="text-[8px] text-slate-600">CH1 (L)</span>
                {p.left.carrierFreq}Hz / {p.left.modFreq}Hz
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex flex-col text-right">
                <span className="text-[8px] text-slate-600">CH2 (R)</span>
                {p.right.carrierFreq}Hz / {p.right.modFreq}Hz
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-8 font-mono text-xs">
      {/* MONO BANKS */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Bookmark className="w-3.5 h-3.5" />
              CLINICAL TENS PROTOCOLS
            </span>
          </div>
          {renderPresetGrid(CLINICAL_TENS_PRESETS)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Bookmark className="w-3.5 h-3.5" />
              ADVANCED EXPERIENCE PROTOCOLS
            </span>
          </div>
          {renderPresetGrid(EXPERIENCE_PROTOCOLS)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <Bookmark className="w-3.5 h-3.5" />
              NEUROMUSCULAR (EMS) & RECRUITMENT
            </span>
          </div>
          {renderPresetGrid(NEUROMUSCULAR_PRESETS)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <Bookmark className="w-3.5 h-3.5" />
              SENSORY MAPPING & AROUSAL
            </span>
          </div>
          {renderPresetGrid(SENSORY_MAPPING_PRESETS)}
        </div>
      </div>

      {/* DUAL STIM STEREO BANKS */}
      <div className="space-y-8 pt-4 border-t border-[#1e293b]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-black tracking-widest uppercase">
              <Layers className="w-4 h-4" />
              Dual-Stim: PUDENDAL + INTRAVAGINAL
            </span>
          </div>
          {renderDualGrid(DUAL_STIM_LABIAL_VAGINAL)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-400 font-black tracking-widest uppercase">
              <Layers className="w-4 h-4" />
              Dual-Stim: EXTERNAL GENITAL + INTRARECTAL
            </span>
          </div>
          {renderDualGrid(DUAL_STIM_PENILE_RECTAL)}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-500 font-black tracking-widest uppercase">
              <Layers className="w-4 h-4" />
              Dual-Stim: PUDENDAL + ANORECTAL
            </span>
          </div>
          {renderDualGrid(DUAL_STIM_LABIAL_ANORECTAL)}
        </div>
      </div>
    </div>
  );
};
