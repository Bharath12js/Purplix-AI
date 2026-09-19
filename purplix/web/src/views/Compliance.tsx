import { useState } from 'react'
import { Link } from 'react-router-dom'
import { COMPLIANCE, controlById, recordById, type ControlMapping, type Framework } from '../data/fixtures'
import {
  Card, Metric, PageHead, Scroller, SectionHead, Segmented, StatusPill, Tag,
} from '../components/ui'

const FRAMEWORKS = [
  { value: 'all', label: 'All' },
  { value: 'EU AI Act', label: 'EU AI Act' },
  { value: 'NIST AI RMF', label: 'NIST AI RMF' },
  { value: 'ISO 42001', label: 'ISO 42001' },
] as const

const FRAMEWORKS_2 = [
  { value: 'OWASP LLM Top 10', label: 'OWASP LLM Top 10' },
  { value: 'MITRE ATLAS', label: 'MITRE ATLAS' },
] as const

const ALL_FRAMEWORKS: Framework[] = [
  'EU AI Act', 'NIST AI RMF', 'ISO 42001', 'OWASP LLM Top 10', 'MITRE ATLAS',
]

type Filter = (typeof FRAMEWORKS)[number]['value'] | (typeof FRAMEWORKS_2)[number]['value']

/**
 * Compliance mapping.
 *
 * The distinction worth holding on this page: these rows are backed by signed
 * run evidence, not by someone ticking a questionnaire. So the honest thing is
 * to show the gaps just as prominently — a framework view with no gaps is one
 * nobody believes, and the two gaps here are real (human oversight and impact
 * assessment both need process evidence from outside the platform).
 */
export function Compliance() {
  const [filter, setFilter] = useState<Filter>('all')

  const rows = filter === 'all' ? COMPLIANCE : COMPLIANCE.filter((c) => c.framework === filter)

  const counts = (fw?: Framework) => {
    const set = fw ? COMPLIANCE.filter((c) => c.framework === fw) : COMPLIANCE
    return {
      total: set.length,
      covered: set.filter((c) => c.status === 'covered').length,
      partial: set.filter((c) => c.status === 'partial').length,
      gap: set.filter((c) => c.status === 'gap').length,
    }
  }

  const all = counts()

  return (
    <>
      <PageHead
        title="Framework coverage"
        sub="Mapped from loop results, not from a questionnaire. Every covered row points at a signed assurance record you can open and verify — and at the specific controls that produce the evidence."
        actions={
          <>
            <button className="btn-ghost">Export gap analysis</button>
            <button className="btn-primary">Generate board pack</button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Controls mapped" value={String(all.total)} foot={`across ${ALL_FRAMEWORKS.length} frameworks`} accent="brand" />
        <Metric label="Covered" value={String(all.covered)} tone="ok" foot="backed by signed evidence" />
        <Metric label="Partial" value={String(all.partial)} foot="evidence exists, process incomplete" />
        <Metric label="Gaps" value={String(all.gap)} tone="bad" foot="needs evidence from outside the loop" accent="crimson" />
      </div>

      {/* Per-framework summary */}
      <SectionHead hint="coverage by framework">Frameworks</SectionHead>
      <div className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {ALL_FRAMEWORKS.map((fw) => {
          const c = counts(fw)
          return (
            <Card key={fw} className="p-4">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">{fw}</div>
                  <div className="mt-0.5 text-[11px] text-faint">{c.total} controls in scope</div>
                </div>
                <span className="num text-[20px] font-bold text-brand">
                  {Math.round((c.covered / c.total) * 100)}%
                </span>
              </div>

              <div className="mb-2 flex h-2 overflow-hidden rounded-pill bg-hair">
                <div className="bg-ok" style={{ width: `${(c.covered / c.total) * 100}%` }} />
                <div className="bg-warn" style={{ width: `${(c.partial / c.total) * 100}%` }} />
                <div className="bg-crimson" style={{ width: `${(c.gap / c.total) * 100}%` }} />
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                <Leg colour="bg-ok" n={c.covered} label="covered" />
                <Leg colour="bg-warn" n={c.partial} label="partial" />
                <Leg colour="bg-crimson" n={c.gap} label="gap" />
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented options={FRAMEWORKS} value={filter} onChange={setFilter} />
          <Segmented options={FRAMEWORKS_2} value={filter} onChange={setFilter} accent="crimson" />
        </div>
        <span className="text-[11px] text-faint">{rows.length} controls shown</span>
      </div>

      <Card>
        <Scroller>
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-[130px]">Framework</th>
                <th className="w-[90px]">Ref</th>
                <th>Control</th>
                <th className="w-[100px]">Status</th>
                <th className="w-[160px]">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <Row key={r.id} r={r} />)}
            </tbody>
          </table>
        </Scroller>
      </Card>

      <Card className="mt-5 border-brand-line bg-brand-tint p-4">
        <div className="text-[12.5px] font-semibold text-ink">What this page does not claim</div>
        <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-body">
          Coverage here means the platform produces evidence an assessor would accept for that
          control — not that your organisation is compliant. Two rows are marked as gaps precisely
          because the loop cannot produce their evidence: human oversight and AI impact assessment
          are process obligations that live outside any testing tool. A vendor telling you those are
          green is telling you something false.
        </p>
      </Card>
    </>
  )
}

function Row({ r }: { r: ControlMapping }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr onClick={() => setOpen((o) => !o)} className="clickable">
        <td><Tag tone={r.framework === 'EU AI Act' ? 'brand' : 'plain'}>{r.framework}</Tag></td>
        <td className="font-mono text-[11.5px] text-ink">{r.ref}</td>
        <td className="font-medium text-ink">{r.title}</td>
        <td><StatusPill status={r.status} /></td>
        <td>
          {r.evidence.length ? (
            <div className="flex flex-wrap gap-1">
              {r.evidence.map((e) => (
                <Link
                  key={e}
                  to="/evidence"
                  onClick={(ev) => ev.stopPropagation()}
                  className="pill border border-brand-line bg-brand-tint font-mono text-[10px]
                             text-brand-deep transition-colors hover:bg-brand hover:text-white"
                >
                  pass {recordById(e)?.passNo ?? '?'} ↗
                </Link>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-faint">none</span>
          )}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} className="bg-surface">
            <div className="anim-up max-w-3xl space-y-2 py-1">
              <p className="text-[12px] leading-relaxed text-body">{r.note}</p>
              {r.controls.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-faint">enforced by</span>
                  {r.controls.map((c) => {
                    const ctl = controlById(c)
                    return (
                      <Link
                        key={c}
                        to="/blue"
                        onClick={(ev) => ev.stopPropagation()}
                        className="pill border border-steel-line bg-steel-tint font-mono text-[10px]
                                   text-steel transition-colors hover:bg-steel hover:text-white"
                      >
                        {ctl?.kind ?? c} ↗
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function Leg({ colour, n, label }: { colour: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-pill ${colour}`} />
      <span className="num font-semibold text-ink">{n}</span> {label}
    </span>
  )
}
