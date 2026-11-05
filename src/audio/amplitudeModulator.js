/**
 * @file amplitudeModulator.js
 * @summary Self-contained, zero-dependency Web Audio API Amplitude Modulation (AM) module.
 * @license Apache-2.0
 * @see https://github.com/WebAudio/web-audio-api - W3C Web Audio API Specification
 * 
 * UNIX Philosophy:
 * - Single responsibility: Applies amplitude modulation to an arbitrary carrier input.
 * - Flat, pipeable node architecture: Input -> VCA Gain -> Output.
 * - 30 ms linear gain ramp on every step change (POP_FREE_RAMP_SEC) to reduce switching clicks.
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

  // --- Internal State ---
  let isRunning = false;
  let currentRate = Math.max(1, Math.min(150, options.rate ?? 50));
  let currentWaveform = options.waveform === 'triangle' ? 'triangle' : 'sine';
  let currentDepth = Math.max(0.0, Math.min(1.0, options.depth ?? 1.0));
  let patternArray = Array.isArray(options.pattern) && options.pattern.length > 0
    ? options.pattern.map(v => Math.max(0.0, Math.min(1.0, Number(v) || 0)))
    : null;
  let stepIndex = 0;
  let timerId = null;

  // --- Web Audio Node Graph ---
  // [inputNode] -> [vcaNode (GainNode)] -> [outputNode]
  //                      ^
  //                      | controlled by LFO or Sequenced Gain param

  const inputNode = audioCtx.createGain();
  inputNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  const vcaNode = audioCtx.createGain();
  vcaNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  const outputNode = audioCtx.createGain();
  outputNode.gain.setValueAtTime(1.0, audioCtx.currentTime);

  // Pipe internal carrier path: Input -> VCA -> Output
  inputNode.connect(vcaNode);
  vcaNode.connect(outputNode);

  // Internal Continuous LFO Generator (used when pattern is not active)
  let lfoOsc = null;
  let lfoGain = null;
  let lfoOffset = null;

  /**
   * Internal helper to construct continuous LFO AM sub-graph
   */
  function setupContinuousLfo() {
    teardownContinuousLfo();

    const now = audioCtx.currentTime;

    lfoOsc = audioCtx.createOscillator();
    lfoOsc.type = currentWaveform;
    lfoOsc.frequency.setValueAtTime(currentRate, now);

    lfoGain = audioCtx.createGain();
    // Depth scaling: 0.0 to 0.5 swing around DC offset
    const ampScale = currentDepth * 0.5;
    lfoGain.gain.setValueAtTime(ampScale, now);

    // Unipolar offset ensures gain stays in range [1 - depth, 1]
    lfoOffset = audioCtx.createConstantSource();
    const dcOffset = 1.0 - ampScale;
    lfoOffset.offset.setValueAtTime(dcOffset, now);

    // Route LFO directly to vcaNode.gain AudioParam
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

  /**
   * Internal clock scheduler for multi-step pattern arrays
   */
  function schedulePatternClock() {
    stopPatternClock();
    if (!isRunning || !patternArray || patternArray.length === 0) return;

    const intervalMs = Math.max(10, 1000 / currentRate);

    const tick = () => {
      if (!isRunning || !patternArray) return;
      const now = audioCtx.currentTime;
      const targetGain = patternArray[stepIndex] * currentDepth;

      // MANDATORY: Precise 30ms linear ramp to new step gain level
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

  // --- Public Interface ---

  return {
    /**
     * The input AudioNode for the incoming carrier wave.
     * @type {GainNode}
     */
    input: inputNode,

    /**
     * The output AudioNode delivering the amplitude-modulated signal.
     * @type {GainNode}
     */
    output: outputNode,

    /**
     * Connects an external carrier source node into this modulator's input.
     * @param {AudioNode} sourceNode - Upstream source (e.g. OscillatorNode).
     * @returns {void}
     */
    connectInput(sourceNode) {
      if (sourceNode && typeof sourceNode.connect === 'function') {
        sourceNode.connect(inputNode);
      }
    },

    /**
     * Connects this modulator's output to a downstream destination node.
     * @param {AudioNode} destinationNode - Downstream target (e.g. AudioContext.destination).
     * @returns {void}
     */
    connectOutput(destinationNode) {
      if (destinationNode && typeof destinationNode.connect === 'function') {
        outputNode.connect(destinationNode);
      }
    },

    /**
     * Sets the modulation rate (1 Hz to 150 Hz) with 30ms pop-free transition.
     * @param {number} rateHz - Desired modulation frequency in Hertz.
     * @returns {void}
     */
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

    /**
     * Sets or clears a multi-step pattern sequence array.
     * When pattern is provided, the modulator steps through discrete duty/gain values.
     * When set to null, reverts to smooth continuous LFO modulation.
     * 
     * @param {Array<number>|null} pattern - Sequence of gain values (0.0 to 1.0) or null.
     * @returns {void}
     */
    setPattern(pattern) {
      if (Array.isArray(pattern) && pattern.length > 0) {
        patternArray = pattern.map(v => Math.max(0.0, Math.min(1.0, Number(v) || 0)));
        teardownContinuousLfo();

        // Initialize VCA gain to 0 with 30ms ramp before starting clock
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

    /**
     * Sets the modulation depth index (0.0 to 1.0) with mandatory 30ms linear ramp.
     * @param {number} depth - Modulation depth index (0.0 = bypassed, 1.0 = 100% AM).
     * @returns {void}
     */
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

    /**
     * Sets internal LFO waveform contour ('sine' | 'triangle').
     * @param {'sine' | 'triangle'} waveform - Symmetrical waveform contour.
     * @returns {void}
     */
    setWaveform(waveform) {
      currentWaveform = waveform === 'triangle' ? 'triangle' : 'sine';
      if (lfoOsc) {
        lfoOsc.type = currentWaveform;
      }
    },

    /**
     * Activates amplitude modulation with 30ms smooth ramp-in.
     * @returns {void}
     */
    start() {
      if (isRunning) return;
      isRunning = true;

      const now = audioCtx.currentTime;
      // Ensure master output gain is smoothly ramped to 1.0
      outputNode.gain.cancelScheduledValues(now);
      outputNode.gain.setValueAtTime(outputNode.gain.value, now);
      outputNode.gain.linearRampToValueAtTime(1.0, now + POP_FREE_RAMP_SEC);

      if (patternArray) {
        schedulePatternClock();
      } else {
        setupContinuousLfo();
      }
    },

    /**
     * Deactivates modulation and mutes output with 30ms pop-free ramp-out.
     * @returns {void}
     */
    stop() {
      if (!isRunning) return;
      const now = audioCtx.currentTime;

      // 30ms linear ramp to clean silence
      outputNode.gain.cancelScheduledValues(now);
      outputNode.gain.setValueAtTime(outputNode.gain.value, now);
      outputNode.gain.linearRampToValueAtTime(0.0001, now + POP_FREE_RAMP_SEC);

      stopPatternClock();
      teardownContinuousLfo();
      isRunning = false;
    },

    /**
     * Disconnects and destroys all internal audio nodes.
     * @returns {void}
     */
    disconnect() {
      this.stop();
      try {
        inputNode.disconnect();
        vcaNode.disconnect();
        outputNode.disconnect();
      } catch (_) {}
    },

    /** Current operational state query */
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
