/**
 * AI guardrails — SYS.AI.MAYA.GITHUB
 *
 * Everything Gemini returns is untrusted. These functions validate the shape of a
 * co-pilot response and clamp every numeric value to the same ranges the UI
 * sliders allow, before anything reaches the signal engine.
 *
 * Rules:
 *  - Unknown keys are dropped. Non-finite numbers are dropped.
 *  - Numbers outside a range are clamped and reported in `adjusted`.
 *  - The AI may turn power OFF, never ON (`power: true` is dropped).
 *  - A protocol is capped in segment count and total length. Protocols are never
 *    started by the AI: the user presses Run.
 *
 * Used on both sides: server.ts sanitizes before replying, and the client
 * sanitizes again right before applying (defence in depth).
 */

export const AI_LIMITS = {
  carrierFreq: { min: 10, max: 4000 },
  modFreq: { min: 1, max: 150 },
  modDepth: { min: 0, max: 1 },
  masterVolume: { min: 0, max: 1 },
  carrierMorph: { min: 0, max: 1 },
  carrierPhase: { min: 0, max: 360 },
  intensity: { min: 0, max: 1 },
  bpm: { min: 40, max: 240 },
  segmentDurationSec: { min: 0.5, max: 600 },
  maxSegmentsPerChannel: 32,
  maxBeatSteps: 64,
  maxProtocolSec: 1800,
  maxTextLength: 200,
} as const;

const MODES = ['continuous', 'burst', 'sequenced', 'sweep'] as const;
const CHANNELS = ['left', 'right', 'both'] as const;
const INTERPOLATIONS = ['linear', 'exponential', 'step'] as const;
const SEGMENT_TYPES = ['ramp', 'beat'] as const;
const BEAT_TYPES = ['none', 'bass', 'snare'] as const;

type Range = { readonly min: number; readonly max: number };

export interface SanitizedCommand {
  ch?: 'left' | 'right' | 'both';
  carrierFreq?: number;
  modFreq?: number;
  modDepth?: number;
  masterVolume?: number;
  mode?: (typeof MODES)[number];
  carrierMorph?: number;
  carrierPhase?: number;
  power?: false;
}

export interface SanitizedSegment {
  id: string;
  type: (typeof SEGMENT_TYPES)[number];
  durationSec: number;
  startIntensity: number;
  endIntensity: number;
  startCarrierFreq: number;
  endCarrierFreq: number;
  startModFreq: number;
  endModFreq: number;
  interpolation: (typeof INTERPOLATIONS)[number];
  bpm?: number;
  steps?: { type: (typeof BEAT_TYPES)[number] }[];
  label: string;
}

export interface SanitizedProtocol {
  name: string;
  description: string;
  totalDurationMs: number;
  lastModified: number;
  masterBpm: number;
  channels: { left: SanitizedSegment[]; right: SanitizedSegment[] };
}

export interface GuardReport {
  /** Keys that were present but rejected (wrong type, unknown, forbidden). */
  dropped: string[];
  /** Keys whose numeric value was clamped into range. */
  adjusted: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, r: Range, key: string, rep: GuardReport): number | undefined => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    rep.dropped.push(key);
    return undefined;
  }
  const c = Math.min(r.max, Math.max(r.min, n));
  if (c !== n) rep.adjusted.push(key);
  return c;
};

const numOr = (v: unknown, r: Range, key: string, rep: GuardReport, fallback: number): number =>
  num(v, r, key, rep) ?? fallback;

const pick = <T extends string>(v: unknown, allowed: readonly T[], key: string, rep: GuardReport): T | undefined => {
  if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return v as T;
  rep.dropped.push(key);
  return undefined;
};

const text = (v: unknown, fallback: string): string =>
  (typeof v === 'string' ? v : fallback).slice(0, AI_LIMITS.maxTextLength);

const COMMAND_NUMERIC: Record<string, Range> = {
  carrierFreq: AI_LIMITS.carrierFreq,
  modFreq: AI_LIMITS.modFreq,
  modDepth: AI_LIMITS.modDepth,
  masterVolume: AI_LIMITS.masterVolume,
  carrierMorph: AI_LIMITS.carrierMorph,
  carrierPhase: AI_LIMITS.carrierPhase,
};

export function sanitizeAiCommand(raw: unknown): { command: SanitizedCommand; report: GuardReport } {
  const report: GuardReport = { dropped: [], adjusted: [] };
  const command: SanitizedCommand = {};
  if (!isObj(raw)) {
    report.dropped.push('data');
    return { command, report };
  }
  for (const [key, value] of Object.entries(raw)) {
    if (key in COMMAND_NUMERIC) {
      const v = num(value, COMMAND_NUMERIC[key], key, report);
      if (v !== undefined) (command as Record<string, unknown>)[key] = v;
    } else if (key === 'mode') {
      const v = pick(value, MODES, key, report);
      if (v) command.mode = v;
    } else if (key === 'ch') {
      const v = pick(value, CHANNELS, key, report);
      if (v) command.ch = v;
    } else if (key === 'power') {
      // The AI may stop output, never start it.
      if (value === false) command.power = false;
      else report.dropped.push('power');
    } else {
      report.dropped.push(key);
    }
  }
  return { command, report };
}

function sanitizeSegment(raw: unknown, path: string, idx: number, rep: GuardReport): SanitizedSegment | null {
  if (!isObj(raw)) {
    rep.dropped.push(path);
    return null;
  }
  const type = pick(raw.type ?? 'ramp', SEGMENT_TYPES, `${path}.type`, rep) ?? 'ramp';
  const seg: SanitizedSegment = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : `ai-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    durationSec: numOr(raw.durationSec, AI_LIMITS.segmentDurationSec, `${path}.durationSec`, rep, 10),
    startIntensity: numOr(raw.startIntensity, AI_LIMITS.intensity, `${path}.startIntensity`, rep, 0),
    endIntensity: numOr(raw.endIntensity, AI_LIMITS.intensity, `${path}.endIntensity`, rep, 0),
    startCarrierFreq: numOr(raw.startCarrierFreq, AI_LIMITS.carrierFreq, `${path}.startCarrierFreq`, rep, 1000),
    endCarrierFreq: numOr(raw.endCarrierFreq, AI_LIMITS.carrierFreq, `${path}.endCarrierFreq`, rep, 1000),
    startModFreq: numOr(raw.startModFreq, AI_LIMITS.modFreq, `${path}.startModFreq`, rep, 10),
    endModFreq: numOr(raw.endModFreq, AI_LIMITS.modFreq, `${path}.endModFreq`, rep, 10),
    interpolation: pick(raw.interpolation ?? 'linear', INTERPOLATIONS, `${path}.interpolation`, rep) ?? 'linear',
    label: text(raw.label, `Stage ${idx + 1}`),
  };
  if (raw.bpm !== undefined) {
    const bpm = num(raw.bpm, AI_LIMITS.bpm, `${path}.bpm`, rep);
    if (bpm !== undefined) seg.bpm = bpm;
  }
  if (type === 'beat') {
    const steps = Array.isArray(raw.steps) ? raw.steps.slice(0, AI_LIMITS.maxBeatSteps) : [];
    if (Array.isArray(raw.steps) && raw.steps.length > AI_LIMITS.maxBeatSteps) rep.adjusted.push(`${path}.steps`);
    seg.steps = steps.map((s, i) => ({
      type: (isObj(s) ? pick(s.type, BEAT_TYPES, `${path}.steps[${i}]`, rep) : undefined) ?? 'none',
    }));
  }
  return seg;
}

export function sanitizeAiProtocol(raw: unknown): { protocol: SanitizedProtocol | null; report: GuardReport } {
  const report: GuardReport = { dropped: [], adjusted: [] };
  if (!isObj(raw) || !isObj(raw.channels)) {
    report.dropped.push('protocol');
    return { protocol: null, report };
  }
  const channels = raw.channels;
  const out: SanitizedProtocol['channels'] = { left: [], right: [] };
  let longestSec = 0;

  for (const ch of ['left', 'right'] as const) {
    const list = Array.isArray(channels[ch]) ? (channels[ch] as unknown[]) : [];
    if (list.length > AI_LIMITS.maxSegmentsPerChannel) report.adjusted.push(`channels.${ch}.length`);
    let total = 0;
    list.slice(0, AI_LIMITS.maxSegmentsPerChannel).forEach((s, i) => {
      const seg = sanitizeSegment(s, `channels.${ch}[${i}]`, i, report);
      if (!seg) return;
      const remaining = AI_LIMITS.maxProtocolSec - total;
      if (remaining < AI_LIMITS.segmentDurationSec.min) {
        report.adjusted.push(`channels.${ch}[${i}].dropped_over_max_length`);
        return;
      }
      if (seg.durationSec > remaining) {
        seg.durationSec = remaining;
        report.adjusted.push(`channels.${ch}[${i}].durationSec`);
      }
      total += seg.durationSec;
      out[ch].push(seg);
    });
    longestSec = Math.max(longestSec, total);
  }

  if (out.left.length === 0 && out.right.length === 0) {
    report.dropped.push('channels');
    return { protocol: null, report };
  }

  return {
    protocol: {
      name: text(raw.name, 'AI Protocol'),
      description: text(raw.description, ''),
      totalDurationMs: Math.round(longestSec * 1000),
      lastModified: Date.now(),
      masterBpm: numOr(raw.masterBpm, AI_LIMITS.bpm, 'masterBpm', report, 120),
      channels: out,
    },
    report,
  };
}

/** Sanitize a whole co-pilot response ({ message, type, data }). */
export function sanitizeAiResponse(raw: unknown): {
  message: string;
  type: 'command' | 'protocol' | 'analysis';
  data?: SanitizedCommand | SanitizedProtocol;
  report: GuardReport;
} {
  const r = isObj(raw) ? raw : {};
  const message = typeof r.message === 'string' ? r.message.slice(0, 4000) : '';
  if (r.type === 'command') {
    const { command, report } = sanitizeAiCommand(r.data);
    return { message, type: 'command', data: command, report };
  }
  if (r.type === 'protocol') {
    const { protocol, report } = sanitizeAiProtocol(r.data);
    if (protocol) return { message, type: 'protocol', data: protocol, report };
    return { message: message || 'Protocol rejected by safety validation.', type: 'analysis', report };
  }
  return { message, type: 'analysis', report: { dropped: [], adjusted: [] } };
}
