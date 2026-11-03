/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Stereo Dual-Trace Laboratory Oscilloscope
 * Renders real-time carrier telemetry for both Left and Right channels.
 */

import React, { useEffect, useRef, useState } from 'react';
import { SignalEngine } from '../audio/signalEngine';
import { Activity } from 'lucide-react';

interface OscilloscopeProps {
  engine: SignalEngine | null;
  isRunning: boolean;
  activeChannel: 'left' | 'right';
  params: { left: { carrierFreq: number }; right: { carrierFreq: number } };
}

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  engine,
  isRunning,
  activeChannel,
  params,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timebaseMs, setTimebaseMs] = useState<number>(1.0);
  const [voltsPerDiv, setVoltsPerDiv] = useState<number>(0.5);
  
  const bufferL = useRef<Float32Array>(new Float32Array(2048));
  const bufferR = useRef<Float32Array>(new Float32Array(2048));
  const envBuffer = useRef<Float32Array>(new Float32Array(1024));
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = canvas;
      ctx.fillStyle = 'rgba(10, 15, 20, 0.4)';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = '#1a2733';
      ctx.lineWidth = 1;
      const xDiv = width / 10;
      const yDiv = height / 8;
      ctx.beginPath();
      for (let i = 1; i < 10; i++) { ctx.moveTo(i * xDiv, 0); ctx.lineTo(i * xDiv, height); }
      for (let j = 1; j < 8; j++) { ctx.moveTo(0, j * yDiv); ctx.lineTo(width, j * yDiv); }
      ctx.stroke();

      if (engine && isRunning) {
        engine.getOutputWaveform('left', bufferL.current);
        engine.getOutputWaveform('right', bufferR.current);
        engine.getEnvelopeWaveform(activeChannel, envBuffer.current);

        const samplesPerMs = 48;
        const totalSpan = Math.floor(10 * timebaseMs * samplesPerMs);
        const dx = width / totalSpan;

        // Trace Left (Cyan)
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < totalSpan; i++) {
          const y = (height / 2) - (bufferL.current[i] * (height / 8) * (1 / voltsPerDiv));
          if (i === 0) ctx.moveTo(i * dx, y); else ctx.lineTo(i * dx, y);
        }
        ctx.stroke();

        // Trace Right (Emerald)
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < totalSpan; i++) {
          const y = (height / 2) - (bufferR.current[i] * (height / 8) * (1 / voltsPerDiv));
          if (i === 0) ctx.moveTo(i * dx, y); else ctx.lineTo(i * dx, y);
        }
        ctx.stroke();

        // Active Envelope (Amber)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        const envStep = width / 512;
        for (let i = 0; i < 512; i++) {
          const y = (height / 2) - (envBuffer.current[i] * (height / 2) * (1 / voltsPerDiv) * 0.8);
          if (i === 0) ctx.moveTo(i * envStep, y); else ctx.lineTo(i * envStep, y);
        }
        ctx.stroke();
      }

      animFrameId.current = requestAnimationFrame(render);
    };
    render();
    return () => { if (animFrameId.current) cancelAnimationFrame(animFrameId.current); };
  }, [engine, isRunning, timebaseMs, voltsPerDiv, activeChannel]);

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-3 font-mono">
      <div className="flex items-center justify-between text-[10px] border-b border-[#1e293b] pb-2 text-slate-500">
        <div className="flex gap-4">
          <span className="flex items-center gap-1 text-cyan-400 font-bold"><Activity className="w-3 h-3"/> CH1: {params.left.carrierFreq}Hz</span>
          <span className="flex items-center gap-1 text-emerald-400 font-bold"><Activity className="w-3 h-3"/> CH2: {params.right.carrierFreq}Hz</span>
        </div>
        <div className="text-amber-400 uppercase font-black">ENV: {activeChannel}</div>
      </div>
      <div className="relative aspect-[2/1] bg-[#070b0f] rounded border border-[#16202c] overflow-hidden">
        <canvas ref={canvasRef} width={800} height={400} className="w-full h-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex gap-1">
          {[0.5, 1.0, 2.0].map(tb => (
            <button key={tb} onClick={() => setTimebaseMs(tb)} className={`flex-1 py-1 text-[9px] rounded ${timebaseMs === tb ? 'bg-cyan-900 text-cyan-300 border border-cyan-700' : 'bg-slate-900 text-slate-500'}`}>{tb}ms</button>
          ))}
        </div>
        <div className="flex gap-1">
          {[0.2, 0.5, 1.0].map(vd => (
            <button key={vd} onClick={() => setVoltsPerDiv(vd)} className={`flex-1 py-1 text-[9px] rounded ${voltsPerDiv === vd ? 'bg-cyan-900 text-cyan-300 border border-cyan-700' : 'bg-slate-900 text-slate-500'}`}>{vd}V</button>
          ))}
        </div>
      </div>
    </div>
  );
};
