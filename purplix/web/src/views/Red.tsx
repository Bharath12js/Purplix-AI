import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BENCHMARKS, FINDINGS, RISK_SCORES, RUN_LOG, SEAMS, TARGETS, TECHNIQUES,
  adaptersFor, pct, pillarRiskScore, relTime, type Finding, type Pillar,
} from '../data/fixtures'
import { PILLARS, PILLAR_OF, type PillarKey } from '../components/Shell'
import { TranscriptDrawer } from '../components/TranscriptDrawer'
import {
  Card, ConfidencePill, EmptyState, Metric, PageHead, Scroller, SectionHead, Segmented,
  SeverityPill, Spinner, StatusPill, Tag,
} from '../components/ui'

/* ------------------------------------------------------------- run script */

type Line =
  | { t: 'node'; node: string; msg: string }
  | { t: 'attempt'; technique: string; tool: string; split: 'seen' | 'unseen'; breach: boolean; findingId?: string }

/**
 * The exposure phase as a scripted stream.
 *
 * Driven from the fixture corpus rather than invented, so what scrolls past
 * matches what the finding table then shows. The node names are the red spec's
 * own pipeline stages — authorize, threat-model, then adapters ordered cheap to
 * expensive, with the independent benchmark lane gathered alongside. When the
 * backend lands this is the only thing replaced; the components below read the
 * same shapes either way.
 */
function buildScript(pillar: Pillar): Line[] {
  const adapters = adaptersFor(pillar)
  const findings = FINDINGS.filter((f) => f.pillar === pillar)
  const techs = pillar === 'model'
    ? TECHNIQUES
    : findings.map((f) => ({ name: f.technique, split: f.split, sourceTool: f.sourceTool, cases: 2 }))

  const out: Line[] = [
    { t: 'node', node: 'authorize', msg: 'Engagement ENG-2026-0417 verified — scope allowlist locked' },
    { t: 'node', node: 'pin', msg: `Target pinned · digest ${TARGETS.find((t) => t.pillar === pillar)?.digest ?? '—'}` },
  ]

  if (pillar !== 'model') {
    out.push({ t: 'node', node: 'threat-model', msg: 'Precogly threat model loaded — applicable OWASP ids extracted' })

    // Stage-0 adapters produce posture findings from a static read rather than
    // from a fired probe, so they never appear in the attack loop below. They
    // still have to surface: without this the stream reports more findings at
    // handoff than the table can show, and a configuration finding held to a
    // literal-zero residual is the last one you want silently dropped.
    findings
      .filter((f) => adapters.some((a) => a.tool === f.sourceTool && a.stage === 0))
      .forEach((f) => {
        out.push({
          t: 'attempt', technique: f.technique, tool: f.sourceTool,
          split: f.split, breach: true, findingId: f.id,
        })
      })
  }

  adapters
    .filter((a) => a.stage > 0)
    .sort((a, b) => a.stage - b.stage)
    .forEach((a) => {
      out.push({ t: 'node', node: a.tool, msg: `Stage ${a.stage} · ${a.mechanism}` })
      techs
        .filter((x) => x.sourceTool === a.tool)
        .forEach((tech) => {
          const hit = findings.find((f) => f.technique === tech.name)
          out.push({
            t: 'attempt', technique: tech.name, tool: a.tool,
            split: tech.split as 'seen' | 'unseen', breach: Boolean(hit), findingId: hit?.id,
          })
          out.push({
            t: 'attempt', technique: tech.name, tool: a.tool,
            split: tech.split as 'seen' | 'unseen', breach: false,
          })
        })
    })

  const bench = BENCHMARKS.filter((b) => b.pillar === pillar)
  if (bench.length) {
    out.push({
      t: 'node', node: 'benchmark',
      msg: `Independent lane · ${bench.map((b) => `${b.name} ${b.casesRun}/${b.corpusSize}`).join(' · ')}`,
    })
  }

  out.push(
    { t: 'node', node: 'taxonomy', msg: 'Techniques mapped to OWASP / ATLAS / CWE from the versioned table' },
    { t: 'node', node: 'redact', msg: 'Evidence redacted on write — secrets and PII scrubbed before storage' },
    { t: 'node', node: 'risk', msg: `Risk score ${pillarRiskScore(pillar) ?? '—'} — severity-weighted, critical-capped` },
    { t: 'node', node: 'handoff', msg: `${findings.length} findings normalised to UFM and handed to Blue` },
  )
  return out
}

/* ------------------------------------------------------------------ view */

export function Red() {
  const [pillarKey, setPillarKey] = useState<PillarKey>('models')
  const pillar = PILLAR_OF[pillarKey]

  const pillarTargets = useMemo(() => TARGETS.filter((t) => t.pillar === pillar), [pillar])
  const [targetId, setTargetId] = useState(pillarTargets[0]?.id ?? '')
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'critical' | 'unseen'>('all')
  const logRef = useRef<HTMLDivElement>(null)

  const script = useMemo(() => buildScript(pillar), [pillar])

  // Switching pillar switches target and clears the stream — leaving a model
  // run on screen under an agent heading would be worse than an empty panel.
  useEffect(() => {
    setTargetId(pillarTargets[0]?.id ?? '')
    setLines([])
    setRunning(false)
  }, [pillar, pillarTargets])

  // Driven off the array length rather than a closure counter. A counter
  // captured in the interval races with StrictMode's double-mount and can push
  // past the end of the script, putting an undefined into the stream.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setLines((prev) => (prev.length >= script.length ? prev : [...prev, script[prev.length]]))
    }, 120)
    return () => clearInterval(id)
  }, [running, script])

  useEffect(() => {
    if (running && lines.length >= script.length) setRunning(false)
  }, [running, lines.length, script.length])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines.length])

  const targetFindings = FINDINGS.filter((f) => f.targetId === targetId)
  /** Findings this pass produced that no control can be compiled for. */
  const unreachable = targetFindings.filter((f) => f.enforceability === 'advisory')
  const revealed = running || lines.length > 0
    ? targetFindings.filter((f) => lines.some((l) => l.t === 'attempt' && l.findingId === f.id))
    : targetFindings

  const shown = revealed.filter((f) =>
    filter === 'all' ? true : filter === 'critical' ? f.severity === 'critical' : f.split === 'unseen',
  )

  const breaches = lines.filter((l) => l.t === 'attempt' && l.breach).length
  const attempts = lines.filter((l) => l.t === 'attempt').length
  const totalAttempts = script.filter((l) => l.t === 'attempt').length

  const risk = RISK_SCORES.filter((r) => r.pillar === pillar)
  const runLog = RUN_LOG.filter((r) => r.pillar === pillar)
  const adapters = adaptersFor(pillar)

  const start = () => { setLines([]); setRunning(true) }

  return (
    <>
      <PageHead
        title="Red — offensive"
        sub="Nine wrapped adapters plus the in-house runner, ordered cheap to expensive, every result normalised into one schema. Launch a battery, watch it land, open the evidence behind every hit."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={PILLARS} value={pillarKey} onChange={setPillarKey} accent="crimson" />
        <div className="flex items-center gap-2">
          {running && <Spinner label={`${attempts}/${totalAttempts} attempts`} />}
          <button onClick={start} disabled={running || !targetId} className="btn-primary">
            {running ? 'Running…' : lines.length ? 'Re-run exposure' : 'Run exposure'}
          </button>
        </div>
      </div>

      {/* Launch bar — authorization is part of the launch, not a settings page. */}
      <Card className="mb-5 grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label>
          <div className="label mb-1.5">Target</div>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={running}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-ink
                       outline-none focus:border-brand-line focus:ring-2 focus:ring-brand-tint"
          >
            {pillarTargets.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — {t.vendor}</option>
            ))}
          </select>
        </label>

        <div>
          <div className="label mb-1.5">Authorization</div>
          <div className="flex items-center justify-between rounded-xl border border-border
                          bg-surface px-3 py-2 text-[13px]">
            <span className="text-ink">{TARGETS.find((t) => t.id === targetId)?.engagementRef ?? '—'}</span>
            <span className="pill border border-ok/20 bg-ok-tint text-ok">scope locked</span>
          </div>
        </div>

        <div className="flex items-end gap-2">
          {adapters.map((a) => <Tag key={a.tool} tone="crimson">{a.tool}</Tag>)}
        </div>
      </Card>

      {!TARGETS.find((t) => t.id === targetId)?.pinned && (
        <Card className="mb-5 border-warn/20 bg-warn-tint px-4 py-3 text-[12.5px] leading-snug text-body">
          <strong className="text-ink">Target is unpinned.</strong>{' '}
          {TARGETS.find((t) => t.id === targetId)?.pinNote} Every number from this run carries that
          caveat onto the assurance record — a defence improvement and a model update become
          indistinguishable without a digest, and pretending otherwise is the failure mode.
        </Card>
      )}

      {/* Live counters */}
      {lines.length > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Attempts" value={String(attempts)} foot={`of ${totalAttempts} in this battery`} accent="crimson" />
          <Metric label="Breaches" value={String(breaches)}
                  tone={breaches > 0 ? 'bad' : 'ok'} foot="attacks that achieved their objective" />
          <Metric label="Findings" value={String(revealed.length)} foot="each carries its transcript" />
          <Metric label="Risk score" value={String(pillarRiskScore(pillar) ?? '—')}
                  tone={(pillarRiskScore(pillar) ?? 100) < 50 ? 'bad' : 'ok'}
                  foot="severity-weighted · capped at 20 by any critical" accent="brand" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Run stream */}
        <div className="space-y-5">
          <div>
            <SectionHead hint={running ? 'streaming' : `${lines.length} events`}>
              Run stream
            </SectionHead>
            <Card className="h-[460px] overflow-hidden">
              <div ref={logRef} className="h-full overflow-y-auto px-3 py-2.5">
                {lines.length === 0 ? (
                  <div className="grid h-full place-items-center px-8 text-center">
                    <div>
                      <div className="mx-auto mb-3 h-px w-24 bg-engine-grad" />
                      <p className="text-[13px] leading-relaxed text-body">
                        One pass runs the whole loop — attack, compile a defence from what lands,
                        then re-attack with techniques the compiler never saw.
                      </p>
                    </div>
                  </div>
                ) : (
                  lines.map((l, i) => <LogLine key={i} line={l} onOpen={setOpen} />)
                )}
                {running && <div className="shimmer mt-1 h-4 rounded" />}
              </div>
            </Card>
          </div>

          {/* Adapter run log — failures are logged, not swallowed. */}
          <div>
            <SectionHead hint="failure-isolated">Adapter run log</SectionHead>
            <Card className="divide-y divide-hair">
              {runLog.map((r, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-pill ${
                    r.event === 'completed' ? 'bg-ok' : r.event === 'error' ? 'bg-crimson' : 'bg-border'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[12px] font-semibold text-ink">{r.tool}</span>
                      <span className="text-[11px] text-faint">{(r.durationMs / 1000).toFixed(1)}s</span>
                      <span className="ml-auto text-[11px] text-faint">{relTime(r.at)}</span>
                    </div>
                    {r.message && (
                      <p className="mt-0.5 text-[11.5px] leading-snug text-crimson">{r.message}</p>
                    )}
                  </div>
                  <span className="num shrink-0 text-[12px] text-muted">{r.findings}</span>
                </div>
              ))}
            </Card>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              One adapter dying does not end the op — it writes an error line and the pipeline
              continues with a documented fallback. That is why a missing tool has to appear here as
              a red line rather than as a clean zero in the results.
            </p>
          </div>
        </div>

        {/* Findings + coverage */}
        <div className="space-y-5">
          <div>
            <SectionHead
              hint="rows open the transcript"
              right={
                <div className="flex gap-1">
                  {(['all', 'critical', 'unseen'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                        filter === f ? 'bg-crimson-tint text-crimson' : 'text-muted hover:bg-hair'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              }
            >
              Findings
            </SectionHead>

            {shown.length === 0 ? (
              <EmptyState
                icon="⌕"
                title={lines.length ? 'Nothing matches this filter' : 'No findings yet'}
                body="A finding is one successful attack. It never appears without the transcript that produced it — that link is the product."
              />
            ) : (
              <Card className="divide-y divide-hair">
                {shown.map((f) => <FindingRow key={f.id} f={f} onOpen={setOpen} />)}
              </Card>
            )}
          </div>

          {/* What Red found and Blue will not be able to close. Surfaced here,
              beside the findings, rather than discovered later as a silent gap
              between "18 found" and "12 controls". */}
          {unreachable.length > 0 && (
            <div>
              <SectionHead hint="Red found it · Blue cannot reach it">Unreachable</SectionHead>
              <Card className="divide-y divide-hair">
                {unreachable.map((f) => {
                  const seam = SEAMS.find((s) => s.id === f.seamId)
                  return (
                    <div key={f.id} className="px-4 py-3">
                      <button
                        onClick={() => setOpen(f.id)}
                        className="flex w-full items-start gap-2.5 text-left"
                      >
                        <SeverityPill severity={f.severity} />
                        <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-snug text-ink">
                          {f.title}
                        </span>
                        <span className="mt-0.5 shrink-0 text-[11px] text-faint">→</span>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Tag tone="crimson">{f.reasonCode}</Tag>
                        {seam && <span className="font-mono text-[11px] text-muted">{seam.name}</span>}
                        {seam && (
                          <span className="num ml-auto text-[11.5px] font-semibold text-crimson">
                            −{pct(seam.removesPoints)} unseen ASR
                          </span>
                        )}
                      </div>
                      {seam && (
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-body">{seam.note}</p>
                      )}
                    </div>
                  )
                })}
              </Card>
              <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                These are counted as <strong className="text-ink">missing seams</strong>, never as compiler
                failures. Red's job ends at trustworthy evidence; whether anything can act on that
                evidence is a property of the target, and saying so is the difference between a
                number and an instruction.
              </p>
            </div>
          )}

          {/* Coverage — the red spec's whole point about denominators. */}
          <div>
            <SectionHead hint="cases run vs corpus manifest">Coverage</SectionHead>
            <Card>
              <Scroller>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="text-right">Score</th>
                      <th className="text-right">Run</th>
                      <th className="text-right">Corpus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risk.map((r) => (
                      <tr key={r.owaspId}>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Tag tone="brand">{r.owaspId}</Tag>
                            <span className="text-[12px] text-ink">{r.label}</span>
                          </div>
                        </td>
                        <td className="num text-right">
                          {r.score === null ? (
                            <span className="text-faint">—</span>
                          ) : (
                            <span className={`font-semibold ${r.criticalCapped ? 'text-crimson' : 'text-ink'}`}>
                              {r.score.toFixed(1)}
                              {r.criticalCapped && <span className="ml-1 text-[10px]">capped</span>}
                            </span>
                          )}
                        </td>
                        <td className="num text-right text-muted">{r.casesRun}</td>
                        <td className="num text-right text-faint">
                          {r.applicableCases > 0 ? r.applicableCases.toLocaleString() : 'no manifest'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
              <p className="border-t border-hair px-4 py-2.5 text-[11.5px] leading-relaxed text-body">
                Run and corpus are allowed to diverge, and usually do — that gap <em>is</em> the
                coverage statement. A score whose denominator equals its own numerator always reads
                as full coverage, which is exactly how "we tested LLM01" comes to mean nothing. A
                confirmed critical caps its category at 20 so it cannot be averaged away.
              </p>
            </Card>
          </div>
        </div>
      </div>

      <TranscriptDrawer findingId={open} onClose={() => setOpen(null)} />
    </>
  )
}

/* ---------------------------------------------------------------- pieces */

function FindingRow({ f, onOpen }: { f: Finding; onOpen: (id: string) => void }) {
  const chips = [...f.taxonomy.owaspLlm, ...f.taxonomy.owaspAsi, ...f.taxonomy.atlas]
  return (
    <button
      onClick={() => onOpen(f.id)}
      className="anim-up flex w-full items-start gap-3 px-4 py-3 text-left transition-colors
                 hover:bg-crimson-tint/40"
    >
      <SeverityPill severity={f.severity} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-snug text-ink">{f.title}</div>
        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted">{f.summary}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Tag>{f.technique}</Tag>
          <Tag tone="steel">{f.sourceTool}</Tag>
          {chips.map((c) => <Tag key={c} tone="brand">{c}</Tag>)}
          <StatusPill status={f.status} />
          <ConfidencePill confidence={f.confidence} />
          {/* Advisory is not a severity and not a status — it is a statement
              about reach. Marking it inline stops a reader assuming an open
              finding is simply one the compiler has not got to yet. */}
          {f.enforceability === 'advisory' && (
            <span className="pill border border-warn/20 bg-warn-tint text-warn">
              advisory · {f.reasonCode}
            </span>
          )}
          <span className="num text-[10.5px] text-faint">
            {f.reproduction.successes}/{f.reproduction.attempts} · {pct(f.reproduction.asr)}
          </span>
        </div>
      </div>
      <span className="mt-1 shrink-0 text-[11px] text-faint">→</span>
    </button>
  )
}

function LogLine({ line, onOpen }: { line: Line; onOpen: (id: string) => void }) {
  if (line.t === 'node') {
    return (
      <div className="anim-up flex items-baseline gap-2 py-1.5">
        <span className="pill border border-brand-line bg-brand-tint font-mono text-[10px] text-brand-deep">
          {line.node}
        </span>
        <span className="text-[12.5px] text-body">{line.msg}</span>
      </div>
    )
  }

  const clickable = Boolean(line.findingId)
  return (
    <div
      onClick={() => line.findingId && onOpen(line.findingId)}
      className={`anim-up flex items-center gap-2.5 rounded-lg px-1.5 py-1 font-mono text-[11.5px] ${
        clickable ? 'cursor-pointer hover:bg-crimson-tint/50' : ''
      }`}
    >
      <span className={`w-[52px] shrink-0 font-semibold ${line.breach ? 'text-crimson' : 'text-ok'}`}>
        {line.breach ? 'BREACH' : 'held'}
      </span>
      <span className={`w-[46px] shrink-0 ${line.split === 'unseen' ? 'text-brand' : 'text-faint'}`}>
        {line.split}
      </span>
      <span className="truncate text-ink">{line.technique}</span>
      {clickable && <span className="ml-auto shrink-0 text-[10px] text-crimson">open ↗</span>}
    </div>
  )
}
