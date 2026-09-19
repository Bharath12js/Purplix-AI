# Purplix AI — design system

The UI runs entirely on `src/data/fixtures.ts`. No backend required, and the
fixture shapes are the data contract — when the Red/Blue/Purple specs land,
they should either match these shapes or tell us why not.

```bash
cd purplix/web && npx vite     # http://127.0.0.1:5173
```

---

## 1. The palette is the product thesis

The mark's shield runs **crimson → purple → steel blue**. That is Red → Purple
→ Blue. So colour is allowed to carry meaning, and the system rests on one rule:

| Hue | Token | Means | May be used for |
|---|---|---|---|
| Purple | `brand` | assurance, platform, the loop | brand accents, primary actions, held-out metrics |
| Crimson | `crimson` | **offensive** | attacker input, breaches, findings, severity |
| Steel blue | `steel` | **defensive** | controls, policy layers, blocked traffic |

**Crimson and steel are never decorative.** A crimson button that doesn't mean
offence is a bug, not a style choice. This is the single rule that makes six
pages read as one product — break it and the platform looks like a template.

Full tokens live in `tailwind.config.ts`. Greys: `ink` (headings) → `body`
(prose) → `muted` (labels) → `faint` (metadata).

Each hue is a full **50–900 ramp**, not three stops. Tints, borders and hover
states get picked off a scale; otherwise every component invents its own
near-miss and the product drifts within a fortnight.

## 2. Form

- **Cards are a 1px border plus the faintest lift** (`shadow-xs`). Depth comes
  from the border; the shadow only stops them looking pasted onto the page.
  Elevation is a three-step scale — `xs` (cards) → `md` → `lg` (drawer,
  popovers). Nothing in between gets invented.
- Radius `16px` on cards, `12px` on controls, `999px` on pills.
- Surfaces: page `surface` (#F7F5FB), cards `card` (#FFFFFF).
- Type: **Inter** for UI, **Poppins** for the brand and display numerals. The
  artwork's wordmark has a single-storey round 'a'; Inter's is double-storey
  and reads as a different logo, so the wordmark must stay Poppins.
- Numbers are always `tabular-nums` (`.num`) so columns don't jitter while a
  run streams.
- The engine gradient appears as a hairline down the sidebar's right edge and
  across the loop band — the loop on every screen, costing no space.

## 2a. Navigation

Left sidebar, 248px, collapsible to 76px. Grouped, not flat:

- **Dashboard** on its own
- **Engines** — Red / Blue / Purple, each carrying its semantic hue on the
  active indicator, so you always know which half of the loop you're in
- **Assurance** — Evidence / Compliance, the two pages you hand an auditor

Six flat items would hide that structure, and the structure *is* the product.
Bottom of the rail holds a persistent estate summary and the account block.

## 3. Components that carry an argument

Most of the kit is ordinary. Four are load-bearing and should not be altered
casually:

**`TranscriptDrawer`** — every finding row in the product opens this, never a
summary modal. It is §1's "no count without a path" made visible. When the
canary is in the reply it is highlighted in crimson, which is what turns "the
tool says it leaked" into something the viewer verifies themselves.

**`derived_from` chips** (Blue) — every control shows the findings it was
compiled from, and each chip opens that transcript. A control nobody can trace
to evidence is the "trust me" posture this product exists to replace.

**`Metric`** — takes `from` (baseline) and `budget` (threshold). A metric with
no baseline is a number, not a result; a metric with no budget makes the reader
guess which direction is good.

**The titer four** (Purple) — ASR seeded, ASR held-out, FP rate, latency delta.
Rendered as one row, never split. An ASR drop shown without its false-positive
cost is a sales slide.

**`LoopBand`** (Dashboard) — the three engines drawn as a connected flow with
live numbers, not three separate cards. Every security product ships KPI cards;
what this one sells is that the engines are *one closed loop*. A row of cards
hides that. It doubles as navigation.

## 4. Pages

| Route | Purpose | Carries |
|---|---|---|
| `/` | Public landing | Animated loop hero, proof band, engines, pillars, live evidence, CTA — outside the shell |
| `/login` | Sign-in | Split layout, brand hero left, plain form right |
| `/dashboard` | Executive posture | **Loop band**,  KPI strip, trend, coverage matrix, estate, exposure feed |
| `/red` | Offensive console | streaming run log, live counters, finding table |
| `/blue` | Policy studio | signal inbox, controls by layer, derived-from chains |
| `/purple` | Loop controller | titer four, exit criteria, convergence, held-out split |
| `/evidence` | Auditor view | hash-chain visualiser, signed record, verification |
| `/compliance` | Board view | EU AI Act / NIST AI RMF / ISO 42001 coverage + gaps |

`/` and `/login` are the two routes outside the shell; the console starts at
`/dashboard`. The landing page is the only screen allowed sustained motion —
the loop it has to explain is a motion idea, and a row of static cards hides
it. Its animations live under `.lp-*` in `index.css` and every figure on it is
read from `fixtures.ts`, so the marketing page cannot drift away from the
console. Reduced motion renders the whole page in its final state.

Pillar tabs (`models` / `agents` / `apps`) appear on the three engine pages.
Only `models` is populated; the others render `ComingSoon`, which reads as
roadmap rather than breakage.

## 5. Deliberate choices worth defending

**The numbers are imperfect on purpose.** Held-out ASR lands at 22%, not 0%,
and the FP rate is non-zero. A demo where the defence is flawless invites the
one question you don't want: *what are you not showing me?* The Dashboard and
Purple both state plainly that the run has **not** converged and why.

**The held-out split is by technique, not by prompt.** Purple shows the three
held-out techniques and marks two as still surviving. A random prompt-level
split leaks near-duplicates across the boundary and inflates the headline —
the easiest way for a product like this to lie to its own customers.

**Compliance shows its gaps.** Two rows are marked `gap` because the loop
genuinely cannot produce their evidence (human oversight, AI impact
assessment). A framework page with no gaps is one nobody believes.

**Polling, not WebSocket.** Visually identical, far fewer failure modes in
front of an audience. Swap it later if streaming volume demands it.

## 5a. The mark

`brand/Logo.tsx` renders the shield as SVG — no raster asset, so it stays sharp
and can be recoloured. Structure that has to be preserved:

- **Two armour plates**, crimson left and steel right, with a seam that opens
  at the apex and closes at the point. Not one ring with a fill.
- **Thick plates** — roughly a sixth of the shield's width. A thin frame reads
  as an icon; a thick one reads as armour.
- The **A-with-loop sits over the frame**: its apex breaks the top edge and its
  left leg crosses the crimson plate. That overlap is the depth. An A tucked
  neatly inside reads as clip-art.
- The **loop stays fully contained** — it is the continuous assurance loop, and
  one hanging out of the shield looks like a mistake.

Two forms. Below 34px the crossbar, bevel highlights and apex spark collapse
into mud, so the small form drops them and thickens what remains. Do not remove
that branch — the sidebar and SSO button both render below the threshold.

In the stacked lockup the shield is ~2.2× the wordmark cap height, matching the
artwork. At parity the wordmark competes with the mark instead of sitting under
it.

## 6. Known state

- `src/api.ts` is the real client for the FastAPI backend in `../`. Currently
  **unreferenced** — views read fixtures. Keep it: it documents the wiring for
  when the backend spec lands.
- Bundle is ~775 kB (221 kB gzipped), mostly Recharts. Fine for an internal
  tool; code-split if it ever ships to a slow network.
- Light theme only. The 50–900 ramps mean dark mode is a token swap rather than
  a rewrite, but it has not been built or tested.
- Desktop-first, as an operations console. The sidebar does not yet collapse to
  a drawer on mobile — below `lg` the login brand panel hides, but the app
  shell assumes a wide viewport.
- Login has no auth behind it. Any submit routes to `/dashboard`, and nothing
  guards the console routes — anyone with the URL is in. Honest for a preview
  build; obviously not shippable.
- The landing page is desktop-and-mobile, unlike the console. It is the one
  screen a stranger sees, so it collapses to a single column at `lg` and drops
  the section links at `md`, leaving Sign in as the only nav control.
