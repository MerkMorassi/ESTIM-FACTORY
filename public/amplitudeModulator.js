/**
 * @file amplitudeModulator.js
 * @summary Self-contained, zero-dependency Web Audio API Amplitude Modulation (AM) module.
 * @license Apache-2.0
 * @see https://github.com/WebAudio/web-audio-api - W3C Web Audio API Specification
 * 
 * UNIX Philosophy:
 * - Single responsibility: Applies amplitude modulation to an arbitrary carrier input.
 * - Flat, pipeable node architecture: Input -> VCA Gain -> Output.
 * - Strict 30ms pop-free ramping invariant: Eliminates DC offset transients & switching pops.
 * 
 * Operational Range:
 * - Modulation Rate: 1 Hz to 150 Hz
 * - Waveform Contours: Symmetrical 'sine' or 'triangle' for soft sensory recruitment.
 * - Multi-Step Sequences: Discrete array of amplitude/duty-cycle indices.
 */

/** Mandatory pop-free de-glitch transition constant in seconds (30 milliseconds) */
export const POP_FREE_RAMP_SEC = 0.030;

/**
 * Factory function creating an autonomous Amplitude Modulator unit.
 * 
 * @param {AudioContext} audioCtx - Standard Web Audio API AudioContext instance.
 * @param {Object} [options] - Initial configuration options.
 * @param {number} [options.rate=50] - Initial modulation frequency in Hz (1 - 150 Hz).
 * @param {string} [options.waveform='sine'] - Internal LFO waveform ('sine' | 'triangle').
 * @param {number} [options.depth=1.0] - Modulation index depth (0.0 to 1.0).
 * @param {Array<number>} [options.pattern=null] - Multi-step sequence array (e.g. [1, 0.5, 0, 0.8]).
 * @returns {AmplitudeModulator} Modular controller interface with pipeable I/O nodes.
 */
export function createAmplitudeModulator(audioCtx, options = {}) {
  if (!audioCtx) {
    throw new Error('createAmplitudeModulator: A valid AudioContext is required.');
  }

  let isRunning = false;
  let currentRate = Math.max(1, Math.min(150, options.rate ?? 50));
  let currentWaveform = options.waveform === 'triangle' ? 'triangle' : 'sine';
  let currentDepth = Math.max(0.0, Math.min(1.0, options.depth ?? 1.0));
  let patternArray = Array.isArray(options.pattern) && options.pattern.length > 0
    ? options.pattern.map(v => Math.max(0.0, Math.min(1.0, Number(v) || 0)))
    : null;
  let stepIndex = 0;
  let timerId = null;

  const inputNode = audioCtx.createGain();
  inputNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  const vcaNode = audioCtx.createGain();
  vcaNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  const outputNode = audioCtx.createGain();
  outputNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  inputNode.connect(vcaNode);
  vcaNode.connect(outputNode);

  let lfoOsc = null;
  let lfoGain = null;
  let lfoOffset = null;

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
    const dcOffset = 1.0 - ampScale;
    lfoOffset.offset.setValueAtTime(dcOffset, now);

    lfoOsc.connect(lfoGain);
    lfoGain.connect(vcaNode.gain);
    lfoOffset.connect(vcaNode.gain);

    lfoOsc.start(now);
    lfoOffset.start(now);
  }

  function teardownContinuousLfo() {
    if (lfoOsc) {
      try {
        lfoOsc.stop();
        lfoOsc.disconnect();
      } catch (_) {}
      lfoOsc = null;
    }
    if (lfoOffset) {
      try {
        lfoOffset.stop();
        lfoOffset.disconnect();
      } catch (_) {}
      lfoOffset = null;
    }
    if (lfoGain) {
      try {
        lfoGain.disconnect();
      } catch (_) {}
      lfoGain = null;
    }
  }

  function schedulePatternClock() {
    stopPatternClock();
    if (!isRunning || !patternArray || patternArray.length === 0) return;

    const intervalMs = Math.max(10, 1000 / currentRate);

    const tick = () => {
      if (!isRunning || !patternArray) return;
      const now = audioCtx.currentTime;
      const targetGain = patternArray[stepIndex] * currentDepth;

      vcaNode.gain.cancelScheduledValues(now);
      vcaNode.gain.setValueAtTime(vcaNode.gain.value, now);
      vcaNode.gain.linearRampToValueAtTime(targetGain, now + POP_FREE_RAMP_SEC);

      stepIndex = (stepIndex + 1) % patternArray.length;
      timerId = setTimeout(tick, intervalMs);
    };

    tick();
  }

  function stopPatternClock() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return {
    input: inputNode,
    output: outputNode,

    connectInput(sourceNode) {
      if (sourceNode && typeof sourceNode.connect === 'function') {
        sourceNode.connect(inputNode);
      }
    },

    connectOutput(destinationNode) {
      if (destinationNode && typeof destinationNode.connect === 'function') {
        outputNode.connect(destinationNode);
      }
    },

    setRate(rateHz) {
      const clamped = Math.max(1, Math.min(150, Number(rateHz) || 1));
      currentRate = clamped;

      if (lfoOsc) {
        const now = audioCtx.currentTime;
        lfoOsc.frequency.cancelScheduledValues(now);
        lfoOsc.frequency.setValueAtTime(lfoOsc.frequency.value, now);
        lfoOsc.frequency.linearRampToValueAtTime(clamped, now + POP_FREE_RAMP_SEC);
      }

      if (patternArray && isRunning) {
        schedulePatternClock();
      }
    },

    setPattern(pattern) {
      if (Array.isArray(pattern) && pattern.length > 0) {
        patternArray = pattern.map(v => Math.max(0.0, Math.min(1.0, Number(v) || 0)));
        teardownContinuousLfo();

        const now = audioCtx.currentTime;
        vcaNode.gain.cancelScheduledValues(now);
        vcaNode.gain.setValueAtTime(vcaNode.gain.value, now);
        vcaNode.gain.linearRampToValueAtTime(patternArray[0] * currentDepth, now + POP_FREE_RAMP_SEC);

        stepIndex = 0;
        if (isRunning) {
          schedulePatternClock();
        }
      } else {
        patternArray = null;
        stopPatternClock();
        if (isRunning) {
          setupContinuousLfo();
        } else {
          const now = audioCtx.currentTime;
          vcaNode.gain.cancelScheduledValues(now);
          vcaNode.gain.linearRampToValueAtTime(1.0, now + POP_FREE_RAMP_SEC);
        }
      }
    },

    setDepth(depth) {
      const clamped = Math.max(0.0, Math.min(1.0, Number(depth) || 0));
      currentDepth = clamped;
      const now = audioCtx.currentTime;

      if (lfoGain && lfoOffset) {
        const ampScale = clamped * 0.5;
        const dcOffset = 1.0 - ampScale;

        lfoGain.gain.cancelScheduledValues(now);
        lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
        lfoGain.gain.linearRampToValueAtTime(ampScale, now + POP_FREE_RAMP_SEC);

        lfoOffset.offset.cancelScheduledValues(now);
        lfoOffset.offset.setValueAtTime(lfoOffset.offset.value, now);
        lfoOffset.offset.linearRampToValueAtTime(dcOffset, now + POP_FREE_RAMP_SEC);
      }
    },

    setWaveform(waveform) {
      currentWaveform = waveform === 'triangle' ? 'triangle' : 'sine';
      if (lfoOsc) {
        lfoOsc.type = currentWaveform;
      }
    },

    start() {
      if (isRunning) return;
      isRunning = true;

      const now = audioCtx.currentTime;
      outputNode.gain.cancelScheduledValues(now);
      outputNode.gain.setValueAtTime(outputNode.gain.value, now);
      outputNode.gain.linearRampToValueAtTime(1.0, now + POP_FREE_RAMP_SEC);

      if (patternArray) {
        schedulePatternClock();
      } else {
        setupContinuousLfo();
      }
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
      try {
        inputNode.disconnect();
        vcaNode.disconnect();
        outputNode.disconnect();
      } catch (_) {}
    },

    getState() {
      return {
        isRunning,
        rateHz: currentRate,
        depth: currentDepth,
        waveform: currentWaveform,
        hasPattern: patternArray !== null,
        patternLength: patternArray ? patternArray.length : 0,
      };
    },
  };
}
