import { useMemo, useState } from 'react'
import {
  CHAINS, FINDINGS, GOLDEN_EVAL, LAYER_NAME, LLM_STATS, PASSES, TIER_LADDER,
  controlsFor, findingById, pct, relTime, type Control, type Layer,
} from '../data/fixtures'
import { PILLARS, PILLAR_OF, type PillarKey } from '../components/Shell'
import { TranscriptDrawer } from '../components/TranscriptDrawer'
import {
  Card, EmptyState, LayerPill, Metric, Mono, PageHead, SectionHead, Segmented,
  SeverityPill, StatePill, StatusPill, Tag, TierPill,
} from '../components/ui'

const LAYER_BLURB: Record<Layer, string> = {
  L1: 'Matches the structure of an attack before it reaches the target.',
  L2: 'Terminal gate on what may leave, whatever the request looked like.',
  L3: 'Closes the class of attack rather than the instance — scope, policy, prompt.',
}

export function Blue() {
  const [pillarKey, setPillarKey] = useState<PillarKey>('models')
  const pillar = PILLAR_OF[pillarKey]
  const [open, setOpen] = useState<string | null>(null)
  const [version, setVersion] = useState(PASSES.length)
  const [expanded, setExpanded] = useState<string | null>('ctl_05')

  const controls = useMemo(() => controlsFor(pillar), [pillar])
  const byLayer = (l: Layer) => controls.filter((c) => c.layer === l)

  const active = controls.filter((c) => c.state === 'ACTIVE')
  const totalBlocks = controls.reduce((a, c) => a + c.blocks, 0)
  const totalFps = controls.reduce((a, c) => a + c.falsePositives, 0)
  const evidenceLinks = controls.reduce((a, c) => a + c.derivedFrom.length, 0)
  const compiled = FINDINGS.filter(
    (f) => f.pillar === pillar && (f.status === 'compiled' || f.status === 'mitigated'),
  )
  const uncompiled = FINDINGS.filter((f) => f.pillar === pillar && f.status === 'open')
  const chains = CHAINS.filter((c) => c.hops.some((h) => h.pillar === pillar))
  const pillarFindings = FINDINGS.filter((f) => f.pillar === pillar)
  const pillarUnreachable = pillarFindings.filter((f) => f.enforceability === 'advisory')

  return (
    <>
      <PageHead
        title="Blue — adaptive defence"
        sub="Compiled from what Red actually found, filled into reviewed templates, and only promoted once replaying the original probe shows the attack collapse. Versioned, diffable, reversible — never a fine-tune, because you cannot roll back weights."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented options={PILLARS} value={pillarKey} onChange={setPillarKey} accent="steel" />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            {PASSES.map((p) => (
              <button
                key={p.passNo}
                onClick={() => setVersion(p.passNo)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  version === p.passNo ? 'bg-steel-tint text-steel' : 'text-muted hover:bg-hair'
                }`}
              >
                v{p.passNo}
              </button>
            ))}
          </div>
          <button className="btn-ghost">Diff against v{Math.max(1, version - 1)}</button>
          <button className="btn-ghost text-crimson">Roll back</button>
        </div>
      </div>

      {controls.length === 0 ? (
        <EmptyState
          icon="◇"
          title="No controls compiled for this pillar yet"
          body="Blue only ever compiles from evidence. With no confirmed findings on this pillar there is nothing to derive a control from — and a control with no finding behind it is the exact thing this engine refuses to emit."
        />
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Controls" value={String(controls.length)}
                    foot={`${active.length} active · ${controls.length - active.length} not yet promoted`} accent="steel" />
            <Metric label="Attacks blocked" value={String(totalBlocks)} tone="ok" foot="in the challenge phase" />
            <Metric label="Benign blocked" value={String(totalFps)}
                    tone={totalFps > 0 ? 'bad' : 'ok'} foot="false positives attributable to a control" />
            <Metric label="Evidence links" value={String(evidenceLinks)}
                    foot="control → finding, none unlinked" accent="brand" />
          </div>

          {/* The claim this page exists to make. */}
          <Card className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-steel-line bg-steel-tint px-4 py-3">
            <span className="pill bg-steel text-white">Bundle v{version} deployed</span>
            <span className="text-[12.5px] leading-snug text-body">
              Every control below carries the findings it was compiled from, and every chip opens
              that finding's transcript. None of them is hand-written enforcement code — the LLM
              fills parameters inside a reviewed template and nothing else, which is what keeps a
              generated defence auditable rather than merely plausible.
            </span>
          </Card>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left rail */}
        <div className="space-y-5">
          <div>
            <SectionHead hint={`${compiled.length} consumed`}>Signal inbox</SectionHead>
            <Card className="max-h-[260px] divide-y divide-hair overflow-y-auto">
              {compiled.length === 0 && uncompiled.length === 0 && (
                <div className="px-4 py-6 text-center text-[12px] text-faint">Nothing ingested yet</div>
              )}
              {compiled.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setOpen(f.id)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors
                             hover:bg-steel-tint/60"
                >
                  <SeverityPill severity={f.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-ink">{f.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-faint">{f.id}</span>
                      <Tag tone="steel">{f.sourceTool}</Tag>
                    </div>
                  </div>
                </button>
              ))}
            </Card>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              Blue is adaptive: this inbox fills from Red while a run is still going, and the
              compiler reads it as a cluster by root cause rather than one symptom at a time.
            </p>
          </div>

          {/* Escalation ladder — the LLM as a budgeted resource. */}
          <div>
            <SectionHead hint="LLM load">Escalation ladder</SectionHead>
            <Card className="divide-y divide-hair">
              {TIER_LADDER.map((t) => {
                const total = TIER_LADDER.reduce((a, x) => a + x.findings, 0)
                return (
                  <div key={t.tier} className="px-4 py-2.5" title={t.note}>
                    <div className="flex items-center gap-2">
                      <TierPill tier={t.tier} />
                      <span className="flex-1 truncate text-[11.5px] text-ink">{t.mechanism}</span>
                      <span className="num text-[12px] font-semibold text-ink">{t.findings}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-hair">
                      <div
                        className={`h-full rounded-pill ${t.tier === 'T4' ? 'bg-brand' : 'bg-steel'}`}
                        style={{ width: `${(t.findings / total) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10.5px] text-faint">
                      {t.tokens === 0 ? '0 tokens' : `${t.tokens.toLocaleString()} tokens`} · {t.resolution}
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center justify-between gap-2 bg-surface px-4 py-2.5">
                <span className="text-[11.5px] text-body">Invocation rate</span>
                <span className="num text-[12.5px] font-bold text-ok">
                  {pct(LLM_STATS.invocationRate, 1)}
                  <span className="ml-1 text-[10.5px] font-normal text-faint">
                    / {pct(LLM_STATS.invocationBudget)}
                  </span>
                </span>
              </div>
            </Card>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              {LLM_STATS.note}
            </p>
          </div>

          <div>
            <SectionHead>Enforcement layers</SectionHead>
            <Card className="divide-y divide-hair">
              {(['L1', 'L2', 'L3'] as Layer[]).map((l) => (
                <div key={l} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <LayerPill layer={l} />
                    <span className="num text-[12px] font-semibold text-ink">{byLayer(l).length}</span>
                  </div>
                  <div className="mt-1 text-[11px] font-medium text-ink">{LAYER_NAME[l]}</div>
                  <p className="mt-1 text-[11.5px] leading-snug text-body">{LAYER_BLURB[l]}</p>
                </div>
              ))}
            </Card>
            <p className="mt-2 text-[11.5px] leading-relaxed text-body">
              These are enforcement points, not target tiers. The AEGIS spec uses L1/L2/L3 for
              App/Model/Agent — the same three labels, a different axis — so the two are kept apart
              by name everywhere in this product.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          <div>
            <SectionHead
              hint={`bundle b${version}9f4c21ae7730`}
              right={<StatusPill status="deployed" />}
            >
              Policy bundle v{version}
            </SectionHead>

            <div className="space-y-3">
              {(['L1', 'L2', 'L3'] as Layer[]).map((layer) => {
                const group = byLayer(layer)
                if (!group.length) return null
                return (
                  <div key={layer}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <LayerPill layer={layer} />
                      <span className="text-[12px] font-semibold text-ink">{LAYER_NAME[layer]}</span>
                      <span className="text-[11px] text-faint">{group.length} controls</span>
                    </div>
                    <div className="space-y-2.5">
                      {group.map((c) => (
                        <ControlCard
                          key={c.id}
                          c={c}
                          open={expanded === c.id}
                          onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                          onOpenFinding={setOpen}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Provenance, stated as an arithmetic identity.
              Findings in = controls out + what could not be reached. If those
              two sides do not balance, something was quietly dropped — which
              is exactly the failure this panel exists to make impossible. */}
          <div>
            <SectionHead hint="findings in, controls out, nothing dropped">Provenance</SectionHead>
            <Card className="p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Ledger label="Findings ingested" value={pillarFindings.length} />
                <Ledger label="Compiled to controls" value={compiled.length} tone="steel" />
                <Ledger label="Unreachable" value={pillarUnreachable.length} tone="warn" />
                <Ledger label="Orphan controls" value={0} tone="ok" />
              </div>

              {pillarUnreachable.length > 0 && (
                <div className="mt-4 border-t border-hair pt-3">
                  <div className="label mb-2">No control compiled</div>
                  <div className="space-y-1.5">
                    {pillarUnreachable.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setOpen(f.id)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border
                                   bg-surface px-3 py-2 text-left transition-colors hover:bg-warn-tint/50"
                      >
                        <span className="font-mono text-[11px] text-faint">{f.id}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{f.title}</span>
                        <Tag tone="crimson">{f.reasonCode}</Tag>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-body">
                    The compiler refused to invent enforcement for these rather than emit a control
                    it could not bind to a reviewed template. A rule that looks like a defence and
                    enforces nothing is worse than an honest gap, because only one of the two gets
                    investigated.
                  </p>
                </div>
              )}

              <p className="mt-3 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-body">
                Every control above carries <span className="font-mono text-ink">derived_from</span> with
                at least one finding id, enforced by the schema, the service layer and a database
                constraint. Zero orphans is not an aspiration here — an orphan control cannot be
                stored.
              </p>
            </Card>
          </div>

          {/* The utility guard — a promotion gate, not a footnote. */}
          <div>
            <SectionHead hint="the promotion gate">Golden functional eval</SectionHead>
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div>
                  <div className="label">Passing</div>
                  <div className="num mt-1 text-[22px] font-bold text-ok">
                    {GOLDEN_EVAL.passing}/{GOLDEN_EVAL.cases}
                  </div>
                </div>
                <div>
                  <div className="label">Delta</div>
                  <div className="num mt-1 text-[22px] font-bold text-ink">{GOLDEN_EVAL.deltaPct}%</div>
                </div>
                <div>
                  <div className="label">Budget</div>
                  <div className="num mt-1 text-[22px] font-bold text-faint">{GOLDEN_EVAL.budgetPct}%</div>
                </div>
                <span className="pill ml-auto border border-ok/20 bg-ok-tint text-ok">
                  within budget · ran {relTime(GOLDEN_EVAL.at)}
                </span>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-body">{GOLDEN_EVAL.note}</p>
            </Card>
          </div>

          {/* Chains this pillar participates in. */}
          {chains.length > 0 && (
            <div>
              <SectionHead hint="cheapest breaking hop">Chains touched</SectionHead>
              <Card className="divide-y divide-hair">
                {chains.map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[12.5px] font-medium leading-snug text-ink">{c.title}</span>
                      <span className={`pill shrink-0 ${
                        c.state === 'BROKEN'
                          ? 'border border-ok/20 bg-ok-tint text-ok'
                          : 'border border-crimson-line bg-crimson-tint text-crimson'
                      }`}>
                        {c.state.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-body">{c.note}</p>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>

      <TranscriptDrawer findingId={open} onClose={() => setOpen(null)} />
    </>
  )
}

/**
 * ControlCard.
 *
 * The verification block is given as much room as the rule itself, deliberately.
 * A rule is what somebody wrote; the replay numbers are what makes it a control
 * rather than a guess, and burying them turns this page back into a config
 * dump.
 */
function ControlCard({ c, open, onToggle, onOpenFinding }: {
  c: Control; open: boolean; onToggle: () => void; onOpenFinding: (id: string) => void
}) {
  const v = c.verification
  return (
    <Card className={`overflow-hidden transition-colors ${open ? 'border-steel-line' : ''}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold text-ink">{c.kind}</span>
            <StatePill state={c.state} />
            {c.deployMode === 'monitor' && (
              <span className="pill border border-warn/20 bg-warn-tint text-warn">log only</span>
            )}
            {c.falsePositives > 0 && (
              <span className="pill border border-warn/20 bg-warn-tint text-warn">
                {c.falsePositives} FP
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-body">{c.rationale}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="num text-[15px] font-bold text-ink">{c.blocks}</div>
            <div className="text-[10px] text-faint">blocked</div>
          </div>
          <span className={`text-[11px] text-faint transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        </div>
      </button>

      {open && (
        <div className="anim-up space-y-3 border-t border-hair px-4 py-3">
          {/* Proof first. */}
          {v && (
            <div>
              <div className="label mb-1.5">Verified by replay</div>
              <div className="grid gap-2 sm:grid-cols-4">
                <Stat label="ASR before" value={pct(v.preAsr)} tone="crimson" />
                <Stat label="ASR after" value={pct(v.postAsr)} tone="ok" />
                <Stat label="Utility" value={`${v.utilityDeltaPct}%`} tone={v.utilityDeltaPct >= -2 ? 'ok' : 'crimson'} />
                <Stat label="Latency p95" value={`+${v.addedLatencyP95Ms} ms`} tone="steel" />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-body">
                Replayed against <span className="font-mono text-ink">{v.probeRef}</span> — the same
                probe that produced the finding, at pass {v.verifiedAtPass}. A control that cannot
                name the probe it was proven against has not been proven.
              </p>
            </div>
          )}

          <div>
            <div className="label mb-1.5">Template and parameters</div>
            <div className="card divide-y divide-hair px-3 py-1">
              <Row k="Template" v={<span className="font-mono text-[11px]">{c.template}</span>} />
              <Row k="Control type" v={<span className="font-mono text-[11px]">{c.controlType}</span>} />
              <Row k="Enforced at" v={<Tag tone="steel">{c.enforcementPoint}</Tag>} />
              <Row k="Mode" v={<Tag tone={c.deployMode === 'block' ? 'crimson' : 'plain'}>{c.deployMode}</Tag>} />
              <Row
                k="Authored by"
                v={
                  <span className="text-[11.5px]">
                    {c.synthesizedBy === 'template'
                      ? 'template only — no LLM'
                      : `${c.synthesizedBy} · ${c.llmModel ?? ''}`}
                  </span>
                }
              />
              {c.expiresAt && <Row k="Expires" v={<span className="text-[11.5px]">{relTime(c.expiresAt)}</span>} />}
            </div>
            <Mono className="mt-2">{JSON.stringify(c.params, null, 2)}</Mono>
          </div>

          {c.patterns.length > 0 && (
            <div>
              <div className="label mb-1.5">Rules</div>
              <Mono>{c.patterns.map((p) => `/${p}/i`).join('\n')}</Mono>
              <p className="mt-1.5 text-[11px] leading-relaxed text-body">
                Patterns target the structure of the attack, not ordinary vocabulary. Real customers
                say "refund", "override" and "escalate" — matching those bare words would show up
                immediately as a false-positive rate, which is why that rate is measured and printed
                beside every one of these.
              </p>
            </div>
          )}

          {c.addendum && (
            <div>
              <div className="label mb-1.5">System-prompt addendum</div>
              <Mono>{c.addendum}</Mono>
            </div>
          )}

          {c.pairedWith && (
            <div>
              <div className="label mb-1.5">Paired with</div>
              <p className="text-[11.5px] leading-relaxed text-body">
                This control is probabilistic and will eventually be bypassed. It is paired with{' '}
                <span className="font-mono text-ink">{c.pairedWith}</span>, the deterministic half —
                that one is load-bearing, this one buys time.
              </p>
            </div>
          )}

          {/* Invariant 1, on screen. */}
          <div>
            <div className="label mb-1.5">Derived from</div>
            <div className="flex flex-wrap gap-1.5">
              {c.derivedFrom.map((id) => {
                const f = findingById(id)
                return (
                  <button
                    key={id}
                    onClick={() => onOpenFinding(id)}
                    title={f?.title}
                    className="pill border border-brand-line bg-brand-tint text-brand-deep
                               transition-colors hover:bg-brand hover:text-white"
                  >
                    {f?.technique ?? id} ↗
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="label mb-1.5">Rollback triggers</div>
            <div className="flex flex-wrap gap-1.5">
              {c.rollbackTriggers.map((t) => <Tag key={t} tone="crimson">{t}</Tag>)}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-body">
              Rollback is the safety mechanism, not an approval gate. Gating the loop on a human
              reintroduces the bottleneck the product exists to remove — and the properties that
              make rollback safe (reversible, diffable, hash-pinned) were needed anyway.
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'crimson' | 'steel' }) {
  const c = { ok: 'text-ok', crimson: 'text-crimson', steel: 'text-steel' }[tone]
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`num mt-0.5 text-[15px] font-bold ${c}`}>{value}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[11.5px] text-muted">{k}</span>
      <span className="text-[11.5px] text-ink">{v}</span>
    </div>
  )
}

/** One side of the provenance identity. Four of these must balance. */
function Ledger({ label, value, tone }: {
  label: string; value: number; tone?: 'steel' | 'warn' | 'ok'
}) {
  const c = tone
    ? { steel: 'text-steel', warn: 'text-warn', ok: 'text-ok' }[tone]
    : 'text-ink'
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`num mt-1 font-brand text-[20px] font-bold leading-none ${c}`}>{value}</div>
    </div>
  )
}
