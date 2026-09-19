import { Link } from 'react-router-dom'
import { pct, relTime, type Pass } from '../data/fixtures'

/**
 * The loop, drawn.
 *
 * Every security product has KPI cards. What this one actually sells is that
 * the three engines are ONE closed loop — attack feeds compile, compile feeds
 * challenge, challenge feeds the next attack. A row of cards hides that; a
 * flow shows it, and it is the thing a viewer remembers after the demo.
 *
 * Each stage carries its semantic hue and its own headline number, so the
 * band doubles as navigation.
 */

type Stage = {
  to: string
  key: 'red' | 'blue' | 'purple'
  name: string
  role: string
  value: string
  sub: string
}

const HUE = {
  red: {
    ring: 'ring-crimson-200', bg: 'bg-crimson-50', text: 'text-crimson',
    dot: 'bg-crimson', num: 'text-crimson', hover: 'hover:ring-crimson-300',
  },
  blue: {
    ring: 'ring-steel-200', bg: 'bg-steel-50', text: 'text-steel',
    dot: 'bg-steel', num: 'text-steel', hover: 'hover:ring-steel-300',
  },
  purple: {
    ring: 'ring-brand-200', bg: 'bg-brand-50', text: 'text-brand-deep',
    dot: 'bg-brand', num: 'text-brand', hover: 'hover:ring-brand-300',
  },
} as const

export function LoopBand({ t, findings, controls }: {
  t: Pass; findings: number; controls: number
}) {
  const stages: Stage[] = [
    { to: '/red', key: 'red', name: 'Red', role: 'Attack',
      value: String(findings), sub: 'findings this pass' },
    { to: '/blue', key: 'blue', name: 'Blue', role: 'Defend',
      value: String(controls), sub: 'controls proven' },
    { to: '/purple', key: 'purple', name: 'Purple', role: 'Assure',
      value: pct(t.asrUnseen), sub: 'unseen ASR after' },
  ]

  return (
    <div className="card-raised relative mb-6 overflow-hidden">
      {/* the engine gradient as the band's spine */}
      <div className="absolute inset-x-0 top-0 h-1 bg-engine-grad" />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-hair px-5 pb-3.5 pt-5">
        <div>
          <div className="label">Assurance loop</div>
          <div className="mt-1 font-brand text-[15px] font-bold text-ink">
            Purplix Support Assistant · pass {t.passNo}
          </div>
        </div>

        <span className="text-[11px] text-faint">sealed {relTime(t.ranAt)}</span>

        <span className={`pill ml-auto ${t.converged
          ? 'border border-ok-line bg-ok-tint text-ok'
          : 'border border-brand-200 bg-brand-50 text-brand-deep'}`}>
          <span className={`h-1.5 w-1.5 rounded-pill ${t.converged ? 'bg-ok' : 'bg-brand'}`} />
          {/* The outcome verbatim, not a friendly paraphrase — REITERATE is a
              real result and softening it is how a dashboard starts lying. */}
          {t.outcome.toLowerCase()}
        </span>
      </div>

      <div className="flex flex-col items-stretch gap-2 p-5 md:flex-row md:items-center">
        {stages.map((s, i) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <Link
              to={s.to}
              className={`group flex flex-1 items-center gap-3.5 rounded-2xl px-4 py-3.5
                          ring-1 transition-all ${HUE[s.key].bg} ${HUE[s.key].ring}
                          ${HUE[s.key].hover} hover:shadow-sm`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-pill
                                bg-card ring-1 ${HUE[s.key].ring}`}>
                <span className={`h-2.5 w-2.5 rounded-pill ${HUE[s.key].dot}`} />
              </span>

              <span className="min-w-0 flex-1">
                <span className={`block font-brand text-[13.5px] font-bold ${HUE[s.key].text}`}>
                  {s.name}
                  <span className="ml-1.5 text-[10.5px] font-medium opacity-60">{s.role}</span>
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-muted">{s.sub}</span>
              </span>

              <span className={`num shrink-0 font-brand text-[22px] font-bold leading-none
                                ${HUE[s.key].num}`}>
                {s.value}
              </span>
            </Link>

            {/* connector — the last one wraps back, because it is a loop */}
            {i < stages.length - 1 && (
              <span className="hidden shrink-0 text-faint md:block">→</span>
            )}
          </div>
        ))}

        <span className="hidden shrink-0 items-center gap-1 text-[10.5px] text-faint lg:flex">
          <span>↻</span>
          <span className="whitespace-nowrap">feeds back</span>
        </span>
      </div>
    </div>
  )
}
