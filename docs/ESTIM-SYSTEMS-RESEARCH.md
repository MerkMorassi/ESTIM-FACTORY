# E-Stim Systems research notes (2026-11-04)

Source of truth for `src/data/electrodes.ts` and `src/data/setups.ts`.
Catalog read from the estim.store Shopify product feed; manuals from e-stim.info.
Anything not stated by E-Stim Systems is marked **estimated**.

## ElectroRing (single) — https://estim.store/products/electroring
- Monopole. Aircraft grade aluminium alloy. Heavy duty 4mm socket, one either side.
- "Although the ElectroRing has two sockets, one either side, do not connect both sockets to the same channel."
- Manual (https://www.e-stim.info/manuals/electro-rings): "DO NOT connect two plugs into the same ElectroRing."
- A single ring needs a second point of contact. Not too tight (circulation), not too loose (less contact = more hotspots). Gel recommended.
- Sizes / price (USD): 25 $32, 30 $34, 35 $36, 40 $38, 45 $40, 50 $42, 55 $44, 60 $46, 65 $48.
- Circumference per size (ElectroRing Sizing System page, https://estim.store/products/electroring-sizing-system):
  25→74mm, 30→94, 35→110, 40→126, 45→141, 50→157, 55→173, 60→188, 65→204.
- Band width: **not published** (app estimate 10mm). Contact area = circumference x band width x fit fraction (**estimated** 0.6 snug / 0.4 normal / 0.2 loose).
- No "ring necklace" exists in the catalog (0 of 118 products mention a necklace); the single rings are the 25–65mm line.

## ElectroRing System (bipolar) — https://estim.store/products/electroring-system
- Two rings separated by an insulator block: "true bipolar". Larger ring behind the testicles, smaller ring on the shaft (two thumb screws, or hex bolts).
- Any shaft/rear combination 25–65mm; $84 (25/25) upward, +$2 per 5mm step on either ring.
- Wiring (manual): one 4mm cable, "insert one plug into one ring, and the other plug on the other ring. DO NOT plug both plugs into the same ring." = one channel.
- Stacker ($19, https://estim.store/products/electroring-system-stacker): extra rings at 20mm spacing, each electrically isolated. One stacker per extra ring.
- Extension Block ($12, https://estim.store/products/electroring-extension-block): 30mm spacer for more separation.

## Two-channel ring wiring (shaft + testicle on separate channels)
- The two sockets on a ring are the same piece of metal, so they cannot carry two channels: the manual forbids two plugs in one ring.
- Supported routes:
  1. TriPhase Cable ($59, https://estim.store/products/triphase-cable): converts the 2B's two isolated channels into 3 non-isolated contact points; 2mm and 4mm adaptors supplied. Shaft ring, testicle ring and a third (common) contact each take one plug.
  2. Two ordinary channel cables, each ring with its own partner electrode (e.g. shaft ring + strap/loop, testicle ring + perineum pad).
- Which TriPhase lead is the common is not documented on the product page: check the cable's own labelling.

## Other electrodes used
- Micro pads, 32mm diameter, 2mm, monopole, $16 — https://estim.store/products/micro-pads (area 8.04 cm², derived).
- Standard self-adhesive pads, 2mm, monopole, $10 — size **not published** (app estimate 50x50mm) — https://estim.store/products/standard-self-adhesive-electro-pads
- 4mm Conductive Rubber Loops — https://estim.store/products/4mm-conductive-rubber-cock-loops (contact **estimated** 2 cm²)
- Electro Cock Straps, 4mm, monopole, $32, 'blue band' with low-resistance snap link — https://estim.store/products/electro-cock-straps
- Small Classic Electrode, 4mm, bipolar insertable, $49 — https://estim.store/products/small-classic-electrode
- Small Tripple, 3-contact insertable — https://estim.store/products/small-tripple ; manual https://www.e-stim.info/manuals/tripples
- Cables: 4mm Low Profile (two 4mm), 2mm/TENS (two 2mm), BiCable (one 4mm + one 2mm), Stereo Link (3.5mm audio, 1.2 m, supplied with the 2B).

## 2B audio input — https://www.e-stim.info/manuals/2b22/audio
- Three audio modes: Stereo, Advanced Stereo, Microphone. Left audio → channel A, right → channel B (dual isolated outputs).
- A/B knobs set the percentage of audio drive passed to each output. Levels start at OFF.
- "The 2B is not a simple StereoStim amplifier. It is not designed to be used with single monotonal signals such as sinewaves" — DSP reshapes the input. App carrier frequency/waveform does not reach the electrodes; the envelope does.
- Aim for maximum bar-graph movement; never a solid stationary bar. Overdriving does not increase output.
- Switch to an audio mode BEFORE connecting the audio cable. Audio only into the centre jack; an output socket will destroy the audio device. Input expects low-level headphone-style signal.
- Power levels L (default, beginners), H, D. Output voltage/current: **not published**.
- Safety (2B manual): nothing above the waist (across the arms counts), especially not across heart, chest, neck or head; not with a pacemaker, epilepsy, or pregnancy.

## Current density reference
- IEC 60601-2-10 asks for attention to current densities above 2 mA r.m.s./cm² on any electrode. Used as the app's warning line for its modeled current density.
