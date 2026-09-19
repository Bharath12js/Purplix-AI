/**
 * charts.tsx — the chart kit.
 *
 * ---------------------------------------------------------------------------
 * Why a kit and not per-page charts
 * ---------------------------------------------------------------------------
 * Six pages drawing their own axes, their own tooltip styling and their own
 * idea of "roughly purple" is how a product drifts inside a fortnight. Every
 * chart in Purplix is composed from this file, so a change to the grid colour
 * or the tooltip shape lands everywhere at once — and so the semantic colour
 * rule cannot be broken by accident.
 *
 * ---------------------------------------------------------------------------
 * The colour rule (unchanged from DESIGN.md §1)
 * ---------------------------------------------------------------------------
 *   crimson = OFFENSIVE   steel = DEFENSIVE   brand purple = ASSURANCE
 *
 * Colour is never decorative here. A crimson series that does not mean attack
 * is a bug, not a style choice. What this file adds is that the exact STEP
 * within each ramp is now chosen by measurement rather than by eye.
 *
 * ---------------------------------------------------------------------------
 * The palette is validated, not eyeballed
 * ---------------------------------------------------------------------------
 * The three-series categorical set was checked with the dataviz validator
 * (OKLab deltaE under protan/deutan/tritan simulation) against the card surface:
 *
 *   node scripts/validate_palette.js "#C1213F,#9B43E8,#35619F" \
 *        --mode light --surface "#FFFFFF" --pairs all
 *   -> lightness band PASS . chroma floor PASS . CVD separation PASS
 *      (worst pair steel-brand dE 11.8 deutan) . normal-vision PASS
 *      (dE 20.0) . contrast vs surface PASS
 *
 * The step that moved is the purple: brand-600 `#7C2DBD` against steel-500
 * `#35619F` scores dE 5.6 under deuteranopia — a hard fail, and those two
 * lines share a plot on both the Dashboard and Purple. brand-500 `#9B43E8`
 * is the same hue one step lighter and clears the floor with room to spare.
 * Purple stays purple; it just stops colliding with blue for ~6% of readers.
 *
 * Ordinal ramps (one hue, monotone lightness, light end clearing 2:1 on the
 * card) were validated the same way with `--ordinal`. All three pass.
 *
 * ---------------------------------------------------------------------------
 * House rules the components enforce, so reviewers do not have to
 * ---------------------------------------------------------------------------
 *  - ONE axis, ever. Two units means two charts — `TrendChart` takes a single
 *    `unit`, so plotting percentages against milliseconds is not expressible.
 *  - Gridlines are SOLID hairlines. A dashed grid reads as a threshold, and
 *    this product has real thresholds (`budget`) that need the dashed line.
 *  - Colour follows the ENTITY, never its rank — every series carries an
 *    explicit `tone`, so hiding a series never repaints the survivors.
 *  - Every chart can render as a table. A number nobody can read off the
 *    screen is the chart version of "no count without a path".
 *  - Direct labels are selective: the endpoint, never every point.
 */

import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

/* ============================================================== 1. tokens */

/** Card surface. Every contrast figure in the header note is against this. */
const SURFACE = '#FFFFFF'

const INK = '#150B26'
const MUTED = '#867E9C'
const FAINT = '#A9A2BC'

/** One step off the surface, solid, recessive. Never dashed. */
const GRID = '#EFEBF6'

/**
 * The semantic three. `tone` is the vocabulary the whole kit speaks — callers
 * name what a series MEANS and the kit supplies the validated hex.
 */
export type Tone = 'offence' | 'defence' | 'assurance' | 'neutral'

export const TONE: Record<Tone, string> = {
  offence: '#C1213F',   // crimson-500 - attack, breach, ASR, severity
  defence: '#35619F',   // steel-500   - controls, blocks, the cost of defending
  assurance: '#9B43E8', // brand-500   - the loop's own numbers: unseen ASR, convergence
  neutral: '#A9A2BC',   // faint       - context, de-emphasised series, "other"
}

/**
 * Status is RESERVED. These four mean good / caution / bad / not-yet-known and
 * are never reused as "series 4" — that is the fastest way to make a reader
 * believe a neutral category is a failure.
 */
export const STATUS_COLOR = {
  ok: '#0E8A55',
  warn: '#A86808',
  bad: '#C1213F',
  idle: '#D8D2E6',
} as const

/**
 * Ordinal ramps — one hue, monotone light to dark, each validated with
 * `--ordinal` against `#FFFFFF`. Use these where the categories have a real
 * ORDER (severity, escalation tier, enforcement depth) and the categorical set
 * where they only have identity. A value-ramp on nominal categories
 * double-encodes bar length as hue and tells the reader nothing new.
 */
export const RAMP = {
  /** low -> critical. */
  severity: ['#F09BAC', '#E05C77', '#C1213F', '#8A1229'],
  /** T0 -> T4. The dark end is the only tier that spends tokens. */
  tier: ['#C79AF3', '#A968EC', '#9B43E8', '#7C2DBD', '#5B1A93'],
  /** shallow -> deep enforcement. */
  defence: ['#8EB2E0', '#5C8ECB', '#35619F', '#213F6F'],
} as const

export const SEVERITY_COLOR: Record<string, string> = {
  low: RAMP.severity[0],
  medium: RAMP.severity[1],
  high: RAMP.severity[2],
  critical: RAMP.severity[3],
}

/* ========================================================== 2. formatting */

/** Ratio (0-1) as a percent. `—` for absent, never a misleading `0%`. */
export const asPct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(digits)}%`

export const asMs = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `${x >= 0 ? '+' : ''}${Math.round(x)} ms`

/** 186400 -> 186.4K. Hero and tile figures only; tables keep full precision. */
export const compact = (n: number): string =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : Math.abs(n) >= 1_000 ? `${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`
      : String(n)

/** One unit per chart. Two units is two charts — see the header note. */
export type Unit = 'pct' | 'ms' | 'count' | 'sec'

const FORMAT: Record<Unit, (v: number) => string> = {
  pct: (v) => `${Math.round(v)}%`,
  ms: (v) => `${Math.round(v)} ms`,
  count: (v) => compact(v),
  sec: (v) => `${v.toFixed(1)}s`,
}

export const formatUnit = (v: number, unit: Unit) => FORMAT[unit](v)

/* ============================================================== 3. chrome */

const AXIS_TICK = { fill: MUTED, fontSize: 11 }

const GRID_PROPS = { stroke: GRID, vertical: false } as const
const X_AXIS = { tick: AXIS_TICK, axisLine: false, tickLine: false, dy: 4 } as const
const Y_AXIS = { tick: AXIS_TICK, axisLine: false, tickLine: false, width: 46 } as const

type TipRow = { label: string; value: string; colour: string }

/**
 * Tooltip.
 *
 * Values lead, labels follow — the reader already knows which series they are
 * pointing at and wants the number. Series identity is a short stroke of the
 * mark's colour, not a filled box: at tooltip density a swatch is data-weight
 * ink doing a label's job.
 */
function TipBody({ head, rows }: { head: string; rows: TipRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-md">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted">
        {head}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline gap-2">
            <span className="h-[2px] w-3 shrink-0 rounded-pill" style={{ background: r.colour }} />
            <span className="num text-[12.5px] font-semibold text-ink">{r.value}</span>
            <span className="text-[11.5px] text-body">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Recharts tooltip adapter — keeps the readout and the axis in the same unit. */
function makeTip(unit: Unit) {
  return function Tip(props: any) {
    const { active, payload, label } = props
    if (!active || !payload?.length) return null
    return (
      <TipBody
        head={String(label ?? '')}
        rows={payload
          .filter((p: any) => p.value !== null && p.value !== undefined)
          .map((p: any) => ({
            label: String(p.name),
            value: FORMAT[unit](Number(p.value)),
            colour: p.color ?? p.stroke ?? p.fill ?? MUTED,
          }))}
      />
    )
  }
}

/** Hairline crosshair. The reader aims at a pass, never at a 2px line. */
const CROSSHAIR = { stroke: '#D9D2E7', strokeWidth: 1 }
/** Bars get a wash rather than a hairline — the mark itself is the target. */
const BAR_CURSOR = { fill: '#F8F5FD' }

/**
 * Legend. Always present for two or more series, never for one — a box with a
 * single swatch just restates the title. The mark shape mirrors the chart: a
 * line key for lines, a rounded rect for bars and areas.
 */
export function ChartLegend({ items, mark = 'line' }: {
  items: { label: string; colour: string; note?: string }[]
  mark?: 'line' | 'rect'
}) {
  if (items.length < 2) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11.5px] text-body">
          {mark === 'line' ? (
            <span className="h-[2px] w-3.5 rounded-pill" style={{ background: i.colour }} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.colour }} />
          )}
          {i.label}
          {i.note && <span className="text-faint">{i.note}</span>}
        </span>
      ))}
    </div>
  )
}

/* =============================================================== 4. frame */

export type TableSpec = {
  columns: string[]
  /** Pre-formatted cells — the table is a reading surface, not a second model. */
  rows: (string | number)[][]
}

/**
 * The twin table every chart carries.
 *
 * Colour-only encoding fails somebody eventually — under CVD, in print, in
 * forced-colors mode, or on a projector three rows back. The toggle is cheap,
 * and it means no value in this product is gated behind hovering a 2px line.
 */
export function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            {spec.columns.map((c, i) => (
              <th key={c} className={i === 0 ? '' : 'text-right'}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className={ci === 0 ? 'font-medium text-ink' : 'num text-right text-body'}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Chart frame — title, legend, the plot, the caption, and the table twin.
 *
 * `caption` is not decoration. Every chart in this product is making a claim,
 * and a chart whose claim is left to the reader's inference is how a dashboard
 * starts lying by omission. If the caption cannot be written, the chart is
 * probably the wrong form.
 *
 * `loading` dims the previous render instead of swapping in a skeleton — during
 * a live run the frame must not jump on every poll.
 */
export function ChartFrame({
  title, hint, caption, legend, table, children, right, loading = false, className = '',
}: {
  title?: string
  hint?: string
  caption?: ReactNode
  legend?: ReactNode
  table?: TableSpec
  children: ReactNode
  right?: ReactNode
  loading?: boolean
  className?: string
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const id = useId()

  return (
    <div className={`card p-4 ${className}`}>
      {(title || legend || right || table) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {title && (
              <div className="flex items-baseline gap-2">
                <h3 className="label" id={id}>{title}</h3>
                {hint && <span className="text-[11px] text-faint">{hint}</span>}
              </div>
            )}
            {legend && <div className="mt-2">{legend}</div>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {right}
            {table && (
              <div className="flex overflow-hidden rounded-lg border border-border">
                {(['chart', 'table'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`px-2 py-1 text-[11px] font-semibold capitalize transition-colors ${
                      view === v ? 'bg-brand-50 text-brand-deep' : 'bg-card text-muted hover:bg-surface'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className={`transition-opacity duration-200 ${loading ? 'opacity-40' : 'opacity-100'}`}
        role="img"
        aria-labelledby={title ? id : undefined}
      >
        {view === 'chart' ? children : table ? <DataTable spec={table} /> : children}
      </div>

      {caption && <p className="mt-2.5 text-[11.5px] leading-relaxed text-body">{caption}</p>}
    </div>
  )
}

/* ========================================================= 5. line charts */

export type Series = {
  /** Key into each row of `data`. */
  key: string
  label: string
  tone: Tone
  /** Context series render thin and unlabelled — see the emphasis note below. */
  muted?: boolean
}

/**
 * Trend / convergence chart.
 *
 * ONE `unit` for the whole plot, deliberately. The temptation on this product
 * is to draw unseen ASR (%) against added latency (ms) on one chart because
 * they are the two halves of the same trade — but a second y-scale invents a
 * relationship the data does not contain. Draw two `TrendChart`s instead; the
 * shared x-axis already does the comparing.
 *
 * `budget` draws the exit criterion as a dashed reference line. This is the one
 * dashed stroke the kit allows, and it is why the grid is solid: on this page a
 * dashed line has a meaning, and it is "threshold".
 */
export function TrendChart({
  data, x, series, unit, budget, budgetLabel, height = 230, domain,
}: {
  data: Record<string, any>[]
  x: string
  series: Series[]
  unit: Unit
  budget?: number
  budgetLabel?: string
  height?: number
  domain?: [number, number]
}) {
  const Tip = makeTip(unit)
  const last = data.length - 1

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 52, left: -14, bottom: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={x} {...X_AXIS} />
        <YAxis
          {...Y_AXIS}
          domain={domain ?? [0, 'auto']}
          tickFormatter={(v: number) => FORMAT[unit](v)}
        />
        <Tooltip content={<Tip />} cursor={CROSSHAIR} />

        {budget !== undefined && (
          <ReferenceLine
            y={budget}
            stroke={TONE.assurance}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{
              value: budgetLabel ?? 'budget',
              fontSize: 10,
              fill: TONE.assurance,
              position: 'insideTopRight',
            }}
          />
        )}

        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={TONE[s.tone]}
            strokeWidth={s.muted ? 1.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            /* >=8px marker with a 2px surface ring, so a dot stays legible
               where two series cross and stays big enough to actually hit. */
            dot={{ r: 4, fill: TONE[s.tone], stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 5.5, fill: TONE[s.tone], stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
            label={s.muted ? undefined : (p: any) =>
              p.index === last ? (
                <text
                  key={`${s.key}-end`}
                  x={p.x + 9}
                  y={p.y + 4}
                  fontSize={11}
                  fontWeight={600}
                  fill={INK}
                >
                  {FORMAT[unit](Number(p.value))}
                </text>
              ) : <g key={`${s.key}-${p.index}`} />
            }
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/**
 * Single-series area. For a measure whose SHAPE is the story and whose identity
 * needs no legend — added latency across passes, tokens burned per pass.
 * The fill is a ~10% wash, never a saturated block.
 */
export function AreaTrend({
  data, x, dataKey, label, tone, unit, budget, height = 170,
}: {
  data: Record<string, any>[]
  x: string
  dataKey: string
  label: string
  tone: Tone
  unit: Unit
  budget?: number
  height?: number
}) {
  const Tip = makeTip(unit)
  const id = useId().replace(/:/g, '')
  const colour = TONE[tone]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={`wash-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.16} />
            <stop offset="100%" stopColor={colour} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={x} {...X_AXIS} />
        <YAxis {...Y_AXIS} tickFormatter={(v: number) => FORMAT[unit](v)} />
        <Tooltip content={<Tip />} cursor={CROSSHAIR} />
        {budget !== undefined && (
          <ReferenceLine y={budget} stroke={colour} strokeDasharray="5 4" strokeWidth={1.5}
                         label={{ value: 'budget', fontSize: 10, fill: colour, position: 'insideTopRight' }} />
        )}
        <Area
          type="monotone"
          dataKey={dataKey}
          name={label}
          stroke={colour}
          strokeWidth={2}
          fill={`url(#wash-${id})`}
          dot={{ r: 4, fill: colour, stroke: SURFACE, strokeWidth: 2 }}
          activeDot={{ r: 5.5, fill: colour, stroke: SURFACE, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ========================================================== 6. bar charts */

/**
 * Grouped columns — the before/after shape.
 *
 * 24px cap, 4px rounded cap on the data end, square at the baseline, and a 2px
 * gap between neighbours done with air rather than a stroke.
 */
export function GroupedBars({
  data, x, series, unit, height = 200, domain,
}: {
  data: Record<string, any>[]
  x: string
  series: Series[]
  unit: Unit
  height?: number
  domain?: [number, number]
}) {
  const Tip = makeTip(unit)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 14, right: 12, left: -14, bottom: 0 }}
                barGap={2} barCategoryGap="28%">
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={x} {...X_AXIS} />
        <YAxis {...Y_AXIS} domain={domain ?? [0, 'auto']}
               tickFormatter={(v: number) => FORMAT[unit](v)} />
        <Tooltip content={<Tip />} cursor={BAR_CURSOR} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={TONE[s.tone]}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/**
 * Ranked horizontal bars, value at the tip.
 *
 * Horizontal because the categories here have long names (OWASP labels, tool
 * names, technique ids) and a rotated x-tick is unreadable at 11px. One hue by
 * default: when a single series is plotted, a per-bar colour ramp would
 * double-encode length as hue and add nothing.
 *
 * `emphasis` is the escape hatch that matters — one bar in the accent, the rest
 * in context grey, for when the story is "this one", not "these eight".
 */
export function RankedBars({
  rows, unit = 'count', tone = 'offence', emphasis, max, height,
}: {
  rows: { label: string; value: number; note?: string; tone?: Tone; colour?: string }[]
  unit?: Unit
  tone?: Tone
  /** Label of the one row that carries the story. */
  emphasis?: string
  max?: number
  height?: number
}) {
  const ceiling = max ?? Math.max(...rows.map((r) => r.value), 0.0001)

  return (
    <div className="space-y-2" style={height ? { height, overflowY: 'auto' } : undefined}>
      {rows.map((r) => {
        const dim = emphasis !== undefined && r.label !== emphasis
        const colour = r.colour ?? (dim ? TONE.neutral : TONE[r.tone ?? tone])
        const w = Math.max(0, Math.min(100, (r.value / ceiling) * 100))
        return (
          <div key={r.label} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-[12px] text-body" title={r.label}>{r.label}</span>
            <span className="relative h-2.5 w-full rounded-pill bg-hair">
              <span
                className="absolute inset-y-0 left-0 rounded-l-[2px] rounded-r-[4px] transition-[width] duration-500"
                style={{ width: `${w}%`, background: colour }}
              />
            </span>
            <span className="num w-14 text-right text-[12px] font-semibold text-ink">
              {FORMAT[unit](r.value)}
              {r.note && <span className="ml-1 text-[10.5px] font-normal text-faint">{r.note}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Ordinal funnel — the escalation ladder.
 *
 * The categories are ORDERED (T0 cheapest, T4 the only tier that spends
 * tokens), so this is the one place a per-bar ramp is correct rather than
 * decorative. Values sit at the tip because interior labels on a funnel get
 * clipped at the narrow end, and a clipped label is worse than no label.
 */
export function FunnelBars({
  rows, unit = 'count', ramp = RAMP.tier,
}: {
  rows: { label: string; value: number; note?: string }[]
  unit?: Unit
  ramp?: readonly string[]
}) {
  const ceiling = Math.max(...rows.map((r) => r.value), 0.0001)
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const w = Math.max(2, (r.value / ceiling) * 100)
        return (
          <div key={r.label} className="grid grid-cols-[2.4rem_1fr_auto] items-center gap-3">
            <span className="font-mono text-[11px] font-semibold text-muted">{r.label}</span>
            <span className="relative h-6 w-full">
              <span
                className="absolute inset-y-0 left-0 rounded-l-[2px] rounded-r-[4px]"
                style={{ width: `${w}%`, background: ramp[Math.min(i, ramp.length - 1)] }}
              />
            </span>
            <span className="num w-20 text-right text-[12px] font-semibold text-ink">
              {FORMAT[unit](r.value)}
              {r.note && <span className="ml-1 text-[10.5px] font-normal text-faint">{r.note}</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================== 7. part-to-whole forms */

export type Segment = { label: string; value: number; colour: string }

/**
 * Stacked share bar.
 *
 * Segments are separated by a 2px gap in the surface colour — never a stroke.
 * A border around a mark is ink that is not data, and on a 10px-tall bar it
 * swallows the smallest segment whole.
 *
 * Interior labels are deliberately absent: on a posture bar the smallest
 * segment is usually the one that matters (the exposed target), and it is
 * exactly the one a label will not fit inside. The legend and the tooltip
 * carry them, and the table twin keeps them reachable without hovering.
 */
export function ShareBar({
  segments, height = 10, showLegend = true,
}: {
  segments: Segment[]
  height?: number
  showLegend?: boolean
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const live = segments.filter((s) => s.value > 0)

  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-pill bg-hair" style={{ height, gap: 2 }}>
        {live.map((s) => (
          <span
            key={s.label}
            title={`${s.label}: ${s.value}`}
            className="h-full first:rounded-l-pill last:rounded-r-pill"
            style={{ width: `${(s.value / total) * 100}%`, background: s.colour }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="mt-2">
          <ChartLegend
            mark="rect"
            items={segments.map((s) => ({
              label: s.label,
              colour: s.colour,
              note: String(s.value),
            }))}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Donut. Part-to-whole at a glance only, six segments maximum, and never for
 * comparing values that sit close together — that is a bar chart's job.
 *
 * The centre carries the total, because the first question a donut provokes is
 * "out of how many" and making the reader add up the legend is rude.
 */
export function Donut({
  segments, centreLabel, size = 168, thickness = 18,
}: {
  segments: Segment[]
  centreLabel?: string
  size?: number
  thickness?: number
}) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = (size - thickness) / 2
  const c = size / 2
  const circ = 2 * Math.PI * r
  /** 2px of surface between neighbours, expressed as arc length. */
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0

  let offset = 0

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="shrink-0" aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#F1EEF8" strokeWidth={thickness} />
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * circ
          const dash = `${Math.max(0, len - gap)} ${circ - Math.max(0, len - gap)}`
          const el = (
            <circle
              key={s.label}
              cx={c} cy={c} r={r}
              fill="none"
              stroke={s.colour}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          )
          offset += len
          return el
        })}
        <text x={c} y={c - 2} textAnchor="middle" fontSize={26} fontWeight={700} fill={INK}>
          {total}
        </text>
        {centreLabel && (
          <text x={c} y={c + 16} textAnchor="middle" fontSize={10.5} fill={FAINT}>
            {centreLabel}
          </text>
        )}
      </svg>

      <div className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.colour }} />
            <span className="min-w-0 flex-1 truncate text-[12px] capitalize text-body">{s.label}</span>
            <span className="num text-[12px] font-semibold text-ink">{s.value}</span>
            <span className="num w-10 text-right text-[11px] text-faint">
              {total ? `${Math.round((s.value / total) * 100)}%` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================= 8. figures and meters */

/**
 * Budget meter — one ratio against one limit.
 *
 * The track is a lighter step of the fill's own ramp rather than grey, so the
 * state reads across the whole bar instead of only the filled part. The limit
 * is a tick, not a colour change: the reader should see how much room is left,
 * not just whether it is currently red.
 */
export function BudgetMeter({
  value, budget, tone, height = 8, invert = false,
}: {
  value: number
  budget: number
  /** Omit to colour by pass/fail, which is the usual case. */
  tone?: Tone
  height?: number
  /** `true` when HIGHER is better (coverage, refusal rate). */
  invert?: boolean
}) {
  const pass = invert ? value >= budget : value <= budget
  const fill = tone ? TONE[tone] : pass ? STATUS_COLOR.ok : STATUS_COLOR.bad
  const track = tone ? `${TONE[tone]}22` : pass ? '#E9F8F0' : '#FDE7EC'
  /** Scale so the limit sits at 60% of the track — over-budget stays on screen. */
  const ceiling = Math.max(value, budget) === budget ? budget / 0.6 : Math.max(value * 1.12, budget / 0.6)

  return (
    <div className="relative w-full overflow-hidden rounded-pill" style={{ height, background: track }}>
      <div
        className="h-full rounded-pill transition-[width] duration-500"
        style={{ width: `${Math.max(1, Math.min(100, (value / ceiling) * 100))}%`, background: fill }}
      />
      <div
        className="absolute inset-y-[-2px] w-[1.5px] rounded-pill bg-ink/35"
        style={{ left: `${Math.min(99, (budget / ceiling) * 100)}%` }}
        title={`budget ${budget}`}
      />
    </div>
  )
}

/**
 * Sparkline. Shows SHAPE, not values — deliberately unlabelled, with the
 * current point marked so the eye lands on "now" rather than on the peak.
 */
export function Sparkline({
  data, tone = 'assurance', width = 64, height = 24,
}: {
  data: number[]
  tone?: Tone
  width?: number
  height?: number
}) {
  if (data.length < 2) return null
  const colour = TONE[tone]
  const max = Math.max(...data, 0.0001)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const pt = (v: number, i: number) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2
    const y = height - 3 - ((v - min) / span) * (height - 7)
    return [x, y] as const
  }
  const pts = data.map(pt)
  const [lx, ly] = pts[pts.length - 1]

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden="true">
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        stroke={colour}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <circle cx={lx} cy={ly} r={2.75} fill={colour} stroke={SURFACE} strokeWidth={1.5} />
    </svg>
  )
}

/**
 * Dumbbell — before to after, per item.
 *
 * The right form for "what did the defence buy us on each target": the pair is
 * connected, so the reader sees the DISTANCE (the thing that changed) rather
 * than comparing two bar heights across a gap. Baseline is offensive crimson,
 * the defended value is the assurance purple, and the connector carries the
 * direction.
 */
export function Dumbbell({
  rows, unit = 'pct', max = 1,
}: {
  rows: { label: string; from: number; to: number }[]
  unit?: Unit
  /** Domain ceiling in the data's own units (1 for a 0-1 ratio). */
  max?: number
}) {
  const x = (v: number) => Math.max(0, Math.min(100, (v / max) * 100))
  const fmt = (v: number) => FORMAT[unit](unit === 'pct' ? v * 100 : v)

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const a = x(r.from)
        const b = x(r.to)
        const improved = r.to <= r.from
        return (
          <div key={r.label} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3">
            <span className="truncate text-[12px] text-body" title={r.label}>{r.label}</span>
            <span className="relative h-4 w-full">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-hair" />
              <span
                className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-pill"
                style={{
                  left: `${Math.min(a, b)}%`,
                  width: `${Math.abs(b - a)}%`,
                  background: improved ? TONE.assurance : TONE.offence,
                  opacity: 0.35,
                }}
              />
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-pill"
                style={{ left: `${a}%`, background: TONE.offence, boxShadow: `0 0 0 2px ${SURFACE}` }}
                title={`before ${fmt(r.from)}`}
              />
              <span
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill"
                style={{ left: `${b}%`, background: TONE.assurance, boxShadow: `0 0 0 2px ${SURFACE}` }}
                title={`after ${fmt(r.to)}`}
              />
            </span>
            <span className="num w-24 text-right text-[12px]">
              <span className="text-faint line-through decoration-faint/60">{fmt(r.from)}</span>
              <span className="ml-1.5 font-semibold text-ink">{fmt(r.to)}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================== 9. matrix + flow forms */

/**
 * Coverage grid — categories down, time across, one cell per intersection.
 *
 * A grid is the right form when the question is "where is the hole", because a
 * hole is a SHAPE and the eye finds shapes far faster than it reads a column of
 * percentages.
 *
 * The state vocabulary is supplied by the caller rather than fixed here, and
 * that is deliberate: the states a grid can show are a property of what the
 * data actually records. Hard-coding caught/surviving would invite a view to
 * paint a cell green for a pass where nothing of the sort was measured, which
 * is fabrication with a stylesheet on. Every state carries a fill AND a glyph
 * AND a legend entry, so the grid never depends on colour alone.
 */
export type GridState = { fill: string; glyph: string; label: string; ink?: string }

export function CoverageGrid({
  columns, rows, states, rowHeader = 'technique',
}: {
  columns: string[]
  rows: { label: string; note?: string; cells: { state: string; title?: string }[] }[]
  states: Record<string, GridState>
  rowHeader?: string
}) {
  const fallback: GridState = { fill: STATUS_COLOR.idle, glyph: '·', label: 'unknown', ink: FAINT }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              <th className="w-[46%] px-1 py-1.5 text-left text-2xs font-semibold uppercase tracking-[0.11em] text-muted">
                {rowHeader}
              </th>
              {columns.map((c) => (
                <th key={c} className="px-1 py-1.5 text-center text-2xs font-semibold uppercase tracking-[0.11em] text-muted">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="py-1 pr-2">
                  <span className="block truncate font-mono text-[11.5px] text-ink" title={r.label}>
                    {r.label}
                  </span>
                  {r.note && <span className="block text-[10.5px] text-faint">{r.note}</span>}
                </td>
                {r.cells.map((cell, i) => {
                  const s = states[cell.state] ?? fallback
                  return (
                    <td key={i} className="px-[2px] py-[2px]">
                      <span
                        title={cell.title ?? s.label}
                        className="grid h-7 w-full place-items-center rounded-[5px] text-[11px] font-bold"
                        style={{ background: s.fill, color: s.ink ?? '#FFFFFF' }}
                      >
                        {s.glyph}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {Object.values(states).map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[11.5px] text-body">
            <span
              className="grid h-4 w-4 place-items-center rounded-[4px] text-[9px] font-bold"
              style={{ background: s.fill, color: s.ink ?? '#FFFFFF' }}
            >
              {s.glyph}
            </span>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Attack-chain flow.
 *
 * Not a chart — a diagram, and the only honest way to draw the thing
 * single-layer tools cannot see. Each hop is survivable on its own; the point
 * is the composition. The cut marks the cheapest breaking hop, which is the
 * decision the operator actually has to make.
 */
export function ChainFlow({
  hops, breakAt, endToEnd,
}: {
  hops: { label: string; pillar: string }[]
  /** 1-indexed hop the chain was broken at; omit for an open chain. */
  breakAt?: number
  endToEnd?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {hops.map((h, i) => {
        const cut = breakAt === i + 1
        return (
          <span key={`${h.label}-${i}`} className="flex items-center">
            <span
              className={`rounded-xl border px-2.5 py-1.5 ${
                cut ? 'border-ok/30 bg-ok-tint' : 'border-border bg-surface'
              }`}
            >
              <span className="block font-mono text-[11px] text-ink">{h.label}</span>
              <span className="block text-[10px] uppercase tracking-[0.08em] text-faint">{h.pillar}</span>
            </span>
            {i < hops.length - 1 && (
              <span
                className={`mx-1.5 text-[12px] ${cut ? 'font-bold text-ok' : 'text-faint'}`}
                title={cut ? 'chain broken here' : undefined}
              >
                {cut ? '⊘' : '→'}
              </span>
            )}
          </span>
        )
      })}
      {endToEnd && (
        <span className="ml-auto pl-3 text-[11.5px] text-body">
          end-to-end <span className="num font-semibold text-ink">{endToEnd}</span>
        </span>
      )}
    </div>
  )
}

/* ================================================== 10. composed helpers */

/**
 * `Cell` is re-exported so a view can colour one bar of a `GroupedBars` by
 * status without reaching into recharts itself. Keeping the import surface in
 * this file is what stops six views each picking their own chart library idiom.
 */
export { Cell }
