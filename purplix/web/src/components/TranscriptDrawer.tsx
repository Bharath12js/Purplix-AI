import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  CANARY, controlsDerivedFrom, findingById, pct, relTime, targetById,
} from '../data/fixtures'
import {
  ConfidencePill, KeyValue, Mono, MonoHighlight, SeverityPill, StatusPill, Tag, TierPill,
} from './ui'

/**
 * The hard rule made visible: no count without a path.
 *
 * Every finding row in the product opens THIS — raw attacker input, raw reply,
 * and how the verdict was reached — never a summary modal. It is what
 * separates the product from a scanner that hands you a number and asks you to
 * believe it, and it is the last thing that should ever be cut.
 *
 * Three things the integrated specs added to this panel, each earning its space:
 *
 *   Reproduction — a stochastic target does not answer yes or no, it answers
 *   17-of-20. Showing the interval stops a one-off fluke being read as the same
 *   claim as a reliable exploit.
 *
 *   Tier trace — which escalation tier resolved it. A finding marked T0 was
 *   settled by a deterministic oracle and cost nothing; that is the evidence
 *   behind the platform's LLM-budget claim, and it belongs next to the verdict
 *   rather than in an ops chart nobody opens.
 *
 *   Controls derived — the reverse direction of `derived_from`. From a control
 *   you can already reach its evidence; without this, you could not walk back
 *   the other way, and "did the remediation hit the root cause?" would stay
 *   rhetorical.
 */
export function TranscriptDrawer({ findingId, onClose }: {
  findingId: string | null; onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (findingId) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [findingId])

  if (!findingId) return null
  const f = findingById(findingId)
  if (!f) return null

  const target = targetById(f.targetId)
  const groundTruth = f.tierTrace[0] === 'T0'
  const usedLlm = f.tierTrace.includes('T4')
  const derived = controlsDerivedFrom(f.id)
  const taxonomyChips = [
    ...f.taxonomy.owaspLlm, ...f.taxonomy.owaspAsi, ...f.taxonomy.atlas, ...f.taxonomy.cwe,
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />

      <aside className="anim-slide relative z-10 flex h-full w-full max-w-[760px] flex-col
                        border-l border-border bg-card shadow-drawer">
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="label">Transcript · {f.id}</div>
              <h3 className="mt-1 text-[16px] font-semibold leading-snug text-ink">{f.title}</h3>
            </div>
            <button onClick={onClose} className="btn-ghost shrink-0 px-2.5 py-1 text-[12px]">
              Esc
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SeverityPill severity={f.severity} />
            <StatusPill status={f.status} />
            <ConfidencePill confidence={f.confidence} />
            <Tag>{f.technique}</Tag>
            <Tag tone="steel">{f.sourceTool}</Tag>
            {taxonomyChips.map((t) => <Tag key={t} tone="brand">{t}</Tag>)}
            {f.canaryLeaked && (
              <span className="pill bg-crimson text-white">canary leaked</span>
            )}
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-pill bg-crimson" />
              <span className="label text-crimson">Attacker input</span>
              <span className="ml-auto font-mono text-[10.5px] text-faint">{f.probeRef}</span>
            </div>
            <Mono tone="attack">{f.request}</Mono>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-pill bg-muted" />
              <span className="label">{f.pillar === 'agent' ? 'Action trace' : 'Target reply'}</span>
              <span className="ml-auto text-[11px] text-faint">{target?.name}</span>
            </div>
            {f.canaryLeaked
              ? <MonoHighlight text={f.response} needle={CANARY} />
              : <Mono>{f.response}</Mono>}
            {f.canaryLeaked && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                Highlighted above is the canary. The verdict here is a string match, not a model's
                opinion — which is why this number survives being questioned.
              </p>
            )}
            {f.pillar === 'agent' && !f.canaryLeaked && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                On the agent pillar the failure is the <strong className="text-ink">action</strong>, not the
                text. The rubric scores the tool call above; a persuasive-sounding reply with no
                out-of-scope call is not a finding.
              </p>
            )}
          </section>

          {/* Reproduction — the honest shape of "did it work". */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-pill bg-crimson" />
              <span className="label">Reproduction</span>
            </div>
            <div className="card px-4 py-1 divide-y divide-hair">
              <KeyValue
                k="Attempts"
                v={<span className="num">{f.reproduction.successes} / {f.reproduction.attempts} succeeded</span>}
              />
              <KeyValue k="Attack success rate" v={<strong className="num text-ink">{pct(f.reproduction.asr)}</strong>} />
              <KeyValue
                k="95% interval"
                v={<span className="num">{pct(f.reproduction.ci95[0])} – {pct(f.reproduction.ci95[1])}</span>}
              />
              <KeyValue k="Split" v={<Tag tone={f.split === 'unseen' ? 'brand' : 'plain'}>{f.split}</Tag>} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              Against a probabilistic target there is no single-shot answer. The interval is what
              keeps a 1-of-1 fluke from being reported beside a 17-of-20 as though they were the
              same claim.
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-pill bg-brand" />
              <span className="label">How this was judged</span>
            </div>
            <div className="card divide-y divide-hair px-4 py-1">
              <KeyValue
                k="Outcome"
                v={<span className="font-semibold text-crimson">Attack succeeded</span>}
              />
              <KeyValue k="Judged by" v={<span className="font-mono text-[11px]">{f.judgeModel}</span>} />
              <KeyValue
                k="Confidence"
                v={
                  <span className="num">
                    {Math.round(f.judgeConfidence * 100)}%
                    {groundTruth && <span className="ml-1.5 text-[10px] text-ok">ground truth</span>}
                  </span>
                }
              />
              <KeyValue
                k="Resolved at"
                v={<span className="flex gap-1">{f.tierTrace.map((t) => <TierPill key={t} tier={t} />)}</span>}
              />
              <KeyValue k="Latency" v={<span className="num">{f.latencyMs} ms</span>} />
              <KeyValue k="Exposure" v={<Tag>{f.exposure}</Tag>} />
              <KeyValue k="Risk score" v={<span className="num">{f.riskScore.toFixed(1)}</span>} />
              <KeyValue k="Found in" v={`pass ${f.passNo} · ${relTime(f.foundAt)}`} />
              <KeyValue k="Evidence" v={<span className="font-mono text-[11px]">{f.evidenceRef}</span>} />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">{f.summary}</p>
          </section>

          {f.blastRadius.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-pill bg-warn" />
                <span className="label text-warn">Blast radius</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {f.blastRadius.map((b) => <Tag key={b} tone="crimson">{b}</Tag>)}
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                What this finding reaches if it is chained rather than used alone. This is the field
                the chain scorer reads — a medium finding with a wide radius outranks a high one
                that ends where it starts.
              </p>
            </section>
          )}

          {/* Provenance, walked backwards. */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-pill bg-steel" />
              <span className="label text-steel">Controls derived from this</span>
            </div>
            {derived.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-body">
                None yet. This finding has not been compiled into a control — either it is still
                open, or no reviewed template covers it and the compiler correctly refused to
                invent enforcement code for it.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {derived.map((c) => (
                  <Link
                    key={c.id}
                    to="/blue"
                    className="pill border border-steel-line bg-steel-tint text-steel
                               transition-colors hover:bg-steel hover:text-white"
                  >
                    {c.kind} ↗
                  </Link>
                ))}
              </div>
            )}
          </section>

          {usedLlm && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-pill bg-warn" />
                <span className="label text-warn">Escalated to T4</span>
              </div>
              <p className="text-[12px] leading-relaxed text-body">
                The deterministic oracle and the local classifier both left this ambiguous, so it
                reached the reasoning tier. The LLM proposed the verdict; it did not close the
                finding — that still required deterministic corroboration, and no LLM output ever
                reaches live traffic.
              </p>
            </section>
          )}
        </div>

        <footer className="border-t border-border px-6 py-3">
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span className="font-mono">{f.dedupeKey}</span>
            <span>Redacted on write · retained per policy</span>
          </div>
        </footer>
      </aside>
    </div>
  )
}
