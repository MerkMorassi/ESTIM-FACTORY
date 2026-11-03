/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Stereo FFT Frequency Spectrum Analyzer
 */

import React, { useEffect, useRef } from 'react';
import { SignalEngine } from '../audio/signalEngine';
import { Radio } from 'lucide-react';

interface SpectrumAnalyzerProps {
  engine: SignalEngine | null;
  isRunning: boolean;
  activeChannel: 'left' | 'right';
  params: { left: { carrierFreq: number }; right: { carrierFreq: number } };
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  engine,
  isRunning,
  activeChannel,
  params,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fftL = useRef<Float32Array>(new Float32Array(1024));
  const fftR = useRef<Float32Array>(new Float32Array(1024));
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const { width, height } = canvas;
      ctx.fillStyle = '#070b0f';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = '#15212d';
      [500, 1000, 2000, 4000].forEach(f => {
        const x = (f / 5000) * width;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      });

      if (engine && isRunning) {
        engine.getOutputFrequency('left', fftL.current);
        engine.getOutputFrequency('right', fftR.current);

        const drawSpectrum = (data: Float32Array, color: string) => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const maxBin = Math.floor((5000 / 24000) * data.length);
          for (let i = 0; i < maxBin; i++) {
            const x = (i / maxBin) * width;
            const norm = Math.max(0, Math.min(1, (data[i] + 90) / 80));
            const y = height - (norm * (height - 20));
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };

        drawSpectrum(fftL.current, '#00f0ff');
        drawSpectrum(fftR.current, '#10b981');
      }

      animFrameId.current = requestAnimationFrame(render);
    };
    render();
    return () => { if (animFrameId.current) cancelAnimationFrame(animFrameId.current); };
  }, [engine, isRunning]);

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-3 font-mono text-xs">
      <div className="flex items-center justify-between text-slate-400 border-b border-[#1e293b] pb-2">
        <span className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase"><Radio className="w-3.5 h-3.5"/> Stereo Power Spectrum</span>
        <span className="text-[10px]">CH1 (L): {params.left.carrierFreq}Hz / CH2 (R): {params.right.carrierFreq}Hz</span>
      </div>
      <div className="aspect-[3/1] bg-[#070b0f] rounded border border-[#16202c] overflow-hidden">
        <canvas ref={canvasRef} width={800} height={260} className="w-full h-full" />
      </div>
    </div>
  );
};
