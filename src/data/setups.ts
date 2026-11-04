/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Ready-made electrode setups (kits) built from E-Stim Systems products, plus
 * the per-channel electrode selection model. Designed by Maya
 * (SYS.AI.MAYA.GITHUB) from the catalog research in electrodes.ts.
 *
 * Channel mapping follows the 2B audio manual: LEFT audio -> channel A,
 * RIGHT audio -> channel B. Every channel needs two contacts on the SAME
 * channel; a bipolar electrode provides both. The ElectroRing manual forbids
 * two plugs in one ring, so a ring never carries two channels.
 */

import {
  ACCESSORIES, ELECTRODES, ElectrodeGuard, ElectrodeProfile, RingFit, DEFAULT_GUARD,
  getElectrode, guardForArea, ringContactAreaCm2, SMALL_CONTACT_CM2,
} from './electrodes';

export type ChannelKey = 'left' | 'right';
export type Topology = 'single-channel' | 'dual-isolated' | 'triphase';

export interface ChannelElectrodes {
  /** Main electrode on this channel. null = channel unused. */
  primary: string | null;
  /** Second contact for a monopolar primary. Ignored when primary is bipolar. */
  partner: string | null;
  primaryRole?: string;
  partnerRole?: string;
}

export interface ElectrodeSetupState {
  setupId: string; // a kit id, or 'custom'
  topology: Topology;
  left: ChannelElectrodes;
  right: ChannelElectrodes;
  /** TriPhase only: the shared third contact. */
  common: string | null;
  ringFit: RingFit;
  ringBandWidthMm: number;
  boxId: string;
}

export interface ProductLine { name: string; url: string; qty: number; option?: string }

export interface KitDefinition {
  id: string;
  name: string;
  summary: string;
  topology: Topology;
  left: ChannelElectrodes;
  right: ChannelElectrodes;
  common?: string | null;
  commonRole?: string;
  products: ProductLine[];
  /** Wiring, step by step, per channel. */
  wiring: { left: string[]; right: string[]; common?: string[] };
  recommendedPresets: string[];
  notes: string[];
}

const P = (id: string) => {
  const e = getElectrode(id);
  if (!e) throw new Error(`unknown electrode ${id}`);
  return e;
};
const ringProduct = (mm: number, qty = 1): ProductLine => ({ name: 'ElectroRing (single)', url: P(`electroring-${mm}`).url, qty, option: `${mm}mm` });
const systemProduct = (shaft: number, rear: number): ProductLine => ({ name: 'ElectroRing System (bipolar)', url: P(`electroring-system-${shaft}-${rear}`).url, qty: 1, option: `${shaft}mm shaft / ${rear}mm rear` });
const acc = (k: keyof typeof ACCESSORIES, qty = 1): ProductLine => ({ name: ACCESSORIES[k].name, url: ACCESSORIES[k].url, qty });

const OFF: ChannelElectrodes = { primary: null, partner: null };

export const KITS: KitDefinition[] = [
  {
    id: 'kit-ring25-pad',
    name: 'Single 25mm ElectroRing + pad return (1 channel)',
    summary: 'The smallest ring on the shaft, a large sticky pad as the return. Smallest contact in the catalog, so this kit gets the lowest ceiling and slowest start.',
    topology: 'single-channel',
    left: { primary: 'electroring-25', partner: 'pad-standard', primaryRole: 'Shaft ring', partnerRole: 'Return pad on the perineum' },
    right: OFF,
    products: [ringProduct(25), { name: 'Standard Self-adhesive Pads', url: P('pad-standard').url, qty: 1 }, acc('bicable'), acc('gel'), acc('sizingSet')],
    wiring: {
      left: [
        'Channel A (LEFT audio). Use the BiCable: its 4mm plug into either socket of the 25mm ring, its 2mm pin into the pad.',
        'Only ONE plug in the ring. The second socket stays empty (manual: never two plugs in one ElectroRing).',
        'Pad on the perineum, on the midline, below the waist.',
      ],
      right: ['Channel B unused. Keep the B knob at OFF.'],
    },
    recommendedPresets: ['climbing-crescendo', 'burst-reflex-150', 'arousal-pulsed-80', 'sequenced-recruitment'],
    notes: ['Check fit with the Sizing System gauges first: snug, not tight.', 'Gel on the ring band reduces hotspots on a small ring.'],
  },
  {
    id: 'kit-ring-system-bipolar',
    name: 'ElectroRing System, bipolar (1 channel)',
    summary: 'Shaft ring + ring behind the testicles joined by the insulator block. Both rings are the two poles of one channel; no extra electrode needed.',
    topology: 'single-channel',
    left: { primary: 'electroring-system-30-45', partner: null, primaryRole: 'Shaft ring + rear ring (one bipolar electrode)' },
    right: OFF,
    products: [systemProduct(30, 45), acc('cable4mm'), acc('gel'), acc('sizingSet')],
    wiring: {
      left: [
        'Channel A (LEFT audio). One 4mm cable: one plug into the shaft ring, the other plug into the rear ring.',
        'Never both plugs into the same ring.',
        'Optional: an Extension Block (30mm) between the rings spreads the sensation further.',
      ],
      right: ['Channel B free for a second electrode, or unused with the B knob at OFF.'],
    },
    recommendedPresets: ['climbing-crescendo', 'edge-crescendo', 'gallop-sequence', 'arousal-pulsed-80', 'chaotic-sweep'],
    notes: ['Sizes are a guide (30 / 45mm shown). Pick from the gauges; any 25-65mm combination is sold.'],
  },
  {
    id: 'kit-shaft-testicle-triphase',
    name: 'Shaft + testicle, 2 channels via TriPhase',
    summary: 'Each ring on its own channel. A third ring on a Stacker is the shared common, so the shaft and testicle rings can be driven separately (left/right audio) with every ring taking exactly one plug.',
    topology: 'triphase',
    left: { primary: 'electroring-30', partner: null, primaryRole: 'Shaft ring (point A)' },
    right: { primary: 'electroring-45', partner: null, primaryRole: 'Testicle ring behind the testicles (point B)' },
    common: 'electroring-35',
    commonRole: 'Common ring on the Stacker, base of the shaft',
    products: [systemProduct(30, 45), acc('stacker'), ringProduct(35), acc('triphase'), acc('gel'), acc('sizingSet')],
    wiring: {
      left: ['TriPhase point A -> shaft ring (one plug).', 'Channel A level (LEFT audio) mostly shapes the shaft ring.'],
      right: ['TriPhase point B -> testicle ring (one plug).', 'Channel B level (RIGHT audio) mostly shapes the testicle ring.'],
      common: [
        'TriPhase common -> the third ring mounted on the Stacker (one plug).',
        'Which TriPhase lead is the common is not documented on the product page: check the cable\'s labelling before plugging in.',
        'Plug the TriPhase cable into BOTH 2B channel outputs; TriPhase needs a dual-isolated-channel box.',
      ],
    },
    recommendedPresets: ['phase-swirl', 'binaural-tissue-beat', 'pr-climb-pulse', 'climbing-crescendo'],
    notes: [
      'The two channels share the common, so they are no longer isolated from each other: per the TriPhase product page, it converts 2 isolated channels into 3 non-isolated points.',
      'A ring\'s second socket is NOT a second channel input. It is the same metal, and the manual forbids two plugs in one ring.',
    ],
  },
  {
    id: 'kit-shaft-testicle-isolated',
    name: 'Shaft + testicle, 2 isolated channels',
    summary: 'ElectroRing System mounted as usual, but each ring wired to its own channel with its own partner: shaft ring + cock strap on A, testicle ring + perineum pad on B.',
    topology: 'dual-isolated',
    left: { primary: 'electroring-30', partner: 'strap-cock', primaryRole: 'Shaft ring', partnerRole: 'Electro Cock Strap just below the glans' },
    right: { primary: 'electroring-45', partner: 'pad-standard', primaryRole: 'Testicle ring', partnerRole: 'Return pad on the perineum' },
    products: [systemProduct(30, 45), { name: 'Electro Cock Strap', url: P('strap-cock').url, qty: 1 }, { name: 'Standard Self-adhesive Pads', url: P('pad-standard').url, qty: 1 }, acc('cable4mm'), acc('bicable'), acc('gel')],
    wiring: {
      left: ['Channel A (LEFT audio), 4mm cable: one plug -> shaft ring, the other -> cock strap.'],
      right: ['Channel B (RIGHT audio), BiCable: 4mm plug -> testicle ring, 2mm pin -> perineum pad.'],
    },
    recommendedPresets: ['pr-tonic-reflex', 'pr-climb-pulse', 'binaural-tissue-beat', 'edge-crescendo'],
    notes: ['The insulator block keeps the two rings isolated, so A and B stay fully separate channels.', 'Each ring still takes exactly one plug.'],
  },
  {
    id: 'kit-insertable-ring-system',
    name: 'Small Classic insertable + ElectroRing System (2 channels)',
    summary: 'Two bipolar electrodes, one per channel: the insertable on A, the ring pair on B. No partner electrodes needed.',
    topology: 'dual-isolated',
    left: { primary: 'insertable-small-classic', partner: null, primaryRole: 'Small Classic insertable' },
    right: { primary: 'electroring-system-30-45', partner: null, primaryRole: 'Shaft ring + rear ring' },
    products: [{ name: 'Small Classic Electrode', url: P('insertable-small-classic').url, qty: 1 }, systemProduct(30, 45), acc('cable4mm', 2), acc('gel')],
    wiring: {
      left: ['Channel A (LEFT audio), 4mm cable: one plug into each contact socket of the insertable.'],
      right: ['Channel B (RIGHT audio), 4mm cable: one plug -> shaft ring, the other -> rear ring.'],
    },
    recommendedPresets: ['pr-harmonic-sync', 'pr-tonic-reflex', 'pr-climb-pulse', 'pr-cross-theta'],
    notes: ['Water-based lubricant / gel on the insertable.'],
  },
  {
    id: 'kit-pads-starter',
    name: 'Pads starter (2 channels, what the 2B ships with)',
    summary: 'Two sticky pads per channel, each channel kept on one side of the body, below the waist.',
    topology: 'dual-isolated',
    left: { primary: 'pad-standard', partner: 'pad-standard', primaryRole: 'Pad', partnerRole: 'Pad, same side' },
    right: { primary: 'pad-standard', partner: 'pad-standard', primaryRole: 'Pad', partnerRole: 'Pad, same side' },
    products: [{ name: 'Standard Self-adhesive Pads', url: P('pad-standard').url, qty: 2 }, acc('cable2mm', 2)],
    wiring: {
      left: ['Channel A, 2mm cable: both pads on the LEFT thigh/buttock.'],
      right: ['Channel B, 2mm cable: both pads on the RIGHT thigh/buttock.'],
    },
    recommendedPresets: ['tens-symmetrical-1200', 'somatic-breath', 'phase-swirl', 'stochastic-sparkle'],
    notes: ['A channel never runs from one side of the body to the other.'],
  },
];

export function getKit(id: string | undefined | null): KitDefinition | undefined {
  return KITS.find(k => k.id === id);
}

export const DEFAULT_SETUP: ElectrodeSetupState = {
  setupId: 'custom',
  topology: 'dual-isolated',
  left: { primary: null, partner: null },
  right: { primary: null, partner: null },
  common: null,
  ringFit: 'normal',
  ringBandWidthMm: 10,
  boxId: 'estim-2b-audio',
};

export function setupFromKit(kit: KitDefinition, prev: ElectrodeSetupState): ElectrodeSetupState {
  return {
    ...prev,
    setupId: kit.id,
    topology: kit.topology,
    left: { ...kit.left },
    right: { ...kit.right },
    common: kit.common ?? null,
  };
}

/** Effective area of one contact, honouring ring fit / band width. */
export function effectiveContactCm2(e: ElectrodeProfile, s: Pick<ElectrodeSetupState, 'ringFit' | 'ringBandWidthMm'>): number {
  if (e.ring) return ringContactAreaCm2(e.ring.circumferenceMm, s.ringFit, s.ringBandWidthMm);
  return e.contactAreaCm2;
}

export interface ChannelAnalysis {
  active: boolean;
  electrodes: { profile: ElectrodeProfile; role: string; areaCm2: number }[];
  /** Smallest contact in the current path: the one that sets current density. */
  minContactCm2: number | null;
  smallest?: string;
  guard: ElectrodeGuard;
  problems: string[];
  warnings: string[];
}

/** Analyse one channel of a setup: completeness, smallest contact, guard. */
export function analyseChannel(s: ElectrodeSetupState, ch: ChannelKey): ChannelAnalysis {
  const c = s[ch];
  const problems: string[] = [];
  const warnings: string[] = [];
  const electrodes: ChannelAnalysis['electrodes'] = [];
  const add = (id: string | null, role: string) => {
    const e = getElectrode(id);
    if (e) electrodes.push({ profile: e, role, areaCm2: effectiveContactCm2(e, s) });
  };
  add(c.primary, c.primaryRole ?? 'Primary');
  const prim = getElectrode(c.primary);
  if (!prim) {
    return { active: false, electrodes: [], minContactCm2: null, guard: { ...DEFAULT_GUARD }, problems, warnings };
  }
  if (s.topology === 'triphase') {
    if (prim.polarity === 'bipolar') problems.push('TriPhase points take one contact each; a bipolar electrode does not fit a TriPhase point.');
    if (!s.common) problems.push('TriPhase needs a common (third) electrode.');
    else add(s.common, 'TriPhase common');
  } else if (prim.polarity === 'monopolar') {
    if (!c.partner) problems.push(`${prim.name} is monopolar: add a second electrode on this channel (a return).`);
    else add(c.partner, c.partnerRole ?? 'Partner / return');
    if (c.partner && c.partner === c.primary && prim.category === 'ring') {
      problems.push('Both leads of one channel cannot go to the same ring. Use two rings (Stacker / System) or a ring + another electrode.');
    }
  }
  const min = electrodes.reduce<{ a: number; n: string } | null>((m, e) => (!m || e.areaCm2 < m.a ? { a: e.areaCm2, n: e.profile.name } : m), null);
  const guard = min ? guardForArea(min.a) : { ...DEFAULT_GUARD };
  if (min && min.a < SMALL_CONTACT_CM2) {
    warnings.push(`Small contact (${min.n}, ~${min.a.toFixed(1)} cm\u00b2 est.): current concentrates there. Ceiling ${Math.round(guard.ceiling * 100)}% of the app cap, soft start from ${Math.round(guard.startFraction * 100)}%.`);
  }
  if (electrodes.some(e => e.profile.areaBasis === 'estimated')) {
    warnings.push('Some contact areas are estimates (E-Stim Systems does not publish them).');
  }
  return { active: true, electrodes, minContactCm2: min?.a ?? null, smallest: min?.n, guard, problems, warnings };
}

export const PLACEMENT_RULES: string[] = [
  'Never above the waist. Never across the chest, heart, neck or head (E-Stim Systems: across the arms counts too).',
  'Never run one channel from one side of the body to the other: keep each channel\'s two contacts on the same side or on the midline below the waist.',
  'Not with a pacemaker or other implanted electrical device, epilepsy, pregnancy or certain heart conditions (E-Stim Systems). If unsure, ask a doctor.',
  'Box levels at zero / OFF before connecting or moving electrodes. Raise slowly.',
  'Never two plugs in the same ElectroRing (manual).',
];

/** Which kits list a preset. */
export function kitsForPreset(presetId: string): KitDefinition[] {
  return KITS.filter(k => k.recommendedPresets.includes(presetId));
}

export function listElectrodes(): ElectrodeProfile[] { return ELECTRODES; }
