/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Target Impedance & Telemetry Profiling Module
 * Simulates electrode-tissue frequency-dependent complex impedance Z(f),
 * sensory recruitment curves, current density, and phase charge metrics.
 */

import React from 'react';
import { ImpedanceModel, SignalParameters } from '../types/telemetry';
import { Cpu, ShieldCheck, Zap } from 'lucide-react';

interface ImpedanceProfilerProps {
  params: SignalParameters;
  impedanceModel: ImpedanceModel;
  onUpdateModel: (model: ImpedanceModel) => void;
}

export const ImpedanceProfiler: React.FC<ImpedanceProfilerProps> = ({
  params,
  impedanceModel,
  onUpdateModel,
}) => {
  const f = params.carrierFreq;
  const Rs = impedanceModel.nominalResistance; // e.g. 1000 Ohms
  const Cdl = impedanceModel.capacitanceNf * 1e-9; // e.g. 47 nF
  const Area = impedanceModel.electrodeAreaCm2; // e.g. 4.0 cm²

  // Capacitive reactance Xc = 1 / (2 * pi * f * Cdl)
  const Xc = 1 / (2 * Math.PI * f * Cdl);
  // Total impedance |Z| = sqrt(Rs^2 + Xc^2)
  const Z = Math.sqrt(Rs * Rs + Xc * Xc);

  // Simulated output voltage (scaled to safe demo demonstration max 5.0 V peak)
  const vPeak = params.masterVolume * 5.0;
  // Sine/triangle waveform form-factor for RMS
  const formFactor = params.carrierWaveform === 'sine' ? Math.SQRT1_2 : 1 / Math.sqrt(3);
  const vRms = vPeak * formFactor;

  // Simulated current I = V / Z (in mA)
  const iPeakMa = (vPeak / Z) * 1000;
  const iRmsMa = (vRms / Z) * 1000;

  // Charge per phase Q = I_peak * (T_half) in microcoulombs (µC)
  const halfPeriodSec = (1 / f) / 2;
  const qPhaseUcol = (iPeakMa * 1e-3 * halfPeriodSec) * 1e6;
  const chargeDensity = qPhaseUcol / Area; // µC / cm²

  // Power dissipation P = I_rms^2 * Z (in milliwatts)
  const powerMw = Math.pow(iRmsMa * 1e-3, 2) * Z * 1000;

  // Impedance reduction vs 500Hz baseline
  const XcBaseline = 1 / (2 * Math.PI * 500 * Cdl);
  const ZBaseline = Math.sqrt(Rs * Rs + XcBaseline * XcBaseline);
  const attenuationBenefitPercent = Math.max(0, ((ZBaseline - Z) / ZBaseline) * 100);

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 text-slate-400">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <Cpu className="w-3.5 h-3.5" />
          IMPEDANCE & CURRENT DENSITY MODEL
        </span>
        <span className="text-slate-500 text-[11px]">
          f: {f} Hz · Z: {Math.round(Z)} Ω
        </span>
      </div>

      {/* Simulated Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[#101720] border border-[#1a2634] p-2.5 rounded">
          <div className="text-[10px] text-slate-500 uppercase">Complex Impedance |Z|</div>
          <div className="text-sm font-bold text-cyan-300 mt-1">{Math.round(Z)} Ω</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Xc: {Math.round(Xc)} Ω</div>
        </div>

        <div className="bg-[#101720] border border-[#1a2634] p-2.5 rounded">
          <div className="text-[10px] text-slate-500 uppercase">Simulated I<sub className="text-[9px]">RMS</sub></div>
          <div className="text-sm font-bold text-emerald-400 mt-1">{iRmsMa.toFixed(2)} mA</div>
          <div className="text-[10px] text-slate-400 mt-0.5">I<sub className="text-[9px]">PK</sub>: {iPeakMa.toFixed(2)} mA</div>
        </div>

        <div className="bg-[#101720] border border-[#1a2634] p-2.5 rounded">
          <div className="text-[10px] text-slate-500 uppercase">Phase Charge (Q)</div>
          <div className="text-sm font-bold text-amber-300 mt-1">{qPhaseUcol.toFixed(3)} µC</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{chargeDensity.toFixed(3)} µC/cm²</div>
        </div>

        <div className="bg-[#101720] border border-[#1a2634] p-2.5 rounded">
          <div className="text-[10px] text-slate-500 uppercase">Est. Power Dissipation</div>
          <div className="text-sm font-bold text-slate-200 mt-1">{powerMw.toFixed(2)} mW</div>
          <div className="text-[10px] text-cyan-500 mt-0.5">-{attenuationBenefitPercent.toFixed(1)}% vs 500Hz</div>
        </div>
      </div>

      {/* Model Parameter Adjusters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0d141e] p-3 rounded border border-[#172230]">
        <div>
          <div className="flex justify-between text-[11px] text-slate-300 mb-1">
            <span>Nominal Resistance (Rs):</span>
            <span className="font-bold text-cyan-400">{impedanceModel.nominalResistance} Ω</span>
          </div>
          <input
            type="range"
            min={200}
            max={3000}
            step={50}
            value={impedanceModel.nominalResistance}
            onChange={(e) => onUpdateModel({ ...impedanceModel, nominalResistance: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#1e293b] rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-300 mb-1">
            <span>Electrode Capacitance (Cdl):</span>
            <span className="font-bold text-cyan-400">{impedanceModel.capacitanceNf} nF</span>
          </div>
          <input
            type="range"
            min={5}
            max={150}
            step={5}
            value={impedanceModel.capacitanceNf}
            onChange={(e) => onUpdateModel({ ...impedanceModel, capacitanceNf: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#1e293b] rounded"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-300 mb-1">
            <span>Electrode Contact Area:</span>
            <span className="font-bold text-cyan-400">{impedanceModel.electrodeAreaCm2} cm²</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={25.0}
            step={0.5}
            value={impedanceModel.electrodeAreaCm2}
            onChange={(e) => onUpdateModel({ ...impedanceModel, electrodeAreaCm2: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#1e293b] rounded"
          />
        </div>
      </div>

      {/* Recruitment curve telemetry note */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-[#080d12] border border-[#182330] p-2 rounded">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Sensory Recruitment Insight:</strong> Carrier frequencies between 2.0 kHz – 4.0 kHz decrease capacitive skin reactance X<sub className="text-[8px]">c</sub> by up to 85%, significantly mitigating cutaneous stinging sensations while delivering deeper sinusoidal penetration.
        </span>
      </div>
    </div>
  );
};
