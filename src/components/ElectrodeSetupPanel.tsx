/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Electrode setup: E-Stim Systems kits, per-channel electrode selector,
 * wiring guidance, placement safety and 2B audio guidance.
 * SYS.AI.MAYA.GITHUB
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cable, CircleDot, ExternalLink, ShieldAlert } from 'lucide-react';
import { BOXES, ELECTRODES, RingFit, getBox, getElectrode } from '../data/electrodes';
import {
  ChannelKey, ElectrodeSetupState, KITS, PLACEMENT_RULES, Topology,
  analyseChannel, getKit, setupFromKit,
} from '../data/setups';
import { SAFETY_CEILING_GAIN, SignalEngine } from '../audio/signalEngine';

interface Props {
  setup: ElectrodeSetupState;
  onChange: (s: ElectrodeSetupState) => void;
  engine: SignalEngine | null;
  isRunning: boolean;
}

const CH_LABEL: Record<ChannelKey, string> = { left: 'CH A (left audio)', right: 'CH B (right audio)' };

const basisTag = (b: string) => (
  <span className={`ml-1 px-1 rounded text-[8px] uppercase ${b === 'published' ? 'bg-emerald-950 text-emerald-300' : b === 'derived' ? 'bg-sky-950 text-sky-300' : 'bg-amber-950 text-amber-300'}`}>{b}</span>
);

const ElectrodeSelect: React.FC<{ value: string | null; onChange: (v: string | null) => void; disabled?: boolean; filter?: (id: string) => boolean; placeholder: string }> = ({ value, onChange, disabled, filter, placeholder }) => (
  <select
    disabled={disabled}
    value={value ?? ''}
    onChange={e => onChange(e.target.value || null)}
    className="w-full bg-[#0a1118] border border-[#1a2634] rounded px-2 py-1 text-[10px] text-slate-200 disabled:opacity-40"
  >
    <option value="">{placeholder}</option>
    {(['ring', 'ring-system', 'pad', 'loop', 'strap', 'insertable'] as const).map(cat => (
      <optgroup key={cat} label={cat.toUpperCase()}>
        {ELECTRODES.filter(e => e.category === cat && (!filter || filter(e.id))).map(e => (
          <option key={e.id} value={e.id}>{e.name}{e.polarity === 'bipolar' ? ' [bipolar]' : ''}</option>
        ))}
      </optgroup>
    ))}
  </select>
);

export const ElectrodeSetupPanel: React.FC<Props> = ({ setup, onChange, engine, isRunning }) => {
  const kit = getKit(setup.setupId);
  const box = getBox(setup.boxId);
  const analysis = { left: analyseChannel(setup, 'left'), right: analyseChannel(setup, 'right') };

  // Live soft-start readout.
  const [elapsed, setElapsed] = useState<{ left: number | null; right: number | null }>({ left: null, right: null });
  useEffect(() => {
    if (!isRunning || !engine) { setElapsed({ left: null, right: null }); return; }
    const id = window.setInterval(() => setElapsed({ left: engine.getSoftStartElapsed('left'), right: engine.getSoftStartElapsed('right') }), 500);
    return () => window.clearInterval(id);
  }, [isRunning, engine]);

  const setChannel = (ch: ChannelKey, patch: Partial<ElectrodeSetupState['left']>) =>
    onChange({ ...setup, setupId: 'custom', [ch]: { ...setup[ch], ...patch } });

  return (
    <div className="bg-[#0d151d] border border-[#1a2634] rounded-lg p-4 flex flex-col gap-4 text-slate-300">
      {/* Placement safety */}
      <div className="border border-red-900 bg-red-950/40 rounded p-3">
        <div className="flex items-center gap-2 text-red-300 text-[11px] font-black uppercase mb-1">
          <ShieldAlert className="w-4 h-4" /> Placement safety
        </div>
        <ul className="list-disc ml-5 text-[10px] text-red-200 space-y-0.5">
          {PLACEMENT_RULES.map(r => <li key={r}>{r}</li>)}
        </ul>
      </div>

      {/* Box */}
      <div>
        <div className="text-[10px] font-black uppercase text-cyan-300 mb-1">Power box</div>
        <select value={setup.boxId} onChange={e => onChange({ ...setup, boxId: e.target.value })} className="bg-[#0a1118] border border-[#1a2634] rounded px-2 py-1 text-[10px] text-slate-200">
          {BOXES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <ul className="list-disc ml-5 mt-2 text-[10px] text-slate-400 space-y-0.5">
          {box.guidance.map(g => <li key={g}>{g}</li>)}
        </ul>
        {box.source.length > 0 && (
          <div className="text-[9px] text-slate-500 mt-1">Source: {box.source.map(u => <a key={u} href={u} target="_blank" rel="noreferrer" className="underline mr-2">{u.replace('https://', '')}</a>)}</div>
        )}
      </div>

      {/* Kits */}
      <div>
        <div className="text-[10px] font-black uppercase text-cyan-300 mb-1">Ready-made setups (E-Stim Systems)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {KITS.map(k => (
            <button
              key={k.id}
              onClick={() => onChange(setupFromKit(k, setup))}
              className={`text-left p-2 rounded border ${setup.setupId === k.id ? 'border-cyan-600 bg-[#122030]' : 'border-[#1a2634] hover:border-slate-600'}`}
            >
              <div className="text-[10px] font-black text-slate-100">{k.name}</div>
              <div className="text-[9px] text-slate-400 mt-0.5">{k.summary}</div>
              <div className="text-[8px] uppercase text-slate-500 mt-1">{k.topology}</div>
            </button>
          ))}
          <button
            onClick={() => onChange({ ...setup, setupId: 'custom' })}
            className={`text-left p-2 rounded border ${setup.setupId === 'custom' ? 'border-cyan-600 bg-[#122030]' : 'border-[#1a2634] hover:border-slate-600'}`}
          >
            <div className="text-[10px] font-black text-slate-100">Custom</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Pick electrodes per channel below.</div>
          </button>
        </div>
      </div>

      {kit && (
        <div className="border border-[#1a2634] rounded p-3">
          <div className="text-[10px] font-black uppercase text-cyan-300 mb-1 flex items-center gap-1"><Cable className="w-3.5 h-3.5" /> {kit.name}: parts + wiring</div>
          <ul className="text-[10px] space-y-0.5 mb-2">
            {kit.products.map(p => (
              <li key={p.name + (p.option ?? '')}>
                {p.qty} x <a href={p.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">{p.name}</a>{p.option ? ` (${p.option})` : ''} <ExternalLink className="inline w-2.5 h-2.5" />
              </li>
            ))}
          </ul>
          {(['left', 'right'] as const).map(ch => (
            <div key={ch} className="mb-1">
              <div className="text-[9px] font-black uppercase text-slate-400">{CH_LABEL[ch]}</div>
              <ul className="list-disc ml-5 text-[10px]">{kit.wiring[ch].map(w => <li key={w}>{w}</li>)}</ul>
            </div>
          ))}
          {kit.wiring.common && (
            <div className="mb-1">
              <div className="text-[9px] font-black uppercase text-slate-400">TriPhase common</div>
              <ul className="list-disc ml-5 text-[10px]">{kit.wiring.common.map(w => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
          <ul className="list-disc ml-5 text-[10px] text-amber-200 mt-1">{kit.notes.map(n => <li key={n}>{n}</li>)}</ul>
          <div className="text-[9px] text-slate-500 mt-1">Matching presets: {kit.recommendedPresets.join(', ')}</div>
        </div>
      )}

      {/* Custom / per-channel selector */}
      <div className="border border-[#1a2634] rounded p-3">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <div className="text-[10px] font-black uppercase text-cyan-300">Electrodes per channel</div>
          <label className="text-[9px] text-slate-400">Topology{' '}
            <select value={setup.topology} onChange={e => onChange({ ...setup, setupId: 'custom', topology: e.target.value as Topology })} className="bg-[#0a1118] border border-[#1a2634] rounded px-1 py-0.5 text-[10px] text-slate-200">
              <option value="single-channel">Single channel</option>
              <option value="dual-isolated">Two isolated channels</option>
              <option value="triphase">TriPhase (3 points, shared common)</option>
            </select>
          </label>
          <label className="text-[9px] text-slate-400">Ring fit{' '}
            <select value={setup.ringFit} onChange={e => onChange({ ...setup, ringFit: e.target.value as RingFit })} className="bg-[#0a1118] border border-[#1a2634] rounded px-1 py-0.5 text-[10px] text-slate-200">
              <option value="snug">Snug</option>
              <option value="normal">Normal</option>
              <option value="loose">Loose</option>
            </select>
          </label>
          <label className="text-[9px] text-slate-400">Ring band width (mm, est.){' '}
            <input type="number" min={3} max={30} step={1} value={setup.ringBandWidthMm}
              onChange={e => onChange({ ...setup, ringBandWidthMm: Math.min(30, Math.max(3, Number(e.target.value) || 10)) })}
              className="w-12 bg-[#0a1118] border border-[#1a2634] rounded px-1 py-0.5 text-[10px] text-slate-200" />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(['left', 'right'] as const).map(ch => {
            const a = analysis[ch];
            const prim = getElectrode(setup[ch].primary);
            const needsPartner = setup.topology !== 'triphase' && prim?.polarity === 'monopolar';
            const el = elapsed[ch];
            const g = a.guard;
            const level = el === null ? null : Math.min(1, g.startFraction + (1 - g.startFraction) * Math.min(1, el / Math.max(1, g.rampSec)));
            return (
              <div key={ch} className="bg-[#0a1118] border border-[#1a2634] rounded p-2 flex flex-col gap-1.5">
                <div className="text-[10px] font-black uppercase text-slate-200 flex items-center gap-1"><CircleDot className="w-3 h-3" /> {CH_LABEL[ch]}</div>
                <ElectrodeSelect value={setup[ch].primary} placeholder="(unused / not set)" onChange={v => setChannel(ch, { primary: v, primaryRole: undefined })} />
                <ElectrodeSelect value={setup[ch].partner} placeholder={needsPartner ? 'Return / partner electrode...' : 'No partner needed'} disabled={!needsPartner}
                  filter={id => getElectrode(id)?.polarity === 'monopolar'} onChange={v => setChannel(ch, { partner: v, partnerRole: undefined })} />
                {a.active && (
                  <div className="text-[9px] space-y-0.5">
                    {a.electrodes.map((e, i) => (
                      <div key={i}>{e.role}: <a href={e.profile.url} target="_blank" rel="noreferrer" className="text-sky-300 underline">{e.profile.name}</a> ~{e.areaCm2.toFixed(2)} cm²{basisTag(e.profile.ring ? 'estimated' : e.profile.areaBasis)}</div>
                    ))}
                    <div className="text-slate-400">Peak cap {(SAFETY_CEILING_GAIN * g.ceiling).toFixed(3)} FS ({Math.round(g.ceiling * 100)}% of the 0.5 app cap), soft start {Math.round(g.startFraction * 100)}% to 100% over {g.rampSec}s, AI volume max {g.aiMaxVolume}</div>
                    {level !== null && <div className="text-cyan-300">Soft start: {Math.round(level * 100)}% of channel cap ({Math.round(el!)}s)</div>}
                  </div>
                )}
                {!a.active && <div className="text-[9px] text-slate-500">{setup.setupId !== 'custom' ? 'Unused in this setup: output held at 0. Keep the box knob OFF.' : 'No electrode set: default guard (full app cap, 60 s soft start).'}</div>}
                {a.problems.map(p => <div key={p} className="text-[9px] text-red-300 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{p}</div>)}
                {a.warnings.map(w => <div key={w} className="text-[9px] text-amber-300 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{w}</div>)}
              </div>
            );
          })}
        </div>

        {setup.topology === 'triphase' && (
          <div className="mt-2">
            <div className="text-[9px] font-black uppercase text-slate-400 mb-1">TriPhase common (third point)</div>
            <ElectrodeSelect value={setup.common} placeholder="Common electrode..." filter={id => getElectrode(id)?.polarity === 'monopolar'}
              onChange={v => onChange({ ...setup, setupId: 'custom', common: v })} />
            <div className="text-[9px] text-amber-300 mt-1">TriPhase joins the two channels through the common: they are no longer isolated. Needs the TriPhase cable and a dual-isolated box such as the 2B.</div>
          </div>
        )}
      </div>
    </div>
  );
};
