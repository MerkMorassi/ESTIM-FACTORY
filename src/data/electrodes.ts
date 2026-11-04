/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * E-Stim Systems electrode + power-box profile library.
 *
 * Every number carries a provenance flag:
 *   published  – stated on estim.store or e-stim.info (URL in `source`)
 *   derived    – computed from published numbers (formula in `areaNote`)
 *   estimated  – NOT published by E-Stim Systems; an engineering guess for the
 *                app's model. Treat as a placeholder you can override.
 *
 * Researched 2026-11-04 from estim.store (Shopify catalog) and the e-stim.info
 * manuals. See docs/ESTIM-SYSTEMS-RESEARCH.md for the source notes.
 *
 * The level fields (ceiling / startFraction / rampSec / aiMaxVolume) are this
 * app's own conservative heuristics. E-Stim Systems publishes no such numbers.
 */

export type Provenance = 'published' | 'derived' | 'estimated';

export type ElectrodeCategory = 'ring' | 'ring-system' | 'pad' | 'loop' | 'strap' | 'insertable';

/** How a ring sits: changes how much of the band actually touches skin. */
export type RingFit = 'snug' | 'normal' | 'loose';

export const RING_FIT_CONTACT: Record<RingFit, number> = {
  snug: 0.6,   // estimated
  normal: 0.4, // estimated
  loose: 0.2,  // estimated: the ElectroRing page warns that less contact means more 'hotspots'
};

export interface ElectrodeProfile {
  id: string;
  name: string;
  url: string;
  category: ElectrodeCategory;
  /**
   * monopolar: one conductive contact; needs a second electrode on the SAME channel.
   * bipolar: both poles on one device; fills a whole channel by itself.
   */
  polarity: 'monopolar' | 'bipolar';
  /** 4 mm or 2 mm plugs this electrode takes from one channel (1 for monopolar, 2 for bipolar). */
  leadsUsed: 1 | 2;
  connector: '4mm' | '2mm' | '4mm or 2mm';
  sizeLabel: string;
  material: string;
  materialBasis: Provenance;
  /** Effective conductive area of ONE contact, cm². */
  contactAreaCm2: number;
  areaBasis: Provenance;
  areaNote: string;
  /** Ring geometry, when it applies. */
  ring?: { diameterMm: number; circumferenceMm: number; bandWidthMm: number };
  priceUsd?: number;
  source: string[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// ElectroRings
// ---------------------------------------------------------------------------

/**
 * Published on the ElectroRing Sizing System page (ring diameter -> girth
 * circumference, mm). https://estim.store/products/electroring-sizing-system
 */
export const ELECTRORING_SIZES: { diameterMm: number; circumferenceMm: number; priceUsd: number }[] = [
  { diameterMm: 25, circumferenceMm: 74, priceUsd: 32 },
  { diameterMm: 30, circumferenceMm: 94, priceUsd: 34 },
  { diameterMm: 35, circumferenceMm: 110, priceUsd: 36 },
  { diameterMm: 40, circumferenceMm: 126, priceUsd: 38 },
  { diameterMm: 45, circumferenceMm: 141, priceUsd: 40 },
  { diameterMm: 50, circumferenceMm: 157, priceUsd: 42 },
  { diameterMm: 55, circumferenceMm: 173, priceUsd: 44 },
  { diameterMm: 60, circumferenceMm: 188, priceUsd: 46 },
  { diameterMm: 65, circumferenceMm: 204, priceUsd: 48 },
];

/** Ring band width (axial thickness) is NOT published. Estimated; override in the setup UI if you measure it. */
export const ELECTRORING_BAND_WIDTH_MM_ESTIMATE = 10;

const RING_URL = 'https://estim.store/products/electroring';
const RING_MANUAL = 'https://www.e-stim.info/manuals/electro-rings';

/** Effective skin contact of one ring, cm²: circumference x band width x fit fraction. */
export function ringContactAreaCm2(
  circumferenceMm: number,
  fit: RingFit = 'normal',
  bandWidthMm: number = ELECTRORING_BAND_WIDTH_MM_ESTIMATE,
): number {
  const cm2 = (circumferenceMm / 10) * (bandWidthMm / 10) * RING_FIT_CONTACT[fit];
  return Math.round(cm2 * 100) / 100;
}

const singleRings: ElectrodeProfile[] = ELECTRORING_SIZES.map(s => ({
  id: `electroring-${s.diameterMm}`,
  name: `ElectroRing ${s.diameterMm}mm (single)`,
  url: RING_URL,
  category: 'ring' as const,
  polarity: 'monopolar' as const,
  leadsUsed: 1 as const,
  connector: '4mm' as const,
  sizeLabel: `${s.diameterMm}mm internal diameter, ${s.circumferenceMm}mm circumference`,
  material: 'Aircraft grade aluminium alloy',
  materialBasis: 'published' as const,
  contactAreaCm2: ringContactAreaCm2(s.circumferenceMm),
  areaBasis: 'estimated' as const,
  areaNote: `circumference ${s.circumferenceMm}mm (published) x band width ${ELECTRORING_BAND_WIDTH_MM_ESTIMATE}mm (estimated) x ${RING_FIT_CONTACT.normal} contact fraction for a normal fit (estimated)`,
  ring: { diameterMm: s.diameterMm, circumferenceMm: s.circumferenceMm, bandWidthMm: ELECTRORING_BAND_WIDTH_MM_ESTIMATE },
  priceUsd: s.priceUsd,
  source: [RING_URL, 'https://estim.store/products/electroring-sizing-system', RING_MANUAL],
  notes: [
    'Single monopole: needs a second point of contact on the same channel (manufacturer).',
    'Two sockets, one either side, are the same metal: DO NOT connect two plugs into the same ElectroRing (manual).',
    'Not too tight (circulation) and not too loose (less contact = more hotspots) (manufacturer).',
    'Use water-based conductive gel for sharpness or hotspots (manual).',
    s.diameterMm <= 30 ? 'Small ring: the smallest contact on its channel, so current concentrates here. Start low.' : '',
  ].filter(Boolean),
}));

const SYSTEM_URL = 'https://estim.store/products/electroring-system';

/**
 * The bipolar ElectroRing System: two rings joined by an insulator block.
 * Modeled per contact on the smaller (shaft) ring; the pair is one channel.
 */
function ringSystem(shaftMm: number, rearMm: number): ElectrodeProfile {
  const shaft = ELECTRORING_SIZES.find(s => s.diameterMm === shaftMm)!;
  const rear = ELECTRORING_SIZES.find(s => s.diameterMm === rearMm)!;
  const price = 84 + (shaftMm - 25) / 5 * 2 + (rearMm - 25) / 5 * 2; // matches the published variant grid
  return {
    id: `electroring-system-${shaftMm}-${rearMm}`,
    name: `ElectroRing System ${shaftMm}mm shaft / ${rearMm}mm rear (bipolar)`,
    url: SYSTEM_URL,
    category: 'ring-system',
    polarity: 'bipolar',
    leadsUsed: 2,
    connector: '4mm',
    sizeLabel: `${shaftMm}mm shaft ring + ${rearMm}mm ring behind the testicles, insulator block between`,
    material: 'Aircraft grade aluminium alloy rings, insulating spacer block',
    materialBasis: 'published',
    contactAreaCm2: ringContactAreaCm2(shaft.circumferenceMm),
    areaBasis: 'estimated',
    areaNote: `smaller (shaft) ring governs: ${shaft.circumferenceMm}mm x ${ELECTRORING_BAND_WIDTH_MM_ESTIMATE}mm (est.) x ${RING_FIT_CONTACT.normal}; rear ring ~${ringContactAreaCm2(rear.circumferenceMm)} cm²`,
    ring: { diameterMm: shaftMm, circumferenceMm: shaft.circumferenceMm, bandWidthMm: ELECTRORING_BAND_WIDTH_MM_ESTIMATE },
    priceUsd: price,
    source: [SYSTEM_URL, RING_MANUAL],
    notes: [
      'True bipolar: one 4mm cable, one plug in each ring. DO NOT plug both plugs into the same ring (manual).',
      'Larger ring goes behind the testicles, smaller ring on the shaft, held by two thumb screws (manufacturer).',
      'Optional 30mm Extension Block adds separation; the Stacker adds rings at 20mm spacing, each isolated.',
    ],
  };
}

// The catalog sells every shaft/rear combination 25-65mm. These are the
// combinations the app exposes; add more by calling ringSystem().
const ringSystems: ElectrodeProfile[] = [
  ringSystem(25, 45), ringSystem(30, 45), ringSystem(30, 50), ringSystem(35, 50), ringSystem(35, 55), ringSystem(40, 55),
];

// ---------------------------------------------------------------------------
// Pads, loops, straps, insertables
// ---------------------------------------------------------------------------

const other: ElectrodeProfile[] = [
  {
    id: 'pad-micro-32',
    name: 'Self-adhesive Micro Pad (32mm round)',
    url: 'https://estim.store/products/micro-pads',
    category: 'pad', polarity: 'monopolar', leadsUsed: 1, connector: '2mm',
    sizeLabel: '32mm diameter',
    material: 'Self-adhesive conductive gel pad', materialBasis: 'published',
    contactAreaCm2: 8.04, areaBasis: 'derived', areaNote: 'pi x (1.6 cm)^2 from the published 32mm diameter',
    source: ['https://estim.store/products/micro-pads'],
    notes: ['Pads take 2mm pin leads.'],
  },
  {
    id: 'pad-standard',
    name: 'Standard Self-adhesive Pad',
    url: 'https://estim.store/products/standard-self-adhesive-electro-pads',
    category: 'pad', polarity: 'monopolar', leadsUsed: 1, connector: '2mm',
    sizeLabel: 'square pad (size not published)',
    material: 'Self-adhesive conductive gel pad', materialBasis: 'published',
    contactAreaCm2: 25, areaBasis: 'estimated', areaNote: 'assumes a 50 x 50 mm pad; E-Stim Systems does not publish the size',
    source: ['https://estim.store/products/standard-self-adhesive-electro-pads'],
    notes: ['The 2B ships with sticky pads and 2mm cables (2B manual).', 'Large area: good return / partner electrode for a small ring.'],
  },
  {
    id: 'loop-rubber-4mm',
    name: '4mm Conductive Rubber Loop',
    url: 'https://estim.store/products/4mm-conductive-rubber-cock-loops',
    category: 'loop', polarity: 'monopolar', leadsUsed: 1, connector: '4mm',
    sizeLabel: 'adjustable loop (dimensions not published)',
    material: 'Conductive rubber', materialBasis: 'published',
    contactAreaCm2: 2, areaBasis: 'estimated', areaNote: 'thin cord loop; contact band estimated at ~2 cm²',
    source: ['https://estim.store/products/4mm-conductive-rubber-cock-loops'],
    notes: ['Small contact: treat like a 25mm ring for level planning.'],
  },
  {
    id: 'strap-cock',
    name: 'Electro Cock Strap',
    url: 'https://estim.store/products/electro-cock-straps',
    category: 'strap', polarity: 'monopolar', leadsUsed: 1, connector: '4mm',
    sizeLabel: 'adjustable strap (dimensions not published)',
    material: "'Blue band' antistatic-style strap with a low-resistance snap link (no series resistor)", materialBasis: 'published',
    contactAreaCm2: 10, areaBasis: 'estimated', areaNote: 'wide band around the shaft; ~10 cm² estimated',
    source: ['https://estim.store/products/electro-cock-straps'],
    notes: [],
  },
  {
    id: 'insertable-small-classic',
    name: 'Small Classic Electrode (bipolar insertable)',
    url: 'https://estim.store/products/small-classic-electrode',
    category: 'insertable', polarity: 'bipolar', leadsUsed: 2, connector: '4mm',
    sizeLabel: 'small (dimensions not published)',
    material: 'Metal contacts on insulating body', materialBasis: 'estimated',
    contactAreaCm2: 5, areaBasis: 'estimated', areaNote: 'two bands; ~5 cm² per band estimated',
    source: ['https://estim.store/products/small-classic-electrode', 'https://www.e-stim.info/manuals/insertables'],
    notes: ['Bipolar: one cable, one plug per contact, fills a whole channel.', 'Use water-based lubricant/conductive gel.'],
  },
  {
    id: 'insertable-small-tripple',
    name: 'Small Tripple (3-contact insertable)',
    url: 'https://estim.store/products/small-tripple',
    category: 'insertable', polarity: 'bipolar', leadsUsed: 2, connector: '4mm',
    sizeLabel: 'small, 3 contacts (dimensions not published)',
    material: 'Metal contacts on insulating body', materialBasis: 'estimated',
    contactAreaCm2: 4, areaBasis: 'estimated', areaNote: 'three bands; ~4 cm² per band estimated',
    source: ['https://estim.store/products/small-tripple', 'https://www.e-stim.info/manuals/tripples'],
    notes: ['Three contacts: wire two of them per channel as the Tripple manual shows, or use the TriPhase cable.'],
  },
];

export const ELECTRODES: ElectrodeProfile[] = [...singleRings, ...ringSystems, ...other];

export function getElectrode(id: string | undefined | null): ElectrodeProfile | undefined {
  return ELECTRODES.find(e => e.id === id);
}

/** Accessories that kits reference (no contact of their own). */
export const ACCESSORIES = {
  stacker: { name: 'ElectroRing System Stacker (20mm spacing, keeps rings isolated)', url: 'https://estim.store/products/electroring-system-stacker', priceUsd: 19 },
  extensionBlock: { name: 'ElectroRing Extension Block (30mm spacer)', url: 'https://estim.store/products/electroring-extension-block', priceUsd: 12 },
  triphase: { name: 'TriPhase Cable (2 isolated channels -> 3 non-isolated points; 2mm + 4mm adaptors)', url: 'https://estim.store/products/triphase-cable', priceUsd: 59 },
  cable4mm: { name: '4mm Low Profile Cable (3.5mm jack -> two 4mm plugs, one channel)', url: 'https://estim.store/products/4mm-low-profile-cable', priceUsd: 16 },
  cable2mm: { name: '2mm/TENS Cable (3.5mm jack -> two 2mm plugs, one channel)', url: 'https://estim.store/products/2mm-tens-cable', priceUsd: 14 },
  bicable: { name: 'BiCable (3.5mm jack -> one 4mm + one 2mm plug, one channel)', url: 'https://estim.store/products/bicable', priceUsd: 16 },
  sizingSet: { name: 'ElectroRing Sizing System (3D-printed 25-65mm gauges, not for electroplay)', url: 'https://estim.store/products/electroring-sizing-system', priceUsd: 9.99 },
  gel: { name: 'E-Stim Systems ElectroGel (water-based conductive gel)', url: 'https://estim.store/products/e-stim-systems-electrogel', priceUsd: 12 },
  stereoLink: { name: 'Stereo Link Cable (3.5mm to 3.5mm, 1.2 m, supplied with the 2B)', url: 'https://estim.store/products/stereo-link-cable', priceUsd: 16 },
} as const;

// ---------------------------------------------------------------------------
// Power boxes (how the app's audio is consumed)
// ---------------------------------------------------------------------------

export interface BoxProfile {
  id: string;
  name: string;
  url: string;
  /** true = the box passes the waveform through (stereostim); false = it only follows the audio envelope. */
  passesWaveform: boolean;
  /** Volts peak at app full scale used by the profiler model. null = not published. */
  assumedFullScaleVPeak: number;
  fullScaleBasis: Provenance;
  guidance: string[];
  source: string[];
}

export const BOXES: BoxProfile[] = [
  {
    id: 'generic-stereostim',
    name: 'Generic audio-driven stereostim box',
    url: '',
    passesWaveform: true,
    assumedFullScaleVPeak: 5,
    fullScaleBasis: 'estimated',
    guidance: [
      'The profiler assumes 5 V peak at app full scale (the app\'s original demo value). Real output depends entirely on your box.',
      'Box levels at zero before you connect; raise slowly.',
    ],
    source: [],
  },
  {
    id: 'estim-2b-audio',
    name: 'E-Stim Systems 2B, Stereo / Advanced Stereo audio mode',
    url: 'https://estim.store/products/2b-power-box',
    passesWaveform: false,
    assumedFullScaleVPeak: 5,
    fullScaleBasis: 'estimated',
    guidance: [
      'Switch the 2B to Stereo or Advanced Stereo BEFORE plugging in the audio cable (laptop digital-link detection issue).',
      'Audio goes ONLY into the centre jack. Plugging audio into an output socket will destroy your audio device.',
      'The input expects a low-level headphone-style signal.',
      'Left audio drives channel A, right audio drives channel B. A and B knobs set how much of the audio drive reaches each output; they start at OFF.',
      'Set the app volume so the 2B bar graphs move as much as possible but never sit as a solid, stationary bar. Overdriving does not raise output and loses detail.',
      'The 2B is not a simple stereostim amplifier: its DSP reshapes the input and is not designed for single sine tones. Carrier frequency and waveform in this app do not reach the electrodes; rhythm and level (the envelope) do. Use Burst, Sequence or Sweep modes and the composer rather than steady tones.',
      'Adjust sets response speed (Advanced Stereo: low = smoother, high = sharper).',
      'Start in Low power (L, the default). High and Dynamic are for experienced users.',
      'The 2B\'s output voltage and current are not published, so the profiler\'s numbers are a relative model only.',
    ],
    source: ['https://www.e-stim.info/manuals/2b22/audio', 'https://www.e-stim.info/manuals/2b22/introduction', 'https://www.e-stim.info/manuals/2b22/getting-started'],
  },
];

export function getBox(id: string | undefined | null): BoxProfile {
  return BOXES.find(b => b.id === id) ?? BOXES[0];
}

// ---------------------------------------------------------------------------
// Safety model (app heuristics, not manufacturer numbers)
// ---------------------------------------------------------------------------

/**
 * IEC 60601-2-10 (nerve and muscle stimulators) asks manufacturers to draw
 * attention to current densities above 2 mA r.m.s./cm² on any electrode.
 * Used here as the warning line for the profiler's (modeled) current density.
 */
export const CURRENT_DENSITY_ATTENTION_MA_RMS_PER_CM2 = 2;

/** Below this effective contact area an electrode is treated as 'small'. */
export const SMALL_CONTACT_CM2 = 4;

export interface ElectrodeGuard {
  /** Fraction (0..1) of the engine's existing 0.5 safety ceiling this channel may reach. Never > 1. */
  ceiling: number;
  /** Soft start begins at ceiling x startFraction. */
  startFraction: number;
  /** Soft start ramps from start to ceiling over this many seconds. */
  rampSec: number;
  /** Highest masterVolume the AI co-pilot may set on this channel. */
  aiMaxVolume: number;
}

export const DEFAULT_GUARD: ElectrodeGuard = { ceiling: 1, startFraction: 0.35, rampSec: 60, aiMaxVolume: 0.8 };

/**
 * Guard from the smallest effective contact on a channel. Small contacts get a
 * lower ceiling and a lower starting level; everything ramps over 60 s.
 */
export function guardForArea(minContactCm2: number): ElectrodeGuard {
  const a = Math.max(0.1, minContactCm2);
  const ceiling = Math.min(1, Math.max(0.4, a / 6));
  const small = a < SMALL_CONTACT_CM2;
  return {
    ceiling: Math.round(ceiling * 100) / 100,
    startFraction: small ? 0.2 : 0.35,
    rampSec: 60,
    aiMaxVolume: small ? 0.6 : 0.8,
  };
}
