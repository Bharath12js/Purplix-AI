import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CHAINS, EXIT_CRITERIA, FINDINGS, LATEST, PASSES, RISK_SCORES, SEAMS, TARGETS,
  advisoryFindings, cappedTargets, estateAsr, estateFp,
  pct, pillarRiskScore, relTime,
} from '../data/fixtures'
import { LoopBand } from '../components/LoopBand'
import { TranscriptDrawer } from '../components/TranscriptDrawer'
import {
  AreaTrend, ChartFrame, ChartLegend, Donut, Dumbbell, RankedBars, SEVERITY_COLOR,
  ShareBar, STATUS_COLOR, TONE, TrendChart,
} from '../components/charts'
import {
  Card, Metric, Meter, OutcomePill, PageHead, Scroller, SectionHead, SeverityPill, StatusPill, Tag,
} from '../components/ui'

const PILLARS = ['model', 'agent', 'app'] as const

const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const

export function Dashboard() {
  const [open, setOpen] = useState<string | null>(null)

  /**
   * Three rates, one unit, one axis. Latency is the fourth number in the same
   * story and it is deliberately NOT here — milliseconds against percentages
   * needs a second y-scale, and a second y-scale invents a correlation the
   * data does not contain. It gets its own chart directly below.
   */
  const trend = PASSES.map((p) => ({
    name: `Pass ${p.passNo}`,
    unseen: Math.round(p.asrUnseen * 100),
    seen: Math.round(p.asrSeen * 100),
    fp: Math.round(p.fpRate * 1000) / 10,
  }))

  const latency = PASSES.map((p) => ({
    name: `Pass ${p.passNo}`,
    latency: p.latencyDeltaMs,
  }))

  const severityMix = SEVERITIES
    .map((s) => ({
      label: s,
      value: FINDINGS.filter((f) => f.severity === s && (f.status === 'open' || f.status === 'compiled')).length,
      colour: SEVERITY_COLOR[s],
    }))
    .filter((s) => s.value > 0)

  const byPillar = PILLARS.map((p) => {
    const ts = TARGETS.filter((t) => t.pillar === p)
    return {
      pillar: p,
      total: ts.length,
      protected: ts.filter((t) => t.posture === 'protected').length,
      exposed: ts.filter((t) => t.posture === 'exposed').length,
      untested: ts.filter((t) => t.posture === 'untested').length,
      risk: pillarRiskScore(p),
      findings: FINDINGS.filter((f) => f.pillar === p && f.status === 'open').length,
    }
  })

  const openFindings = FINDINGS.filter((f) => f.status === 'open' || f.status === 'compiled')
  const openChains = CHAINS.filter((c) => c.state === 'OPEN')

  // Estate rollups, split the way the console reports them.
  const estate = estateAsr()
  const fp = estateFp()
  const capped = cappedTargets()
  const advisory = advisoryFindings()
  const seamNames = SEAMS
    .filter((s) => capped.some((t) => t.id === s.targetId))
    .map((s) => s.name.split(' — ')[0])
    .join(' and ')

  // Coverage, stated as the red spec insists: what ran over what exists.
  const casesRun = RISK_SCORES.reduce((a, r) => a + r.casesRun, 0)
  const casesApplicable = RISK_SCORES.reduce((a, r) => a + r.applicableCases, 0)

  return (
    <>
      <PageHead
        title="Estate posture"
        sub="Every number here resolves down to the transcript that produced it. Nothing on this page is an aggregate you cannot open."
        actions={
          <>
            <button className="btn-ghost">Export board pack</button>
            <Link to="/red" className="btn-primary">Run pass</Link>
          </>
        }
      />

      <LoopBand t={LATEST} findings={LATEST.findings} controls={LATEST.controls} />

      {/* A capped target is the one thing on this page that has a specific,
          nameable action attached. It goes above the KPI strip because a
          reader who stops after the numbers should still have seen it. */}
      {capped.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-start gap-3 border-warn/20 bg-warn-tint px-4 py-3">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">
              {capped.length} target{capped.length === 1 ? ' is' : 's are'}{' '}
              <span className="text-warn">CAPPED</span> — working as designed, and still exposed
            </div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-body">
              {capped.map((t) => t.name).join(', ')} · the compiler closed everything it can reach,
              driving the enforceable half to {pct(capped[0].asrUnseenEnforceable)}.{' '}
              {/* Quote the TARGET's own residual, not the estate roll-up. The
                  estate figure is pass-weighted and dilutes a once-run target
                  to a few points, which reads as "minor" for something that is
                  in fact the worst number on the page. */}
              {advisory.length} finding{advisory.length === 1 ? '' : 's'} need an enforcement seam
              that is not installed, leaving {pct(capped[0].asrUnseenResidual)} on that target that no
              control can touch ({pct(estate.residual)} estate-weighted). Installing {seamNames} closes{' '}
              {advisory.map((f) => f.id).join(', ')}.
            </p>
          </div>
          <Link to="/purple" className="btn-ghost ml-auto shrink-0 text-[12px]">
            See what it closes →
          </Link>
        </Card>
      )}

      {/* KPI strip. Unseen ASR is split, because a single headline number
          would silently blame the loop for a seam nobody installed. */}
      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="Unseen · enforceable"
          value={pct(estate.enforceable)}
          budget={`≤ ${pct(EXIT_CRITERIA.maxAsrUnseen)}`}
          tone={estate.enforceable <= EXIT_CRITERIA.maxAsrUnseen ? 'ok' : 'bad'}
          foot="What the loop is accountable for — gated on"
          accent="brand"
          trend={PASSES.map((p) => p.asrUnseenEnforceable)}
        />
        <Metric
          label="Unseen · residual"
          value={pct(estate.residual)}
          tone={estate.residual > 0 ? 'bad' : 'ok'}
          foot="Behind a missing seam — reported, never gated"
        />
        <Metric
          label="FP · confirmed"
          value={pct(fp.confirmed, 1)}
          from={pct(fp.indicative, 1)}
          budget={`≤ ${pct(EXIT_CRITERIA.maxFpRate)}`}
          tone={fp.confirmed <= EXIT_CRITERIA.maxFpRate ? 'ok' : 'bad'}
          foot="Production canary. Struck through is the synthetic corpus"
          accent="steel"
          trend={PASSES.map((p) => p.fpRate)}
        />
        <Metric
          label="Latency p95"
          value={`+${LATEST.latencyDeltaMs} ms`}
          budget={`≤ ${EXIT_CRITERIA.maxLatencyDeltaMs} ms`}
          tone={LATEST.latencyDeltaMs <= EXIT_CRITERIA.maxLatencyDeltaMs ? 'ok' : 'bad'}
          foot="Defended path vs baseline"
          accent="steel"
          trend={PASSES.map((p) => p.latencyDeltaMs / 1000)}
        />
        <Metric
          label="Open exposures"
          value={String(openFindings.length)}
          tone="bad"
          foot={`Across ${TARGETS.filter((t) => t.openFindings > 0).length} targets · ${openChains.length} open chain`}
          accent="crimson"
          trend={PASSES.map((p) => p.findings / 6)}
        />
      </div>

      {/* The honesty bar. An ASR drop shown without its cost is a sales slide. */}
      <Card className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-brand-line bg-brand-tint px-4 py-3">
        <OutcomePill outcome={LATEST.outcome} />
        <span className="text-[12.5px] leading-snug text-body">
          Enforceable unseen ASR is <strong className="text-ink">{pct(LATEST.asrUnseenEnforceable)}</strong>,
          one point over the <strong className="text-ink">{pct(EXIT_CRITERIA.maxAsrUnseen)}</strong> budget —
          the multilingual pivot is still landing. A further{' '}
          <strong className="text-ink">{pct(estate.residual)}</strong> sits behind missing seams across the
          estate and is not gated, because no control can reach it. False-positive rate and latency
          are inside budget, so the next pass tightens coverage rather than trading usability for
          it. Coverage this pass was{' '}
          <strong className="text-ink">{casesRun.toLocaleString()}</strong> of{' '}
          <strong className="text-ink">{casesApplicable.toLocaleString()}</strong> corpus cases — a sample,
          not the population.
        </span>
        <Link to="/purple" className="btn-ghost ml-auto shrink-0 text-[12px]">
          Open loop controller
        </Link>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {/* Trend */}
          <div>
            <SectionHead hint={`${PASSES.length} passes · sealed ${relTime(LATEST.ranAt)}`}>
              Posture over time
            </SectionHead>
            <ChartFrame
              legend={
                <ChartLegend
                  items={[
                    { label: 'Unseen ASR', colour: TONE.assurance },
                    { label: 'Seen ASR', colour: TONE.offence },
                    { label: 'FP rate', colour: TONE.defence },
                  ]}
                />
              }
              table={{
                columns: ['Pass', 'Unseen ASR', 'Seen ASR', 'FP rate'],
                rows: trend.map((r) => [r.name, `${r.unseen}%`, `${r.seen}%`, `${r.fp}%`]),
              }}
              caption={
                <>
                  Seen ASR reaching zero proves little on its own — it is the set the compiler
                  trained against. The unseen line is the claim worth making, and it is measured on
                  a holdout that rotates every pass so it never decays into a regression test. The
                  dashed rule is the exit budget; the unseen line has not crossed it yet.
                </>
              }
            >
              <TrendChart
                data={trend}
                x="name"
                unit="pct"
                domain={[0, 55]}
                budget={EXIT_CRITERIA.maxAsrUnseen * 100}
                budgetLabel="unseen budget"
                series={[
                  { key: 'unseen', label: 'Unseen ASR', tone: 'assurance' },
                  { key: 'seen', label: 'Seen ASR', tone: 'offence' },
                  { key: 'fp', label: 'FP rate', tone: 'defence' },
                ]}
              />
            </ChartFrame>
          </div>

          {/* The other half of the trade, on its own axis because it has its own unit. */}
          <div>
            <SectionHead hint="milliseconds, not percent — its own axis on purpose">
              What the defence costs
            </SectionHead>
            <ChartFrame
              table={{
                columns: ['Pass', 'Added latency p95'],
                rows: latency.map((r) => [r.name, `+${r.latency} ms`]),
              }}
              caption={
                <>
                  Added p95 latency fell from <strong className="text-ink">+264 ms</strong> to{' '}
                  <strong className="text-ink">+{LATEST.latencyDeltaMs} ms</strong> as over-broad
                  pass-1 rules were narrowed — now inside the{' '}
                  {EXIT_CRITERIA.maxLatencyDeltaMs} ms budget. Plotted separately from the rate
                  chart above: sharing one y-axis between milliseconds and percentages would draw a
                  relationship between two scales that were aligned arbitrarily.
                </>
              }
            >
              <AreaTrend
                data={latency}
                x="name"
                dataKey="latency"
                label="Latency p95"
                tone="defence"
                unit="ms"
                budget={EXIT_CRITERIA.maxLatencyDeltaMs}
              />
            </ChartFrame>
          </div>

          {/* Coverage matrix — three pillars, now all live. */}
          <div>
            <SectionHead hint="3 pillars × posture × risk">Coverage</SectionHead>
            <Card>
              <Scroller>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Pillar</th>
                      <th>Targets</th>
                      <th className="w-[30%]">Posture</th>
                      <th className="text-right">Risk score</th>
                      <th className="text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPillar.map((p) => (
                      <tr key={p.pillar}>
                        <td className="font-semibold capitalize text-ink">{p.pillar}</td>
                        <td className="num text-muted">{p.total}</td>
                        <td>
                          {/* 2px of surface between segments rather than a stroke — on an
                              8px bar a border swallows the single-target segment whole. */}
                          <ShareBar
                            showLegend={false}
                            height={8}
                            segments={[
                              { label: 'protected', value: p.protected, colour: STATUS_COLOR.ok },
                              { label: 'exposed', value: p.exposed, colour: STATUS_COLOR.bad },
                              { label: 'untested', value: p.untested, colour: STATUS_COLOR.idle },
                            ]}
                          />
                        </td>
                        <td className="num text-right font-semibold text-ink">
                          {p.risk === null ? <span className="text-faint">—</span> : p.risk.toFixed(1)}
                        </td>
                        <td className="num text-right">
                          {p.findings > 0
                            ? <span className="font-semibold text-crimson">{p.findings}</span>
                            : <span className="text-faint">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
              <div className="flex flex-wrap items-center gap-4 border-t border-hair px-4 py-2.5 text-[11px] text-muted">
                <Legend2 colour="bg-ok" label="protected" />
                <Legend2 colour="bg-crimson" label="exposed" />
                <Legend2 colour="bg-border" label="untested" />
                <span className="ml-auto text-faint">
                  risk is severity-weighted and capped at 20 by any confirmed critical
                </span>
              </div>
            </Card>
          </div>

          {/* Estate */}
          <div>
            <SectionHead
              hint={`${TARGETS.length} registered`}
              right={<span className="text-[11px] text-faint">unseen ASR per target</span>}
            >
              Estate
            </SectionHead>
            <Card>
              <Scroller>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Target</th>
                      <th>Pillar</th>
                      <th>State</th>
                      <th className="text-right">Unseen ASR · enf + resid</th>
                      <th className="text-right">Open</th>
                      <th className="text-right">Last pass</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TARGETS.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink">{t.name}</span>
                            {!t.pinned && (
                              <span
                                title={t.pinNote}
                                className="pill border border-warn/20 bg-warn-tint text-warn"
                              >
                                unpinned
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-faint">{t.vendor}</div>
                        </td>
                        <td><Tag tone={t.pillar === 'model' ? 'brand' : 'plain'}>{t.pillar}</Tag></td>
                        <td><StatusPill status={t.state} /></td>
                        <td className="text-right">
                          {t.asrUnseenEnforceable === null ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16">
                                {/* The meter tracks the ENFORCEABLE half only.
                                    Filling it with a residual the loop cannot
                                    reach would read as the loop failing. */}
                                <Meter
                                  value={t.asrUnseenEnforceable}
                                  tone={t.asrUnseenEnforceable <= EXIT_CRITERIA.maxAsrUnseen ? 'ok' : 'crimson'}
                                  budget={EXIT_CRITERIA.maxAsrUnseen}
                                />
                              </div>
                              <span className="num w-9 font-semibold text-ink">
                                {pct(t.asrUnseenEnforceable)}
                              </span>
                              {(t.asrUnseenResidual ?? 0) > 0 && (
                                <span
                                  className="num w-11 text-warn"
                                  title="residual — behind a missing seam, not gated"
                                >
                                  +{pct(t.asrUnseenResidual)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="num text-right">
                          {t.openFindings > 0
                            ? <span className="font-semibold text-crimson">{t.openFindings}</span>
                            : <span className="text-faint">0</span>}
                        </td>
                        <td className="text-right text-[12px] text-muted">{relTime(t.lastRunAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
            </Card>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <div>
            <SectionHead hint="rows open the transcript">Open exposures</SectionHead>
            <Card className="max-h-[360px] divide-y divide-hair overflow-y-auto">
              {openFindings.slice(0, 9).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setOpen(f.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                             hover:bg-brand-tint/60"
                >
                  <SeverityPill severity={f.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{f.title}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Tag>{f.pillar}</Tag>
                      <Tag tone="steel">{f.sourceTool}</Tag>
                      {f.canaryLeaked && <span className="pill bg-crimson text-white">leak</span>}
                    </div>
                  </div>
                  <span className="mt-1 text-[11px] text-faint">→</span>
                </button>
              ))}
            </Card>
          </div>

          {/* Cross-layer chains — the thing single-layer tools cannot see. */}
          <div>
            <SectionHead hint={`${CHAINS.length} scored`}>Cross-layer chains</SectionHead>
            <Card className="divide-y divide-hair">
              {CHAINS.map((c) => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[12.5px] font-medium leading-snug text-ink">{c.title}</span>
                    <span className={`pill shrink-0 ${
                      c.state === 'BROKEN'
                        ? 'border border-ok/20 bg-ok-tint text-ok'
                        : 'border border-crimson-line bg-crimson-tint text-crimson'
                    }`}>
                      {c.state.toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {c.hops.map((h, i) => (
                      <span key={h.findingId} className="flex items-center gap-1">
                        <button
                          onClick={() => setOpen(h.findingId)}
                          className={`pill border font-mono text-[10px] transition-colors ${
                            i + 1 === c.cheapestBreakingHop && c.state === 'BROKEN'
                              ? 'border-ok/25 bg-ok-tint text-ok'
                              : 'border-border bg-surface text-muted hover:bg-hair'
                          }`}
                        >
                          {h.technique}
                        </button>
                        {i < c.hops.length - 1 && <span className="text-[10px] text-faint">→</span>}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
                    <span>end-to-end {pct(c.endToEndAsr)}</span>
                    <span>·</span>
                    <span>{c.state === 'BROKEN' ? `cut at hop ${c.cheapestBreakingHop}` : 'no cut yet'}</span>
                  </div>
                </div>
              ))}
            </Card>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              Each hop above is individually unremarkable. Composed, they reach applicant PII. The
              chain is cut at its cheapest link — and the <em>whole</em> chain is re-run to prove it,
              not just the hop that was patched.
            </p>
          </div>

          {/* Severity mix of what is still open — "how many" and "how bad" are
              different questions, and the KPI tile only answers the first. */}
          <div>
            <SectionHead hint="open and compiled">Exposure severity</SectionHead>
            <ChartFrame
              table={{
                columns: ['Severity', 'Findings'],
                rows: severityMix.map((s) => [s.label, s.value]),
              }}
              caption="Severity uses one hue on an ordered ramp, dark to critical — the classes are ranked, so a ranked scale is the honest encoding."
            >
              <Donut segments={severityMix} centreLabel="open" />
            </ChartFrame>
          </div>

          <div>
            <SectionHead hint="undefended → defended">Before and after</SectionHead>
            <ChartFrame
              legend={
                <ChartLegend
                  mark="rect"
                  items={[
                    { label: 'Undefended baseline', colour: TONE.offence },
                    { label: 'With bundle deployed', colour: TONE.assurance },
                  ]}
                />
              }
              table={{
                columns: ['Split', 'Undefended', 'Defended'],
                rows: [
                  ['Seen', pct(LATEST.asrSeenBefore), pct(LATEST.asrSeen)],
                  ['Unseen', pct(LATEST.asrUnseenBefore), pct(LATEST.asrUnseen)],
                ],
              }}
              caption={
                <>
                  A dumbbell rather than paired columns: the story is the <em>distance</em> each
                  split travelled, and two bar heights with a gap between them make the reader
                  measure it themselves. The seen row travels furthest — which is exactly why it is
                  not the headline.
                </>
              }
            >
              <Dumbbell
                unit="pct"
                rows={[
                  { label: 'Seen', from: LATEST.asrSeenBefore, to: LATEST.asrSeen },
                  { label: 'Unseen', from: LATEST.asrUnseenBefore, to: LATEST.asrUnseen },
                ]}
              />
            </ChartFrame>
          </div>

          {/* Risk by category — the number the coverage table can only show as a total. */}
          <div>
            <SectionHead hint="higher is more resilient">Risk by category</SectionHead>
            <ChartFrame
              table={{
                columns: ['Category', 'Score', 'Cases run', 'Corpus'],
                rows: RISK_SCORES.map((r) => [
                  `${r.owaspId} · ${r.label}`,
                  r.score === null ? '—' : r.score.toFixed(1),
                  r.casesRun,
                  r.applicableCases > 0 ? r.applicableCases.toLocaleString() : 'no manifest',
                ]),
              }}
              caption={
                <>
                  One hue, because this is a single measure ranked — colouring each bar differently
                  would encode length twice and say nothing new. A confirmed critical caps its
                  category at 20, which is why the capped rows sit flat at the bottom rather than
                  being averaged upward by the cases that passed.
                </>
              }
            >
              <RankedBars
                max={100}
                rows={[...RISK_SCORES]
                  .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
                  .map((r) => ({
                    label: `${r.owaspId} · ${r.pillar}`,
                    value: r.score ?? 0,
                    note: r.criticalCapped ? 'capped' : undefined,
                    tone: (r.score ?? 0) < 50 ? ('offence' as const) : ('defence' as const),
                  }))}
              />
            </ChartFrame>
          </div>

          <div>
            <SectionHead hint="latest first">Recent passes</SectionHead>
            <Card className="divide-y divide-hair">
              {[...PASSES].reverse().map((p) => (
                <Link
                  key={p.passNo}
                  to="/purple"
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-tint/60"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill
                                   border border-brand-line bg-brand-tint text-[11px]
                                   font-bold text-brand-deep">
                    {p.passNo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-ink">Purplix Support Assistant</div>
                    <div className="text-[11px] text-faint">
                      {p.findings} findings · {p.controls} controls · {relTime(p.ranAt)}
                    </div>
                  </div>
                  <OutcomePill outcome={p.outcome} />
                </Link>
              ))}
            </Card>
          </div>
        </div>
      </div>

      <TranscriptDrawer findingId={open} onClose={() => setOpen(null)} />
    </>
  )
}

function Legend2({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-pill ${colour}`} />
      {label}
    </span>
  )
}
