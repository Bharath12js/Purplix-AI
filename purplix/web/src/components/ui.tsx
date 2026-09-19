import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ surface */

export function Card({ children, className = '', pad = false }: {
  children: ReactNode; className?: string; pad?: boolean
}) {
  return <div className={`card ${pad ? 'p-5' : ''} ${className}`}>{children}</div>
}

/**
 * Page header. Every page uses this, so the eye lands in the same place on
 * every route — the cheapest way to make six pages feel like one product.
 */
export function PageHead({ title, sub, actions }: {
  title: string; sub?: string; actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-bold leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-body">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

/**
 * Horizontal scroll container for wide content.
 *
 * Tables here carry a lot of columns by design — a scorecard with its budget,
 * its baseline and its outcome is the whole point, and dropping columns to fit
 * is how the reassuring ones survive and the awkward ones disappear. So the
 * table scrolls instead, and the page body never does.
 */
export function Scroller({ children, className = '' }: {
  children: ReactNode; className?: string
}) {
  return <div className={`overflow-x-auto ${className}`}>{children}</div>
}

export function SectionHead({ children, hint, right }: {
  children: ReactNode; hint?: string; right?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-4">
      <div className="flex items-baseline gap-2.5">
        <h2 className="label">{children}</h2>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </div>
      {right}
    </div>
  )
}

/* -------------------------------------------------------------------- pills */

const SEV: Record<string, string> = {
  critical: 'bg-crimson text-white',
  high: 'bg-crimson-tint text-crimson border border-crimson-line',
  medium: 'bg-warn-tint text-warn border border-warn/20',
  low: 'bg-hair text-muted border border-border',
}

export function SeverityPill({ severity }: { severity: string }) {
  return <span className={`pill ${SEV[severity] ?? SEV.low}`}>{severity}</span>
}

/**
 * Enforcement point — NOT an AEGIS target tier. The blue spec uses L1/L2/L3
 * for App/Model/Agent; here they mean where a control fires. The label spells
 * it out every time precisely because the two readings look identical on screen.
 */
const LAYER_LABEL: Record<string, string> = {
  L1: 'L1 · input',
  L2: 'L2 · output',
  L3: 'L3 · config',
}

export function LayerPill({ layer }: { layer: string }) {
  return (
    <span className="pill border border-steel-line bg-steel-tint text-steel">
      {LAYER_LABEL[layer] ?? layer}
    </span>
  )
}

const STATUS: Record<string, string> = {
  open: 'bg-crimson-tint text-crimson border border-crimson-line',
  compiled: 'bg-steel-tint text-steel border border-steel-line',
  mitigated: 'bg-ok-tint text-ok border border-ok/20',
  accepted: 'bg-hair text-muted border border-border',
  deployed: 'bg-steel-tint text-steel border border-steel-line',
  draft: 'bg-brand-tint text-brand-deep border border-brand-line',
  rolled_back: 'bg-hair text-muted border border-border',
  protected: 'bg-ok-tint text-ok border border-ok/20',
  exposed: 'bg-crimson-tint text-crimson border border-crimson-line',
  untested: 'bg-hair text-muted border border-border',
  covered: 'bg-ok-tint text-ok border border-ok/20',
  partial: 'bg-warn-tint text-warn border border-warn/20',
  gap: 'bg-crimson-tint text-crimson border border-crimson-line',
  // target lifecycle (purple spec)
  ONBOARDED: 'bg-hair text-muted border border-border',
  PINNED: 'bg-brand-tint text-brand-deep border border-brand-line',
  RUNNING: 'bg-brand-tint text-brand-deep border border-brand-line',
  WATCHING: 'bg-ok-tint text-ok border border-ok/20',
  HALTED: 'bg-crimson-tint text-crimson border border-crimson-line',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill ${STATUS[status] ?? STATUS.accepted}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/**
 * Control lifecycle (AEGIS). The distinction that matters on screen is
 * MONITORING vs ACTIVE: one is logging, the other is blocking, and a reader
 * who cannot tell them apart will over-read the defence.
 */
const CONTROL_STATE: Record<string, string> = {
  PROPOSED: 'bg-hair text-muted border border-border',
  STAGED: 'bg-brand-tint text-brand-deep border border-brand-line',
  MONITORING: 'bg-warn-tint text-warn border border-warn/20',
  ACTIVE: 'bg-ok-tint text-ok border border-ok/20',
  ROLLED_BACK: 'bg-crimson-tint text-crimson border border-crimson-line',
  EXPIRED: 'bg-hair text-muted border border-border',
}

export function StatePill({ state }: { state: string }) {
  return <span className={`pill ${CONTROL_STATE[state] ?? CONTROL_STATE.PROPOSED}`}>{state.toLowerCase().replace(/_/g, ' ')}</span>
}

/** Pass outcome (purple spec). Four of the five are not "converged", on purpose. */
const OUTCOME: Record<string, string> = {
  CONVERGED: 'bg-ok text-white',
  REITERATE: 'bg-brand text-white',
  STALLED: 'bg-warn text-white',
  REGRESSED: 'bg-crimson text-white',
  EXHAUSTED: 'bg-muted text-white',
}

export function OutcomePill({ outcome }: { outcome: string }) {
  return <span className={`pill ${OUTCOME[outcome] ?? OUTCOME.REITERATE}`}>{outcome.toLowerCase()}</span>
}

/**
 * Escalation tier. T0-T2 cost nothing; T4 is the only one that spends tokens,
 * which is why it is the only one coloured.
 */
export function TierPill({ tier }: { tier: string }) {
  const hot = tier === 'T4'
  return (
    <span className={`pill border font-mono text-[10px] ${
      hot ? 'border-brand-line bg-brand-tint text-brand-deep' : 'border-border bg-surface text-muted'
    }`}>
      {tier}
    </span>
  )
}

/** Finding confidence (AEGIS). UNREPRODUCED is deliberately not FALSE_POSITIVE. */
const CONF: Record<string, string> = {
  CONFIRMED: 'border-ok/20 bg-ok-tint text-ok',
  LIKELY: 'border-warn/20 bg-warn-tint text-warn',
  SUSPECTED: 'border-border bg-surface text-muted',
  UNREPRODUCED: 'border-border bg-hair text-muted',
  FALSE_POSITIVE: 'border-border bg-hair text-faint',
}

export function ConfidencePill({ confidence }: { confidence: string }) {
  return <span className={`pill border ${CONF[confidence] ?? CONF.SUSPECTED}`}>{confidence.toLowerCase().replace(/_/g, ' ')}</span>
}

export function Tag({ children, tone = 'plain' }: {
  children: ReactNode; tone?: 'plain' | 'brand' | 'crimson' | 'steel'
}) {
  const t = {
    plain: 'border-border bg-surface text-muted',
    brand: 'border-brand-line bg-brand-tint text-brand-deep',
    crimson: 'border-crimson-line bg-crimson-tint text-crimson',
    steel: 'border-steel-line bg-steel-tint text-steel',
  }[tone]
  return <span className={`pill border font-mono text-[10px] font-medium ${t}`}>{children}</span>
}

/* -------------------------------------------------------------------- tiles */

/**
 * Metric tile.
 *
 * `from` is not optional decoration — a metric with no baseline is a number,
 * not a result. `budget` shows the threshold that makes the number a pass or
 * a fail, so the reader never has to be told which direction is good.
 */
export function Metric({
  label, value, from, budget, tone = 'ink', foot, accent, trend,
}: {
  label: string; value: string; from?: string; budget?: string; foot?: string
  tone?: 'ink' | 'ok' | 'bad' | 'brand'
  accent?: 'crimson' | 'steel' | 'brand'
  /** Normalised 0–1 series. A metric with history should show it. */
  trend?: number[]
}) {
  const toneCls = { ink: 'text-ink', ok: 'text-ok', bad: 'text-crimson', brand: 'text-brand' }[tone]
  const bar = accent
    ? { crimson: 'bg-crimson', steel: 'bg-steel', brand: 'bg-brand' }[accent]
    : null
  const stroke = accent
    ? { crimson: '#C1213F', steel: '#35619F', brand: '#7C2DBD' }[accent]
    : '#867E9C'

  return (
    <Card className="group relative overflow-hidden p-4 transition-shadow hover:shadow-sm">
      {bar && <div className={`absolute inset-y-0 left-0 w-[3px] ${bar}`} />}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label">{label}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`num font-brand text-[28px] font-bold leading-none tracking-[-0.02em] ${toneCls}`}>
              {value}
            </span>
            {from && (
              <span className="num text-[12px] text-faint line-through decoration-faint/60">
                {from}
              </span>
            )}
          </div>
        </div>
        {trend && trend.length > 1 && <Spark data={trend} stroke={stroke} />}
      </div>

      {foot && <div className="mt-2 text-[11.5px] leading-snug text-body">{foot}</div>}
      {budget && <div className="mt-1 text-[10.5px] text-faint">budget {budget}</div>}
    </Card>
  )
}

/** Inline sparkline. Deliberately unlabelled — it shows shape, not values. */
function Spark({ data, stroke }: { data: number[]; stroke: string }) {
  const w = 56, h = 24
  const max = Math.max(...data, 0.0001)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - (v / max) * (h - 3) - 1.5
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg width={w} height={h} className="shrink-0 opacity-70" aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={w}
        cy={h - (data[data.length - 1] / max) * (h - 3) - 1.5}
        r="2.25"
        fill={stroke}
      />
    </svg>
  )
}

/** Horizontal meter. Used wherever a rate needs a shape as well as a number. */
export function Meter({ value, tone = 'brand', budget }: {
  value: number; tone?: 'brand' | 'crimson' | 'steel' | 'ok'; budget?: number
}) {
  const fill = { brand: 'bg-brand', crimson: 'bg-crimson', steel: 'bg-steel', ok: 'bg-ok' }[tone]
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-pill bg-hair">
      <div className={`h-full rounded-pill ${fill} transition-[width] duration-500`}
           style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      {budget !== undefined && (
        <div className="absolute inset-y-[-2px] w-px bg-ink/30"
             style={{ left: `${Math.min(100, budget * 100)}%` }} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ states */

export function EmptyState({ title, body, action, icon = '◇' }: {
  title: string; body: string; action?: ReactNode; icon?: string
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-pill border border-brand-line
                      bg-brand-tint text-[17px] text-brand">
        {icon}
      </div>
      <div>
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-body">{body}</p>
      </div>
      {action}
    </Card>
  )
}

/** Roadmap placeholder — reads as "planned", never as "broken". */
export function ComingSoon({ title, body, sprint }: {
  title: string; body: string; sprint: string
}) {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="pill border border-brand-line bg-brand-tint text-brand-deep">{sprint}</span>
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <p className="max-w-lg text-[13px] leading-relaxed text-body">{body}</p>
    </Card>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-brand-line border-t-brand" />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------- code */

export function Mono({ children, className = '', tone = 'plain' }: {
  children: ReactNode; className?: string; tone?: 'plain' | 'attack' | 'reply'
}) {
  const t = {
    plain: 'border-border bg-surface',
    attack: 'border-crimson-line bg-crimson-tint/50',
    reply: 'border-border bg-surface',
  }[tone]
  return (
    <pre className={`overflow-x-auto whitespace-pre-wrap break-words rounded-xl border p-3
                     font-mono text-[11.5px] leading-[1.65] text-ink ${t} ${className}`}>
      {children}
    </pre>
  )
}

/**
 * Highlights the canary inside a transcript. The single most important pixel
 * in the product: it turns "the model says it leaked" into something the
 * viewer verifies with their own eyes.
 */
export function MonoHighlight({ text, needle, tone = 'reply' }: {
  text: string; needle: string; tone?: 'plain' | 'attack' | 'reply'
}) {
  const idx = text.toUpperCase().indexOf(needle.toUpperCase())
  if (idx === -1) return <Mono tone={tone}>{text}</Mono>
  return (
    <Mono tone={tone}>
      {text.slice(0, idx)}
      <mark className="rounded bg-crimson px-1 py-0.5 font-semibold text-white">
        {text.slice(idx, idx + needle.length)}
      </mark>
      {text.slice(idx + needle.length)}
    </Mono>
  )
}

/* ------------------------------------------------------------------ misc */

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-[12px] text-muted">{k}</span>
      <span className="text-[12px] text-ink">{v}</span>
    </div>
  )
}

export function Divider({ label }: { label?: string }) {
  if (!label) return <div className="my-5 h-px bg-border" />
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="label">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

/** Segmented control — used for pillar switching and framework filters. */
export function Segmented<T extends string>({
  options, value, onChange, accent = 'brand',
}: {
  options: readonly { value: T; label: string; note?: string }[]
  value: T; onChange: (v: T) => void
  accent?: 'brand' | 'crimson' | 'steel'
}) {
  const on = {
    brand: 'border-brand-line bg-brand-tint text-brand-deep',
    crimson: 'border-crimson-line bg-crimson-tint text-crimson',
    steel: 'border-steel-line bg-steel-tint text-steel',
  }[accent]

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            value === o.value ? on : 'border-border bg-card text-muted hover:bg-brand-tint/60'
          }`}
        >
          {o.label}
          {o.note && <span className="ml-1.5 text-[10px] font-medium opacity-60">{o.note}</span>}
        </button>
      ))}
    </div>
  )
}
