import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo, Mark } from '../brand/Logo'
import { ENGAGEMENT, FINDINGS, TARGETS, relTime, SEALED_AT } from '../data/fixtures'

/**
 * App shell — left sidebar.
 *
 * Nav is grouped rather than flat. The three engines sit together because
 * they are one loop; the two evidence pages sit together because they are
 * what you hand an auditor. Six flat items would hide that structure, and the
 * structure is the product.
 *
 * Each engine carries its semantic hue on the active indicator, so you always
 * know which half of the loop you are standing in.
 */

type Item = {
  to: string; label: string; end?: boolean
  hue?: 'crimson' | 'steel' | 'brand'
  badge?: string
  desc: string
}

const OPEN_FINDINGS = FINDINGS.filter((f) => f.status === 'open').length
const PROTECTED = TARGETS.filter((t) => t.posture === 'protected').length
const EXPOSED = TARGETS.filter((t) => t.posture === 'exposed').length
const UNTESTED = TARGETS.filter((t) => t.posture === 'untested').length

const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', end: true, desc: 'Estate posture' },
      // Sits above the engines rather than inside them: initiating a loop is
      // not a Red action, it is the thing that drives all three in sequence.
      { to: '/initiate', label: 'Initiate loop', hue: 'brand', desc: 'Model · agent · app' },
      // The one live page: launches a real loop on the API and streams the
      // engine's own events. Everything else reads captured data.
      { to: '/live', label: 'Live run', hue: 'crimson', desc: 'Real op · streaming' },
    ],
  },
  {
    title: 'Engines',
    items: [
      { to: '/red', label: 'Red', hue: 'crimson', badge: String(OPEN_FINDINGS), desc: 'Offensive' },
      { to: '/blue', label: 'Blue', hue: 'steel', desc: 'Adaptive defence' },
      { to: '/purple', label: 'Purple', hue: 'brand', desc: 'Continuous assurance' },
    ],
  },
  {
    title: 'Assurance',
    items: [
      { to: '/evidence', label: 'Evidence', desc: 'Signed records' },
      { to: '/compliance', label: 'Compliance', desc: 'Framework coverage' },
    ],
  },
]

const ACTIVE = {
  crimson: { bar: 'bg-crimson', bg: 'bg-crimson-50', text: 'text-crimson', dot: 'bg-crimson' },
  steel: { bar: 'bg-steel', bg: 'bg-steel-50', text: 'text-steel', dot: 'bg-steel' },
  brand: { bar: 'bg-brand', bg: 'bg-brand-50', text: 'text-brand-deep', dot: 'bg-brand' },
} as const

export function Shell() {
  const [collapsed, setCollapsed] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  const w = collapsed ? 'w-[76px]' : 'w-[248px]'

  return (
    <div className="flex min-h-full">
      {/* ------------------------------------------------------- sidebar */}
      <aside className={`${w} sticky top-0 flex h-screen shrink-0 flex-col border-r border-border
                         bg-card transition-[width] duration-200`}>
        {/* The engine gradient as a hairline down the right edge — the loop,
            present on every screen, costing no space. */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-crimson via-brand to-steel opacity-30" />

        <div className={`flex h-[72px] items-center border-b border-border ${collapsed ? 'justify-center px-3' : 'px-5'}`}>
          <NavLink to="/dashboard" className="min-w-0">
            {collapsed ? <Mark size={30} /> : <Logo size={34} />}
          </NavLink>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {GROUPS.map((g, gi) => (
            <div key={gi}>
              {g.title && !collapsed && (
                <div className="label mb-2 px-2.5">{g.title}</div>
              )}
              {g.title && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
              <div className="space-y-0.5">
                {g.items.map((it) => (
                  <NavItem key={it.to} item={it} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Estate summary — a persistent reminder that this is an estate, not
            a single scan. Hidden when collapsed rather than truncated. */}
        {!collapsed && (
          <div className="mx-3 mb-3 rounded-2xl border border-border bg-surface p-3.5">
            <div className="label mb-2.5">Estate</div>
            <div className="mb-2 flex h-1.5 overflow-hidden rounded-pill bg-hair">
              <div className="bg-ok" style={{ width: `${(PROTECTED / TARGETS.length) * 100}%` }} />
              <div className="bg-crimson" style={{ width: `${(EXPOSED / TARGETS.length) * 100}%` }} />
              <div className="bg-border" style={{ width: `${(UNTESTED / TARGETS.length) * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted">{TARGETS.length} targets</span>
              <span className="font-semibold text-ok">{PROTECTED} protected</span>
            </div>
            {/* The authorization reference, always on screen. The platform runs
                real offensive tooling; "who said we could" should never need
                looking up. */}
            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[10px]">
              <span className="text-faint">engagement</span>
              <span className="font-mono text-muted">{ENGAGEMENT}</span>
            </div>
          </div>
        )}

        <div className={`flex items-center gap-2.5 border-t border-border p-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-brand-grad
                          text-[11px] font-bold text-white">
            SK
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-ink">Sohan K</div>
                <div className="truncate text-[10.5px] text-faint">Owner · Purplix</div>
              </div>
              <button
                onClick={() => nav('/login')}
                title="Sign out"
                className="grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors
                           hover:bg-hair hover:text-ink"
              >
                ⏻
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="absolute -right-3 top-[88px] z-20 grid h-6 w-6 place-items-center rounded-pill
                     border border-border bg-card text-[10px] text-muted shadow-sm
                     transition-colors hover:border-brand-200 hover:text-brand"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* ---------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main key={loc.pathname} className="flex-1 animate-fade-up px-8 py-7">
          <div className="mx-auto w-full max-w-[1320px]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-card px-8 py-3.5">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-5 gap-y-1
                          text-[11px] text-faint">
            <span>Purplix AI · preview</span>
            <span>Red · Blue (AEGIS) · Purple — one contract, one evidence trail</span>
            <span>Last campaign sealed {relTime(SEALED_AT)}</span>
            <span className="ml-auto font-mono">key 4c81aa93e7f10b26</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

function NavItem({ item, collapsed }: { item: Item; collapsed: boolean }) {
  const a = item.hue ? ACTIVE[item.hue] : ACTIVE.brand

  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl py-2 transition-colors ${
          collapsed ? 'justify-center px-2' : 'px-2.5'
        } ${isActive ? `${a.bg} ${a.text}` : 'text-body hover:bg-surface'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className={`absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-pill ${a.bar}`} />
          )}
          <span
            className={`h-2 w-2 shrink-0 rounded-pill transition-colors ${
              isActive ? a.dot : 'bg-border group-hover:bg-faint'
            }`}
          />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-tight">{item.label}</span>
                <span className={`block text-[10.5px] leading-tight ${isActive ? 'opacity-70' : 'text-faint'}`}>
                  {item.desc}
                </span>
              </span>
              {item.badge && (
                <span className="pill bg-crimson px-1.5 text-[10px] text-white">{item.badge}</span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

/**
 * Pillar switcher — all three carry real data now that the red, blue and
 * purple specs are wired through the same contract.
 *
 * These are TARGET TIERS (what is under test), not enforcement layers. The
 * AEGIS spec calls the same three things L1/L2/L3; in this product L1/L2/L3
 * mean input/output/config, so the two are kept apart by name everywhere.
 */
export const PILLARS = [
  { value: 'models', label: 'Models' },
  { value: 'agents', label: 'Agents' },
  { value: 'apps', label: 'Apps' },
] as const

export type PillarKey = (typeof PILLARS)[number]['value']

/** Switcher key -> the pillar value used throughout the data contract. */
export const PILLAR_OF: Record<PillarKey, 'model' | 'agent' | 'app'> = {
  models: 'model',
  agents: 'agent',
  apps: 'app',
}
