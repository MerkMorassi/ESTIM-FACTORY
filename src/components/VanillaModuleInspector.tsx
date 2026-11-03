/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vanilla Module Inspector & Live Demonstration
 * Exposes amplitudeModulator.js source code, download hooks, and a live testing harness.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createAmplitudeModulator, POP_FREE_RAMP_SEC } from '../audio/amplitudeModulator';
import { Code, Play, Square, Copy, Check, Download, Zap, Terminal } from 'lucide-react';

export const VanillaModuleInspector: React.FC = () => {
  const [copied, setCopied] = useState<boolean>(false);
  const [testActive, setTestActive] = useState<boolean>(false);
  const [testCarrierFreq, setTestCarrierFreq] = useState<number>(2000);
  const [testModRate, setTestModRate] = useState<number>(40);
  const [testDepth, setTestDepth] = useState<number>(1.0);
  const [testPatternStr, setTestPatternStr] = useState<string>('1.0, 0.2, 0.8, 0.0, 1.0, 0.5, 0.2, 0.0');
  const [usePattern, setUsePattern] = useState<boolean>(false);

  // Audio Context & Modulator refs for standalone harness
  const harnessCtxRef = useRef<AudioContext | null>(null);
  const harnessModRef = useRef<ReturnType<typeof createAmplitudeModulator> | null>(null);
  const harnessOscRef = useRef<OscillatorNode | null>(null);

  const standaloneSourceCode = `/**
 * @file amplitudeModulator.js
 * @summary Self-contained, zero-dependency Web Audio API Amplitude Modulation (AM) module.
 * @license Apache-2.0
 * @see https://github.com/WebAudio/web-audio-api - W3C Web Audio API Specification
 * UNIX Philosophy: Pipeable I/O, single responsibility, 30ms pop-free ramping.
 */

export const POP_FREE_RAMP_SEC = 0.030; // 30ms pop-free transition

export function createAmplitudeModulator(audioCtx, options = {}) {
  if (!audioCtx) throw new Error('AudioContext required');

  let isRunning = false;
  let currentRate = Math.max(1, Math.min(150, options.rate ?? 50));
  let currentWaveform = options.waveform === 'triangle' ? 'triangle' : 'sine';
  let currentDepth = Math.max(0.0, Math.min(1.0, options.depth ?? 1.0));
  let patternArray = Array.isArray(options.pattern) ? options.pattern : null;
  let stepIndex = 0;
  let timerId = null;

  // Web Audio Graph: input -> vcaNode (Gain) -> output
  const inputNode = audioCtx.createGain();
  const vcaNode = audioCtx.createGain();
  const outputNode = audioCtx.createGain();

  inputNode.connect(vcaNode);
  vcaNode.connect(outputNode);

  let lfoOsc = null, lfoGain = null, lfoOffset = null;

  function setupContinuousLfo() {
    teardownContinuousLfo();
    const now = audioCtx.currentTime;
    lfoOsc = audioCtx.createOscillator();
    lfoOsc.type = currentWaveform;
    lfoOsc.frequency.setValueAtTime(currentRate, now);

    lfoGain = audioCtx.createGain();
    const ampScale = currentDepth * 0.5;
    lfoGain.gain.setValueAtTime(ampScale, now);

    lfoOffset = audioCtx.createConstantSource();
    lfoOffset.offset.setValueAtTime(1.0 - ampScale, now);

    lfoOsc.connect(lfoGain);
    lfoGain.connect(vcaNode.gain);
    lfoOffset.connect(vcaNode.gain);

    lfoOsc.start(now);
    lfoOffset.start(now);
  }

  function teardownContinuousLfo() {
    if (lfoOsc) { try { lfoOsc.stop(); lfoOsc.disconnect(); } catch (_) {} lfoOsc = null; }
    if (lfoOffset) { try { lfoOffset.stop(); lfoOffset.disconnect(); } catch (_) {} lfoOffset = null; }
    if (lfoGain) { try { lfoGain.disconnect(); } catch (_) {} lfoGain = null; }
  }

  function schedulePatternClock() {
    stopPatternClock();
    if (!isRunning || !patternArray || patternArray.length === 0) return;
    const intervalMs = Math.max(10, 1000 / currentRate);

    const tick = () => {
      if (!isRunning || !patternArray) return;
      const now = audioCtx.currentTime;
      const targetGain = patternArray[stepIndex] * currentDepth;

      // MANDATORY 30ms linear ramp
      vcaNode.gain.cancelScheduledValues(now);
      vcaNode.gain.setValueAtTime(vcaNode.gain.value, now);
      vcaNode.gain.linearRampToValueAtTime(targetGain, now + POP_FREE_RAMP_SEC);

      stepIndex = (stepIndex + 1) % patternArray.length;
      timerId = setTimeout(tick, intervalMs);
    };
    tick();
  }

  function stopPatternClock() {
    if (timerId !== null) { clearTimeout(timerId); timerId = null; }
  }

  return {
    input: inputNode,
    output: outputNode,
    connectInput(src) { src?.connect?.(inputNode); },
    connectOutput(dest) { outputNode?.connect?.(dest); },
    setRate(rateHz) {
      currentRate = Math.max(1, Math.min(150, Number(rateHz) || 1));
      if (lfoOsc) {
        const now = audioCtx.currentTime;
        lfoOsc.frequency.cancelScheduledValues(now);
        lfoOsc.frequency.setValueAtTime(lfoOsc.frequency.value, now);
        lfoOsc.frequency.linearRampToValueAtTime(currentRate, now + POP_FREE_RAMP_SEC);
      }
      if (patternArray && isRunning) schedulePatternClock();
    },
    setPattern(pattern) {
      if (Array.isArray(pattern) && pattern.length > 0) {
        patternArray = pattern.map(v => Math.max(0, Math.min(1, Number(v) || 0)));
        teardownContinuousLfo();
        stepIndex = 0;
        if (isRunning) schedulePatternClock();
      } else {
        patternArray = null;
        stopPatternClock();
        if (isRunning) setupContinuousLfo();
      }
    },
    setDepth(depth) {
      currentDepth = Math.max(0, Math.min(1, Number(depth) || 0));
      if (lfoGain && lfoOffset) {
        const now = audioCtx.currentTime;
        const ampScale = currentDepth * 0.5;
        lfoGain.gain.cancelScheduledValues(now);
        lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
        lfoGain.gain.linearRampToValueAtTime(ampScale, now + POP_FREE_RAMP_SEC);

        lfoOffset.offset.cancelScheduledValues(now);
        lfoOffset.offset.setValueAtTime(lfoOffset.offset.value, now);
        lfoOffset.offset.linearRampToValueAtTime(1.0 - ampScale, now + POP_FREE_RAMP_SEC);
      }
    },
    start() {
      if (isRunning) return;
      isRunning = true;
      const now = audioCtx.currentTime;
      outputNode.gain.cancelScheduledValues(now);
      outputNode.gain.setValueAtTime(outputNode.gain.value, now);
      outputNode.gain.linearRampToValueAtTime(1.0, now + POP_FREE_RAMP_SEC);
      if (patternArray) schedulePatternClock(); else setupContinuousLfo();
    },
    stop() {
      if (!isRunning) return;
      const now = audioCtx.currentTime;
      outputNode.gain.cancelScheduledValues(now);
      outputNode.gain.setValueAtTime(outputNode.gain.value, now);
      outputNode.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);
      stopPatternClock();
      teardownContinuousLfo();
      isRunning = false;
    },
    disconnect() {
      this.stop();
      inputNode.disconnect();
      vcaNode.disconnect();
      outputNode.disconnect();
    }
  };
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(standaloneSourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const blob = new Blob([standaloneSourceCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'amplitudeModulator.js';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Standalone live-test harness
  const toggleHarness = async () => {
    if (testActive) {
      if (harnessModRef.current) {
        harnessModRef.current.stop();
      }
      if (harnessOscRef.current) {
        try {
          harnessOscRef.current.stop();
          harnessOscRef.current.disconnect();
        } catch (_) {}
        harnessOscRef.current = null;
      }
      setTestActive(false);
    } else {
      if (!harnessCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        harnessCtxRef.current = new AudioCtx();
      }
      if (harnessCtxRef.current.state === 'suspended') {
        await harnessCtxRef.current.resume();
      }

      const ctx = harnessCtxRef.current;
      const now = ctx.currentTime;

      // 1. Create independent external carrier oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(testCarrierFreq, now);

      // 2. Safe demo master volume limiter for harness
      const harnessLimiter = ctx.createGain();
      harnessLimiter.gain.setValueAtTime(0.20, now); // Quiet safe demonstration level

      // 3. Create standalone module instance
      const parsedPattern = usePattern
        ? testPatternStr.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
        : null;

      const mod = createAmplitudeModulator(ctx, {
        rate: testModRate,
        waveform: 'sine',
        depth: testDepth,
        pattern: parsedPattern,
      });

      // 4. Pipe: osc -> mod.connectInput -> mod.connectOutput -> harnessLimiter -> destination
      mod.connectInput(osc);
      mod.connectOutput(harnessLimiter);
      harnessLimiter.connect(ctx.destination);

      osc.start(now);
      mod.start();

      harnessOscRef.current = osc;
      harnessModRef.current = mod;
      setTestActive(true);
    }
  };

  // Sync test harness parameters in real time
  useEffect(() => {
    if (!testActive || !harnessModRef.current) return;
    harnessModRef.current.setRate(testModRate);
  }, [testModRate, testActive]);

  useEffect(() => {
    if (!testActive || !harnessModRef.current) return;
    harnessModRef.current.setDepth(testDepth);
  }, [testDepth, testActive]);

  useEffect(() => {
    if (!testActive || !harnessOscRef.current || !harnessCtxRef.current) return;
    const now = harnessCtxRef.current.currentTime;
    harnessOscRef.current.frequency.cancelScheduledValues(now);
    harnessOscRef.current.frequency.linearRampToValueAtTime(testCarrierFreq, now + POP_FREE_RAMP_SEC);
  }, [testCarrierFreq, testActive]);

  useEffect(() => {
    if (!testActive || !harnessModRef.current) return;
    if (usePattern) {
      const parsed = testPatternStr
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n));
      harnessModRef.current.setPattern(parsed);
    } else {
      harnessModRef.current.setPattern(null);
    }
  }, [usePattern, testPatternStr, testActive]);

  useEffect(() => {
    return () => {
      if (harnessModRef.current) {
        harnessModRef.current.disconnect();
      }
      if (harnessOscRef.current) {
        try {
          harnessOscRef.current.stop();
          harnessOscRef.current.disconnect();
        } catch (_) {}
      }
      if (harnessCtxRef.current && harnessCtxRef.current.state !== 'closed') {
        harnessCtxRef.current.close();
      }
    };
  }, []);

  return (
    <div className="bg-[#0b1016] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-4 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e293b] pb-2 text-slate-400">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
          <Code className="w-4 h-4" />
          STANDALONE UNIX MODULE (amplitudeModulator.js)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#132230] hover:bg-[#1a2d40] text-cyan-300 rounded border border-[#23384f] transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'COPIED' : 'COPY SOURCE'}
          </button>
          <button
            type="button"
            onClick={downloadFile}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#132230] hover:bg-[#1a2d40] text-slate-200 rounded border border-[#23384f] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            DOWNLOAD .JS
          </button>
        </div>
      </div>

      {/* Live Module Verification Harness */}
      <div className="bg-[#0e1620] border border-[#1b2a3a] p-3 rounded flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-slate-200">LIVE TEST HARNESS: createAmplitudeModulator()</span>
          </div>

          <button
            type="button"
            onClick={toggleHarness}
            className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold text-[11px] transition-all ${
              testActive
                ? 'bg-rose-950 text-rose-300 border border-rose-700 hover:bg-rose-900'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-700 hover:bg-emerald-900'
            }`}
          >
            {testActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {testActive ? 'STOP HARNESS' : 'RUN HARNESS'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Carrier Input (Hz):</span>
              <span className="text-cyan-400 font-bold">{testCarrierFreq} Hz</span>
            </div>
            <input
              type="range"
              min={500}
              max={4000}
              step={50}
              value={testCarrierFreq}
              onChange={(e) => setTestCarrierFreq(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-[#1e293b] rounded"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Mod Rate (setRate):</span>
              <span className="text-amber-400 font-bold">{testModRate} Hz</span>
            </div>
            <input
              type="range"
              min={1}
              max={150}
              step={1}
              value={testModRate}
              onChange={(e) => setTestModRate(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-[#1e293b] rounded"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Depth (setDepth):</span>
              <span className="text-slate-200 font-bold">{Math.round(testDepth * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={testDepth}
              onChange={(e) => setTestDepth(Number(e.target.value))}
              className="w-full accent-slate-300 cursor-pointer h-1.5 bg-[#1e293b] rounded"
            />
          </div>
        </div>

        {/* Pattern Array Input */}
        <div className="flex flex-col gap-1.5 bg-[#090e14] p-2.5 rounded border border-[#162230]">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={usePattern}
                onChange={(e) => setUsePattern(e.target.checked)}
                className="accent-cyan-400 rounded"
              />
              <span>Route through Array Sequence (setPattern):</span>
            </label>
            <span className="text-[10px] text-slate-500">Values in range [0.0 – 1.0]</span>
          </div>

          <input
            type="text"
            disabled={!usePattern}
            value={testPatternStr}
            onChange={(e) => setTestPatternStr(e.target.value)}
            className="w-full bg-[#121c27] border border-[#213244] px-2 py-1 text-[11px] text-cyan-300 rounded font-mono disabled:opacity-40"
          />
        </div>
      </div>

      {/* Embedded Code Viewer */}
      <div className="relative">
        <div className="text-[11px] text-slate-400 mb-1 flex flex-wrap items-center justify-between gap-2">
          <span>SOURCE: /src/audio/amplitudeModulator.js</span>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/WebAudio/web-audio-api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
            >
              SPEC: github.com/WebAudio/web-audio-api
            </a>
            <span className="text-slate-600">·</span>
            <span className="text-[10px] text-emerald-400">ZERO DEPENDENCIES · RAW ECMASCRIPT</span>
          </div>
        </div>
        <pre className="p-3 bg-[#070b0f] border border-[#182636] rounded text-[11px] text-slate-300 overflow-x-auto max-h-[300px] leading-relaxed select-all">
          <code>{standaloneSourceCode}</code>
        </pre>
      </div>
    </div>
  );
};
