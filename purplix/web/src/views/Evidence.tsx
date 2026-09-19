import { useState } from 'react'
import { RECORDS, absTime, relTime, targetById, type AssuranceRecord } from '../data/fixtures'
import {
  Card, KeyValue, Metric, Mono, OutcomePill, PageHead, SectionHead, Tag,
} from '../components/ui'

/**
 * Evidence vault.
 *
 * The page you hand an auditor. Three claims it has to make legible:
 *
 *   1. Each record is signed, so it cannot be edited after the fact.
 *   2. Each record embeds the previous one's hash, so a pass that went badly
 *      cannot be quietly deleted or reordered — the chain would break.
 *   3. Each record names every input that could change the result: target
 *      digest, threat-model hash, battery hash, judge rubric hash, bundle hash.
 *      Without all five, a number cannot be compared against last week's.
 *
 * The second is the one people miss, which is why the chain is drawn rather
 * than described — and the record it protects hardest is the failed one.
 */
export function Evidence() {
  const [sel, setSel] = useState<AssuranceRecord>(RECORDS[RECORDS.length - 1])
  const [raw, setRaw] = useState(true)

  const allVerified = RECORDS.every((r) => r.verified)
  const p = sel.payload as any

  return (
    <>
      <PageHead
        title="Evidence vault"
        sub="Signed, hash-chained assurance records. Each one ties a result to the exact target digest, threat model, battery, judge rubric and policy bundle that produced it — and records the outcome verbatim, including when that outcome is a failure."
        actions={
          <>
            <button className="btn-ghost">Download public key</button>
            <button className="btn-primary">Export for auditor</button>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Records" value={String(RECORDS.length)} foot="one per completed pass" accent="brand" />
        <Metric label="Chain integrity" value={allVerified ? 'Intact' : 'Broken'}
                tone={allVerified ? 'ok' : 'bad'} foot="every link verifies" />
        <Metric label="Signature scheme" value="Ed25519" foot="self-signed, key published" accent="steel" />
        <Metric label="Key id" value="4c81aa93" foot="verifiable at /.well-known/purplix-key" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Chain */}
        <div>
          <SectionHead hint="oldest first">Hash chain</SectionHead>
          <Card className="p-5">
            <ol className="relative">
              {/* genesis */}
              <li className="relative flex gap-4 pb-6">
                <span className="absolute left-[11px] top-6 h-full w-px bg-border" />
                <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center
                                 rounded-pill border border-border bg-surface text-[10px] text-faint">
                  ○
                </span>
                <div className="pt-0.5">
                  <div className="text-[12.5px] font-semibold text-muted">Genesis</div>
                  <div className="text-[11px] text-faint">No predecessor — chain starts here</div>
                </div>
              </li>

              {RECORDS.map((r, i) => {
                const active = sel.id === r.id
                const last = i === RECORDS.length - 1
                const rp = r.payload as any
                return (
                  <li key={r.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last && <span className="absolute left-[11px] top-7 h-full w-px bg-brand-line" />}
                    <button
                      onClick={() => setSel(r)}
                      className={`relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center
                                  rounded-pill border text-[10px] font-bold transition-colors ${
                        active
                          ? 'border-brand bg-brand text-white'
                          : 'border-brand-line bg-brand-tint text-brand-deep hover:bg-brand hover:text-white'
                      }`}
                    >
                      {r.passNo}
                    </button>

                    <button onClick={() => setSel(r)} className="min-w-0 flex-1 text-left">
                      <div className={`rounded-xl border p-3 transition-colors ${
                        active ? 'border-brand-line bg-brand-tint' : 'border-border bg-card hover:bg-brand-tint/40'
                      }`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12.5px] font-semibold text-ink">Pass {r.passNo}</span>
                          <OutcomePill outcome={r.outcome} />
                          {r.verified && (
                            <span className="pill border border-ok/20 bg-ok-tint text-ok">✓ verified</span>
                          )}
                        </div>

                        <dl className="mt-2 space-y-1">
                          <ChainRow k="this" v={r.selfHash} tone="brand" />
                          <ChainRow k="prev" v={r.prevHash || 'genesis'} tone={r.prevHash ? 'plain' : 'faint'} />
                        </dl>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10.5px] text-faint">
                          <span>unseen {(rp.scorecard.asr_unseen * 100).toFixed(0)}%</span>
                          <span>·</span>
                          <span>FP {(rp.scorecard.fp_rate_benign * 100).toFixed(1)}%</span>
                          <span>·</span>
                          <span>{relTime(r.signedAt)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>

            <p className="mt-2 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-body">
              Each record's <span className="font-mono text-ink">prev</span> is the previous
              record's <span className="font-mono text-ink">this</span>. Removing pass 1 — the one
              recorded as <strong className="text-ink">regressed</strong>, with a 13% false-positive rate —
              would orphan everything after it. That is the point: the inconvenient result is the
              one the chain protects.
            </p>
          </Card>
        </div>

        {/* Record detail */}
        <div>
          <SectionHead
            hint={sel.id}
            right={
              <div className="flex gap-1">
                {(['summary', 'raw'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setRaw(m === 'raw')}
                    className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                      (m === 'raw') === raw ? 'bg-brand-tint text-brand-deep' : 'text-muted hover:bg-hair'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            }
          >
            Assurance record
          </SectionHead>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="pill border border-ok/20 bg-ok-tint text-ok">✓ Ed25519 verified</span>
              <Tag>key {sel.keyId}</Tag>
              <Tag tone="brand">pass {sel.passNo}</Tag>
              <OutcomePill outcome={sel.outcome} />
              <span className="ml-auto text-[11px] text-faint">{absTime(sel.signedAt)}</span>
            </div>

            {raw ? (
              <Mono className="max-h-[560px] overflow-y-auto">
                {JSON.stringify(sel.payload, null, 2)}
              </Mono>
            ) : (
              <div className="space-y-4">
                <Block title="Target">
                  <KeyValue k="Name" v={targetById(sel.targetId)?.name ?? '—'} />
                  <KeyValue k="Pillar" v={<Tag>{p.target.pillar}</Tag>} />
                  <KeyValue k="Digest" v={<span className="font-mono text-[11px]">{p.target.digest}</span>} />
                  <KeyValue k="Pinned" v={p.target.pinned ? 'yes' : <span className="text-warn">no — recorded as a limitation</span>} />
                </Block>

                <Block title="Authorization">
                  <KeyValue k="Engagement" v={<span className="font-mono text-[11px]">{p.authorization.engagement_ref}</span>} />
                  <KeyValue k="Authorized" v={p.authorization.authorized ? 'yes' : 'no'} />
                </Block>

                <Block title="Inputs that could move the number">
                  <KeyValue k="Threat model" v={<span className="font-mono text-[11px]">{p.threat_model.ref} · {p.threat_model.hash}</span>} />
                  <KeyValue k="Battery" v={<span className="font-mono text-[11px]">{p.battery.name} v{p.battery.version} · {p.battery.hash}</span>} />
                  <KeyValue k="Adapters" v={<span className="text-[11px]">{p.battery.adapters.join(' · ')}</span>} />
                  <KeyValue k="Judge rubric" v={<span className="font-mono text-[11px]">{p.judge.rubric_hash}</span>} />
                  <KeyValue k="Policy bundle" v={<span className="font-mono text-[11px]">v{p.policy_bundle.version} · {p.policy_bundle.hash}</span>} />
                </Block>

                <Block title="Scorecard">
                  <KeyValue k="ASR seen" v={fmt(p.scorecard.asr_seen)} />
                  <KeyValue k="ASR unseen" v={<strong className="text-ink">{fmt(p.scorecard.asr_unseen)}</strong>} />
                  <KeyValue k="FP rate" v={fmt(p.scorecard.fp_rate_benign, 1)} />
                  <KeyValue k="Latency delta p95" v={`+${p.scorecard.latency_delta_p95_ms} ms`} />
                  <KeyValue k="Outcome" v={<OutcomePill outcome={p.outcome} />} />
                </Block>

                <Block title="Holdout">
                  <KeyValue k="Split by" v={p.holdout.split_by} />
                  <KeyValue k="Techniques" v={<span className="font-mono text-[11px]">{p.holdout.techniques.join(', ')}</span>} />
                  <KeyValue
                    k="Retired"
                    v={<span className="font-mono text-[11px]">{p.holdout.retired_to_seen.join(', ') || '—'}</span>}
                  />
                </Block>

                <Block title="Cost and provenance">
                  <KeyValue k="LLM invocation rate" v={fmt(p.llm.invocation_rate, 1)} />
                  <KeyValue k="Golden eval delta" v={`${p.utility.golden_eval_delta_pct}%`} />
                  <KeyValue k="Findings → controls" v={`${p.provenance.findings} → ${p.provenance.controls}`} />
                  <KeyValue k="Orphan controls" v={<span className="text-ok">{p.provenance.orphan_controls}</span>} />
                  <KeyValue k="Orphan counts" v={<span className="text-ok">{p.provenance.orphan_counts}</span>} />
                </Block>

                <Block title="Chain">
                  <KeyValue k="This record" v={<span className="font-mono text-[11px] text-brand-deep">{sel.selfHash}</span>} />
                  <KeyValue k="Previous" v={<span className="font-mono text-[11px]">{sel.prevHash || 'genesis'}</span>} />
                  <KeyValue k="Signature" v={<span className="font-mono text-[11px]">{sel.signature}</span>} />
                </Block>
              </div>
            )}

            <p className="mt-4 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-body">
              Verification checks two things, not one: that the signature is valid, and that the
              payload hashes to the value shown. A valid signature over a <em>different</em> payload
              than the one on screen is the failure mode worth catching.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}

const fmt = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <div className="rounded-xl border border-border bg-surface px-3 py-1.5">{children}</div>
    </div>
  )
}

function ChainRow({ k, v, tone }: { k: string; v: string; tone: 'brand' | 'plain' | 'faint' }) {
  const c = { brand: 'text-brand-deep', plain: 'text-body', faint: 'text-faint' }[tone]
  return (
    <div className="flex items-center gap-2">
      <dt className="w-8 shrink-0 text-[10px] uppercase tracking-wider text-faint">{k}</dt>
      <dd className={`truncate font-mono text-[11px] ${c}`}>{v}</dd>
    </div>
  )
}
