/**
 * Audio-thread watchdog — SYS.AI.MAYA.GITHUB
 *
 * The old watchdog's heartbeat AND its check both ran on the main thread, while
 * the audio keeps rendering on its own thread. If the page froze, the check froze
 * with it and never cut the sound.
 *
 * This gate runs inside an AudioWorklet on the audio render thread. The main
 * thread posts 'beat' messages (every 250 ms from App). If the gate is armed and
 * no beat arrives for `timeoutSec`, it fades the whole stereo output to silence
 * over 30 ms, reports 'tripped', and stays muted until it is explicitly re-armed
 * (the user starts output again).
 *
 * Loaded from a Blob URL so no extra Vite asset config is needed.
 */

export const WATCHDOG_PROCESSOR_NAME = 'sys-ai-maya-watchdog-gate';

export const WATCHDOG_WORKLET_SOURCE = `
class WatchdogGate extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.timeoutSec = typeof opts.timeoutSec === 'number' ? opts.timeoutSec : 1.0;
    this.fadeStep = 1 / (0.03 * sampleRate); // 30 ms linear fade
    this.armed = false;
    this.tripped = false;
    this.lastBeat = currentTime;
    this.gain = 1;
    this.port.onmessage = (e) => {
      const type = e.data && e.data.type;
      if (type === 'beat') {
        this.lastBeat = currentTime;
      } else if (type === 'arm') {
        this.armed = true;
        this.tripped = false;
        this.lastBeat = currentTime;
      } else if (type === 'disarm') {
        this.armed = false;
        this.tripped = false;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0] || [];
    const output = outputs[0] || [];
    if (this.armed && !this.tripped && currentTime - this.lastBeat > this.timeoutSec) {
      this.tripped = true;
      this.port.postMessage({ type: 'tripped', at: currentTime, silentFor: currentTime - this.lastBeat });
    }
    const target = this.tripped ? 0 : 1;
    let g = this.gain;
    for (let c = 0; c < output.length; c++) {
      const inp = input[c];
      const out = output[c];
      g = this.gain;
      for (let n = 0; n < out.length; n++) {
        if (g < target) g = Math.min(target, g + this.fadeStep);
        else if (g > target) g = Math.max(target, g - this.fadeStep);
        out[n] = inp ? inp[n] * g : 0;
      }
    }
    this.gain = output.length ? g : target;
    return true;
  }
}
registerProcessor('${WATCHDOG_PROCESSOR_NAME}', WatchdogGate);
`;
