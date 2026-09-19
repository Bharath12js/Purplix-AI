import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Logo, Mark } from '../brand/Logo'
import { AreaTrend, ChartFrame, asMs } from '../components/charts'
import {
  CONTROLS, ENGAGEMENT, EXIT_CRITERIA, FINDINGS, LATEST, PASSES, TARGETS, pct,
} from '../data/fixtures'

/**
 * Landing — the public front door at `/`.
 *
 * ---------------------------------------------------------------------------
 * Why this page is allowed to move when the console is not
 * ---------------------------------------------------------------------------
 * The console is an operations tool: motion there is noise, and DESIGN.md §2
 * keeps it to a fade on route change. This page has one job the console does
 * not — explaining, to somebody who has never seen the product, that Red, Blue
 * and Purple are a single CLOSED LOOP rather than three features sold
 * together. A loop is a motion idea. A row of static cards hides exactly the
 * thing worth remembering, so the hero draws it turning.
 *
 * Everything else on the page moves once, on arrival, and then stops.
 *
 * ---------------------------------------------------------------------------
 * The numbers are the console's numbers
 * ---------------------------------------------------------------------------
 * Every figure here is read from `fixtures.ts` — the same source the Dashboard
 * and Purple render from. Nothing is written as a literal, so the marketing
 * page cannot drift away from the product it describes, and the honest result
 * survives the trip to the front page:
 *
 *   pass 3 has NOT converged. Unseen ASR sits at 6% against a 5% budget.
 *
 * DESIGN.md §5 argues that a flawless demo invites the one question you do not
 * want. That argument applies here with more force, not less — so the
 * convergence panel states the miss in its caption instead of cropping the
 * chart at pass 2 and calling it a win.
 *
 * ---------------------------------------------------------------------------
 * Colour
 * ---------------------------------------------------------------------------
 * Unchanged from §1: crimson = offensive, steel = defensive, purple =
 * assurance. So the attack ticker reads steel when a control blocks, crimson
 * when an attack lands, and neutral for benign traffic — benign traffic is
 * context, not a win, and painting it green would put three "good" colours on
 * one panel.
 */

/* ========================================================== derived facts */

const FIRST = PASSES[0]

/** 0.67 unseen -> 0.06 unseen. Derived, never typed as a literal. */
const ASR_DROP = (FIRST.asrUnseenBefore - LATEST.asrUnseen) / FIRST.asrUnseenBefore

const ACTIVE_CONTROLS = CONTROLS.filter((c) => c.state === 'ACTIVE').length

const CONVERGED = LATEST.asrUnseen <= EXIT_CRITERIA.maxAsrUnseen

/** The chart wants 0–100; the fixtures store ratios. */
const CONVERGENCE = PASSES.map((p) => ({
  name: `Pass ${p.passNo}`,
  unseen: +(p.asrUnseen * 100).toFixed(1),
}))

const FRAMEWORKS = [
  'OWASP LLM Top 10', 'OWASP Agentic', 'MITRE ATLAS',
  'NIST AI RMF', 'ISO 42001', 'EU AI Act',
]

/* ================================================================= motion */

const prefersReduced = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scroll reveal for everything carrying `.lp-reveal`.
 *
 * One observer for the whole page rather than one per component, and each
 * element is unobserved the moment it lands — a section that re-animates when
 * you scroll back up reads as a bug, not as polish.
 */
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.lp-reveal'))
    if (prefersReduced()) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/**
 * Count-up, started when the figure first scrolls into view.
 *
 * Counting on mount would mean the stat band has already finished by the time
 * anyone scrolls to it. `decimals` comes from the caller so `1.8` does not
 * render as `2` on the way up and then snap at the end.
 */
function useCountUp(target: number, decimals = 0) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(prefersReduced() ? target : 0)

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReduced()) { setShown(target); return }

    let raf = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return
      io.disconnect()
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - start) / 1100, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        setShown(+(target * eased).toFixed(decimals))
        if (p < 1) raf = requestAnimationFrame(step)
        else setShown(target)
      }
      raf = requestAnimationFrame(step)
    }, { threshold: 0.4 })

    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [target, decimals])

  return { ref, shown: shown.toFixed(decimals) }
}

/* ================================================================== icons */
/* Inline 24px stroke icons at one weight and cap style, so the engine tiles
   read as one set rather than three borrowed glyphs. */

const ico = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.9,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
}

const IconTarget = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </svg>
)
const IconShield = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" />
  </svg>
)
const IconLoop = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </svg>
)
const IconModel = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
    <path d="M9 1.5v2.5M15 1.5v2.5M9 20v2.5M15 20v2.5M1.5 9H4M1.5 15H4M20 9h2.5M20 15h2.5" />
  </svg>
)
const IconAgent = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <circle cx="12" cy="7.5" r="3.5" /><path d="M5.5 21v-.8a6.5 6.5 0 0 1 13 0v.8" />
    <path d="M12 11v3.5M8 14.5h8" />
  </svg>
)
const IconApp = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" {...ico}>
    <rect x="2.5" y="4" width="19" height="15" rx="2.5" /><path d="M2.5 9h19M6 14h6" />
  </svg>
)
const IconArrow = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" {...ico} strokeWidth={2.2}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
const IconPause = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <rect x="6.5" y="5" width="4" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.2" />
  </svg>
)
const IconPlay = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M7.5 5.2a1 1 0 0 1 1.5-.87l9 6.8a1 1 0 0 1 0 1.74l-9 6.8a1 1 0 0 1-1.5-.87z" />
  </svg>
)

/* =================================================================== page */

export function Landing() {
  useReveal()

  return (
    <div className="relative min-h-full overflow-x-hidden bg-surface">
      {/* Ambient field. Fixed, behind everything, inert to the pointer. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-mesh" />
        <div className="lp-drift-a absolute -right-24 -top-40 h-[26rem] w-[26rem] rounded-pill
                        bg-steel-300/35 blur-[90px]" />
        <div className="lp-drift-b absolute -left-32 top-1/3 h-[22rem] w-[22rem] rounded-pill
                        bg-crimson-200/40 blur-[90px]" />
        <div className="lp-drift-a absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-pill
                        bg-brand-300/35 blur-[100px]" />
      </div>

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]
                   focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:text-[13px]
                   focus:font-semibold focus:text-ink focus:shadow-md"
      >
        Skip to content
      </a>

      <TopNav />

      <main id="main" className="relative z-10">
        <Hero />
        <ProofBand />
        <Engines />
        <Pillars />
        <LiveDefence />
        <CtaBand />
      </main>

      <SiteFooter />
    </div>
  )
}

/* ================================================================ top nav */

const NAV_LINKS = [
  { href: '#loop', label: 'The loop' },
  { href: '#layers', label: 'Layers' },
  { href: '#evidence', label: 'Live evidence' },
]

/**
 * Sticky, translucent, hairline-bottom. The engine gradient runs along the top
 * edge — the same spine the console puts on the sidebar and the loop band, so
 * the marketing page and the product read as one object.
 */
function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-card/75 backdrop-blur-xl">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-engine-grad" />
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[72px] max-w-[1240px] items-center gap-6 px-5 sm:px-8"
      >
        <Link to="/" aria-label="Purplix AI — home" className="shrink-0">
          <Logo size={34} />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-xl px-3 py-2 text-[13.5px] font-semibold text-body
                         transition-colors hover:bg-brand-50 hover:text-brand-deep"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Sign in is the top-right anchor on every console-backed product;
              anywhere else and people hunt for the way in. */}
          <Link to="/login" className="btn-ghost px-4 py-2">Sign in</Link>
          <Link to="/login" className="btn-primary hidden px-4 py-2 sm:inline-flex">
            Book a demo
          </Link>
        </div>
      </nav>
    </header>
  )
}

/* =================================================================== hero */

function Hero() {
  return (
    <section className="mx-auto grid max-w-[1240px] items-center gap-10 px-5 pb-6 pt-14
                        sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:gap-12 lg:pt-20">
      <div>
        <span
          className="lp-rise inline-flex items-center gap-2.5 rounded-pill border border-brand-200
                     bg-brand-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-deep"
          style={{ animationDelay: '40ms' }}
        >
          <span className="lp-blink h-1.5 w-1.5 rounded-pill bg-ok" />
          Red → Blue → Purple · one loop, running
        </span>

        <h1
          className="lp-rise mt-5 text-balance font-brand text-[clamp(2.2rem,4.8vw,3.4rem)]
                     font-extrabold leading-[1.05] tracking-[-0.03em]"
          style={{ animationDelay: '110ms' }}
        >
          Attack it. Defend it.
          <br />
          <span className="lp-shimmer bg-engine-grad bg-clip-text text-transparent">
            Prove it holds.
          </span>
        </h1>

        <p
          className="lp-rise mt-6 max-w-[54ch] text-[16.5px] leading-relaxed text-body"
          style={{ animationDelay: '180ms' }}
        >
          Purplix red-teams your models, agents and AI applications — then compiles the
          defence out of every finding and re-attacks with techniques the compiler has
          never seen. A continuous assurance loop, not a one-off scan.
        </p>

        <div className="lp-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '250ms' }}>
          <Link to="/login" className="btn-primary px-6 py-3 text-[14.5px]">
            Start an exposure <IconArrow />
          </Link>
          <a href="#evidence" className="btn-ghost px-6 py-3 text-[14.5px]">
            Watch the loop converge
          </a>
        </div>

        <div className="lp-rise mt-9" style={{ animationDelay: '320ms' }}>
          <div className="label mb-2.5">Findings mapped to</div>
          <ul className="flex flex-wrap gap-1.5">
            {FRAMEWORKS.map((f) => (
              <li
                key={f}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px]
                           font-semibold text-muted shadow-xs"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <LoopVisual />
    </section>
  )
}

/**
 * The loop, drawn as a loop.
 *
 * The mark sits at the centre because the mark IS this diagram — two armour
 * plates and a contained loop. Three orbs circle it at different periods so the
 * engines never line up into one rotating triangle; the point is continuous,
 * unsynchronised work, not a three-step wizard.
 *
 * `aria-hidden` throughout: the three stage names are repeated as real text in
 * the section below, and nobody benefits from hearing a decorative orbit
 * described.
 */
function LoopVisual() {
  const STAGES = [
    { dot: 'bg-crimson', ring: 'border-crimson-200 text-crimson',
      name: 'Red', role: 'attack', pos: 'left-1/2 top-0 -translate-x-1/2' },
    { dot: 'bg-steel', ring: 'border-steel-200 text-steel',
      name: 'Blue', role: 'defend', pos: 'bottom-[13%] right-0' },
    { dot: 'bg-brand', ring: 'border-brand-200 text-brand-deep',
      name: 'Purple', role: 'assure', pos: 'bottom-[13%] left-0' },
  ]

  return (
    <div
      className="lp-rise relative mx-auto aspect-square w-full max-w-[430px]"
      style={{ animationDelay: '300ms' }}
      aria-hidden
    >
      <div className="absolute inset-[9%]">
        {/* dashed track, with a purple sweep chasing round it */}
        <div className="lp-track absolute inset-0 rounded-pill border border-dashed border-brand-200" />
        <div
          className="lp-sweep absolute -inset-px rounded-pill"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0 60%, rgba(155,67,232,.55) 80%, transparent 93%)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
            mask:
              'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))',
          }}
        />

        {/* orbiting engines — coprime-ish periods, so they never re-sync */}
        <div className="lp-orbit" style={{ '--dur': '11s' } as CSSProperties}>
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2
                           rounded-pill bg-crimson shadow-[0_0_16px_3px_rgba(193,33,63,.5)]" />
        </div>
        <div className="lp-orbit" style={{ '--dur': '14s', '--delay': '-5s' } as CSSProperties}>
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2
                           rounded-pill bg-steel shadow-[0_0_16px_3px_rgba(53,97,159,.5)]" />
        </div>
        <div className="lp-orbit" style={{ '--dur': '9s', '--delay': '-3s' } as CSSProperties}>
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2
                           rounded-pill bg-brand shadow-[0_0_16px_3px_rgba(155,67,232,.5)]" />
        </div>
      </div>

      {/* core */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative grid place-items-center">
          <div className="lp-breathe absolute -inset-10 rounded-pill bg-brand-300/35 blur-3xl" />
          <Mark size={150} glow />
        </div>
      </div>

      {/* stage chips */}
      {STAGES.map((s) => (
        <div
          key={s.name}
          className={`absolute ${s.pos} flex items-center gap-2 rounded-pill border bg-card/95
                      px-3 py-1.5 shadow-sm backdrop-blur ${s.ring}`}
        >
          <span className={`h-1.5 w-1.5 rounded-pill ${s.dot}`} />
          <span className="text-[11.5px] font-bold">{s.name}</span>
          <span className="text-[11px] font-medium opacity-70">{s.role}</span>
        </div>
      ))}
    </div>
  )
}

/* ============================================================= proof band */

function Stat({ value, decimals = 0, suffix, label, note }: {
  value: number; decimals?: number; suffix?: string; label: string; note: string
}) {
  const { ref, shown } = useCountUp(value, decimals)

  return (
    <div className="card p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="num font-brand text-[clamp(1.9rem,3.4vw,2.6rem)] font-extrabold
                      leading-none tracking-[-0.035em] text-ink">
        <span ref={ref}>{shown}</span>
        {suffix && <span className="text-brand">{suffix}</span>}
      </div>
      <div className="mt-2.5 text-[13px] font-semibold text-body">{label}</div>
      <div className="mt-1 text-[11.5px] leading-snug text-faint">{note}</div>
    </div>
  )
}

function ProofBand() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
      <div className="lp-reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          value={Math.round(ASR_DROP * 100)} suffix="%"
          label="Unseen ASR reduction"
          note={`${pct(FIRST.asrUnseenBefore)} unprotected → ${pct(LATEST.asrUnseen)} held-out, ${PASSES.length} passes`}
        />
        <Stat
          value={FINDINGS.length}
          label="Findings, every one with a transcript"
          note={`${TARGETS.length} targets · no count without a path`}
        />
        <Stat
          value={ACTIVE_CONTROLS}
          label="Controls active in production"
          note="Signed, diffable, reversible — never a fine-tune"
        />
        <Stat
          value={3} suffix="×"
          label="Layers under the same loop"
          note="Model · agent · app"
        />
      </div>
    </section>
  )
}

/* ================================================================ engines */

function SectionHead({ eyebrow, title, sub, live = false }: {
  eyebrow: string; title: string; sub: string; live?: boolean
}) {
  return (
    <div className="lp-reveal mx-auto mb-11 max-w-[660px] text-center">
      <span className="inline-flex items-center gap-2.5 rounded-pill border border-brand-200
                       bg-brand-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-brand-deep">
        {live && <span className="lp-blink h-1.5 w-1.5 rounded-pill bg-ok" />}
        {eyebrow}
      </span>
      <h2 className="mt-5 text-balance font-brand text-[clamp(1.65rem,3.4vw,2.4rem)]
                     font-extrabold leading-[1.1] tracking-[-0.025em]">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-body">{sub}</p>
    </div>
  )
}

const ENGINE_HUE = {
  crimson: { spine: 'bg-crimson', chip: 'bg-crimson text-white', step: 'text-crimson', hover: 'hover:border-crimson-200' },
  steel: { spine: 'bg-steel', chip: 'bg-steel text-white', step: 'text-steel', hover: 'hover:border-steel-200' },
  brand: { spine: 'bg-brand', chip: 'bg-brand-grad text-white', step: 'text-brand-deep', hover: 'hover:border-brand-200' },
} as const

function Engines() {
  const cards = [
    {
      hue: 'crimson' as const, step: '01 · RED', to: '/red', icon: <IconTarget />,
      title: 'Attack everything',
      body: `Purplix-authored attack packs drive prompt injection, jailbreaks, tool misuse and
             RAG poisoning across all three layers. Every verdict is graded by a two-pass judge
             that escalates only when the cheap tier is unsure.`,
      foot: `${FINDINGS.length} findings · ${pct(FIRST.asrUnseenBefore)} unseen ASR on first contact`,
    },
    {
      hue: 'steel' as const, step: '02 · BLUE', to: '/blue', icon: <IconShield />,
      title: 'Compile the defence',
      body: `Each finding compiles into a signed control bundle — L1 input detection, L2 output
             gating, L3 system-prompt and tool-scope hardening — deployed as an inline wrapper in
             front of the target. Diffable, reversible, never a fine-tune.`,
      foot: `${ACTIVE_CONTROLS} active · each names the findings it came from`,
    },
    {
      hue: 'brand' as const, step: '03 · PURPLE', to: '/purple', icon: <IconLoop />,
      title: 'Prove it holds',
      body: `Re-attack with held-out techniques the compiler never saw, measure unseen ASR, false
             positives on benign traffic and added latency, then seal a signed assurance record.
             The loop re-runs until the exit criteria hold twice in a row.`,
      foot: `Pass ${LATEST.passNo} of ${EXIT_CRITERIA.maxPasses} · ${pct(LATEST.asrUnseen)} unseen ASR`,
    },
  ]

  return (
    <section id="loop" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-14 sm:px-8">
      <SectionHead
        eyebrow="How it works"
        title="One loop. Three engines."
        sub="Every finding is bound to the control that fixes it, and that control is proven
             against attacks it was never compiled to stop."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((c, i) => {
          const h = ENGINE_HUE[c.hue]
          return (
            <Link
              key={c.step}
              to={c.to}
              className={`lp-reveal card group relative flex flex-col overflow-hidden p-6
                          transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${h.hover}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${h.spine}`} />
              <span aria-hidden className={`grid h-11 w-11 place-items-center rounded-xl ${h.chip}`}>
                {c.icon}
              </span>
              <div className={`mt-5 text-[11.5px] font-bold tracking-[0.1em] ${h.step}`}>
                {c.step}
              </div>
              <h3 className="mt-1.5 font-brand text-[19px] font-bold tracking-[-0.02em]">
                {c.title}
              </h3>
              <p className="mt-2.5 flex-1 text-[14px] leading-relaxed text-body">{c.body}</p>
              <div className="mt-5 flex items-center gap-2 border-t border-hair pt-3.5
                              text-[11.5px] font-semibold text-muted">
                <span className="num">{c.foot}</span>
                <span aria-hidden className="ml-auto text-brand opacity-0 transition-opacity
                                             group-hover:opacity-100">
                  <IconArrow />
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/* ================================================================ pillars */

function Pillars() {
  const pillars = [
    {
      icon: <IconModel />, name: 'Model',
      body: `The model as deployed — system prompt, retrieval context and I/O handling. Prompt
             injection, canary leakage and unsafe output, closed by detection and structural
             defences rather than by more instructions.`,
      tags: ['LLM01 prompt injection', 'LLM02 disclosure', 'AML.T0051'],
    },
    {
      icon: <IconAgent />, name: 'Agent',
      body: `Tools, memory, MCP surfaces and delegation. Goal hijack, tool misuse and memory
             poisoning stopped by an out-of-process authorizer and egress deny-lists the agent
             cannot talk its way past.`,
      tags: ['LLM06 excessive agency', 'ASI01 goal hijack', 'ASI02 tool misuse'],
    },
    {
      icon: <IconApp />, name: 'App',
      body: `The code, dependencies, container and HTTP surface the model runs inside. SSRF,
             IDOR, cross-tenant retrieval and leaked secrets — because a perfect guardrail on an
             owned box is theatre.`,
      tags: ['SSRF', 'IDOR', 'cross-tenant retrieval'],
    },
  ]

  return (
    <section id="layers" className="scroll-mt-24 border-y border-border bg-card/55 backdrop-blur-sm">
      <div className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8">
        <SectionHead
          eyebrow="Three pillars"
          title="Defends every layer of your AI stack"
          sub="The same loop, specialised for what each layer actually gets wrong. Pillars are
               what is under test — they are not the enforcement layers."
        />

        <div className="grid gap-4 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <article
              key={p.name}
              className="lp-reveal card p-6 transition-all duration-200 hover:-translate-y-1
                         hover:border-brand-200 hover:shadow-md"
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl
                                           border border-brand-200 bg-brand-50 text-brand-deep">
                {p.icon}
              </span>
              <h3 className="mt-5 font-brand text-[17px] font-bold tracking-[-0.02em]">{p.name}</h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-body">{p.body}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <li
                    key={t}
                    className="rounded-lg border border-border bg-surface px-2 py-1
                               text-[10.5px] font-semibold text-muted"
                  >
                    {t}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================== live evidence */

/**
 * The ticker's script.
 *
 * Real techniques from the reference campaign, in the order a pass actually
 * produces them: attacks land early, controls catch up, benign traffic keeps
 * flowing throughout. The `hit` rows stay in on purpose — a feed where nothing
 * ever gets through is a screensaver.
 */
type Verdict = 'blocked' | 'hit' | 'benign'

const FEED: { text: string; verdict: Verdict }[] = [
  { text: 'authority_impersonation → model.system_prompt', verdict: 'blocked' },
  { text: 'crescendo_multiturn → support agent', verdict: 'blocked' },
  { text: 'encoding_base64 → canary exfil', verdict: 'blocked' },
  { text: 'benign · "summarise my last invoice"', verdict: 'benign' },
  { text: 'poisoned RAG chunk → policy override', verdict: 'blocked' },
  { text: 'multilingual_pivot (hi-IN) → advice rules', verdict: 'hit' },
  { text: 'link-preview fetch → 169.254.169.254', verdict: 'blocked' },
  { text: 'delegation inheritance → self-approval', verdict: 'blocked' },
  { text: 'benign · "what is my ticket status?"', verdict: 'benign' },
  { text: 'nested_tool_frame → document.delete', verdict: 'hit' },
  { text: 'unicode_homoglyph → spotlight bypass', verdict: 'blocked' },
  { text: 'cross-tenant retrieval → policy doc', verdict: 'blocked' },
]

/* steel = a control acting. crimson = an attack landing. neutral = context. */
const VERDICT_STYLE: Record<Verdict, { dot: string; pill: string; word: string }> = {
  blocked: { dot: 'bg-steel', pill: 'bg-steel-50 text-steel', word: 'Blocked' },
  hit: { dot: 'bg-crimson', pill: 'bg-crimson-50 text-crimson', word: 'Landed' },
  benign: { dot: 'bg-border', pill: 'bg-surface text-muted', word: 'Allowed' },
}

const ROWS = 8

function AttackFeed() {
  const [items, setItems] = useState(() =>
    Array.from({ length: ROWS }, (_, i) => ({ ...FEED[i], key: i })),
  )
  // WCAG 2.2.2: anything that moves for more than five seconds needs a stop.
  const [playing, setPlaying] = useState(!prefersReduced())
  const cursor = useRef(ROWS)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const next = FEED[cursor.current % FEED.length]
      const key = cursor.current
      cursor.current += 1
      setItems((prev) => [{ ...next, key }, ...prev].slice(0, ROWS))
    }, 2100)
    return () => clearInterval(id)
  }, [playing])

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <h3 className="label">Attack stream</h3>
        <span className="pill bg-ok-tint px-2 text-ok">
          <span className="lp-blink h-1.5 w-1.5 rounded-pill bg-ok" />
          pass {LATEST.passNo}
        </span>
        <button
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={!playing}
          title={playing ? 'Pause the stream' : 'Resume the stream'}
          className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-border
                     bg-card text-muted transition-colors hover:border-brand-200
                     hover:text-brand-deep"
        >
          {playing ? <IconPause /> : <IconPlay />}
          <span className="sr-only">
            {playing ? 'Pause the attack stream' : 'Resume the attack stream'}
          </span>
        </button>
      </div>

      {/* aria-live stays off: a marketing ticker read aloud every two seconds
          is hostile. The figures that matter are the static tiles opposite. */}
      <ul aria-live="off" className="flex flex-1 flex-col justify-between gap-2">
        {items.map((it) => {
          const v = VERDICT_STYLE[it.verdict]
          return (
            <li
              key={it.key}
              className="lp-feed-in flex items-center gap-3 rounded-xl border border-hair
                         bg-surface/70 px-3 py-2.5"
            >
              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-pill ${v.dot}`} />
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-body">
                {it.text}
              </span>
              <span className={`pill shrink-0 px-2 ${v.pill}`}>{v.word}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * The titer four, exactly as Purple renders them — never shown apart, because
 * unseen ASR without its false-positive and latency cost is half a claim.
 */
function Titer() {
  const tiles = [
    { l: 'Unseen ASR', v: pct(LATEST.asrUnseen),
      g: `budget ${pct(EXIT_CRITERIA.maxAsrUnseen)}`, ok: CONVERGED },
    { l: 'FP rate (benign)', v: pct(LATEST.fpRate, 1),
      g: `budget ${pct(EXIT_CRITERIA.maxFpRate)}`, ok: LATEST.fpRate <= EXIT_CRITERIA.maxFpRate },
    { l: 'Added latency p95', v: asMs(LATEST.latencyDeltaMs),
      g: `budget +${EXIT_CRITERIA.maxLatencyDeltaMs} ms`,
      ok: LATEST.latencyDeltaMs <= EXIT_CRITERIA.maxLatencyDeltaMs },
    { l: 'Controls proven', v: String(LATEST.controls),
      g: 'signed · reversible', ok: true },
  ]

  return (
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {tiles.map((t) => (
        <div key={t.l} className="rounded-xl border border-border bg-card p-3">
          <div className="text-[10.5px] font-semibold text-muted">{t.l}</div>
          <div className="num mt-1 font-brand text-[19px] font-bold text-ink">{t.v}</div>
          <div className={`mt-0.5 text-[10.5px] font-semibold ${t.ok ? 'text-ok' : 'text-crimson'}`}>
            {t.g} {t.ok ? '✓' : '✗'}
          </div>
        </div>
      ))}
    </div>
  )
}

function LiveDefence() {
  return (
    <section id="evidence" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-16 sm:px-8">
      <SectionHead
        live
        eyebrow="Live evidence"
        title="Watch the loop converge — or fail to"
        sub="Real techniques, real controls, measured on held-out attacks. These are the
             reference campaign's own figures, not a rounded-up version of them."
      />

      <div className="lp-reveal grid gap-4 lg:grid-cols-2">
        <AttackFeed />

        <div>
          <ChartFrame
            title="Held-out ASR by pass"
            hint={`exit at ≤ ${pct(EXIT_CRITERIA.maxAsrUnseen)}, sustained ${EXIT_CRITERIA.sustainedPasses} passes`}
            table={{
              columns: ['Pass', 'Unseen ASR'],
              rows: CONVERGENCE.map((r) => [r.name, `${r.unseen}%`]),
            }}
            caption={
              CONVERGED ? (
                <>Inside the budget — the assurance record can be sealed.</>
              ) : (
                <>
                  Attack success on techniques the compiler never saw fell from{' '}
                  <strong className="text-ink">{pct(FIRST.asrUnseen)}</strong> to{' '}
                  <strong className="text-ink">{pct(LATEST.asrUnseen)}</strong>. That is still{' '}
                  <strong className="text-ink">above</strong> the{' '}
                  {pct(EXIT_CRITERIA.maxAsrUnseen)} budget, so pass {LATEST.passNo} has{' '}
                  <strong className="text-ink">not converged</strong> and the loop keeps running.
                  A landing page showing 0% would be the fastest way to tell you the chart
                  had been cropped.
                </>
              )
            }
          >
            <AreaTrend
              data={CONVERGENCE}
              x="name"
              dataKey="unseen"
              label="Unseen ASR"
              tone="assurance"
              unit="pct"
              budget={EXIT_CRITERIA.maxAsrUnseen * 100}
              height={186}
            />
          </ChartFrame>

          <Titer />
        </div>
      </div>
    </section>
  )
}

/* ================================================================ cta band */

function CtaBand() {
  return (
    <section className="mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
      <div className="lp-reveal relative overflow-hidden rounded-3xl bg-brand-grad px-6 py-14
                      text-center sm:px-12">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(620px 320px at 78% 0%, rgba(255,255,255,.24), transparent 62%)',
          }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-[18ch] text-balance font-brand
                         text-[clamp(1.7rem,3.6vw,2.6rem)] font-extrabold leading-[1.1]
                         tracking-[-0.025em] text-white">
            Stop shipping AI on trust.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[15px] leading-relaxed text-white/85">
            Turn every red-team finding into a signed, reversible defence — and a record an
            auditor can verify without taking your word for any of it.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/login"
              className="btn bg-card px-6 py-3 text-[14.5px] text-brand-deep shadow-md
                         hover:-translate-y-0.5 hover:shadow-lg"
            >
              Book a demo <IconArrow />
            </Link>
            <Link
              to="/login"
              className="btn border border-white/40 px-6 py-3 text-[14.5px] text-white
                         hover:-translate-y-0.5 hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================= footer */

function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-border bg-card">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-8 gap-y-4
                      px-5 py-9 sm:px-8">
        <Logo size={30} />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[12.5px] text-muted hover:text-brand-deep">
              {l.label}
            </a>
          ))}
          <Link to="/login" className="text-[12.5px] text-muted hover:text-brand-deep">Sign in</Link>
        </nav>
        <div className="ml-auto text-[11px] text-faint">
          Preview build · figures from pass {LATEST.passNo} of engagement{' '}
          <span className="font-mono">{ENGAGEMENT}</span>
        </div>
      </div>
    </footer>
  )
}
