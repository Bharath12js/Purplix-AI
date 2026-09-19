import { useCallback, useEffect, useRef, useState } from 'react'
import { api, pct, type RunEvent, type Target, type Titer } from '../api'
import { Card, PageHead, SectionHead, Metric, Tag } from '../components/ui'

/**
 * Live run — the one page that is NOT reading fixtures.
 *
 * It POSTs a real loop to the API and tails the event stream the engine emits
 * (plan → expose → compile → deploy → challenge → titer → sign), rendering each
 * attempt and each metric as it lands. This is the honest counterpart to the
 * animated ring on Purple: no clock, no script — whatever the engine actually
 * did against the live target, in the order it happened.
 *
 * Requires the API (`uvicorn api.main:app --port 8000`) and, for the app
 * target, the demo app on :3000. If the API is unreachable it says so rather
 * than pretending.
 */

type Phase = 'idle' | 'running' | 'done' | 'error'

const NODE_LABEL: Record<string, string> = {
  plan: 'PLAN', expose: 'EXPOSE', compile: 'COMPILE', deploy: 'DEPLOY',
  challenge: 'CHALLENGE', titer: 'TITER', sign: 'SIGN', done: 'DONE',
  error: 'ERROR', finished: 'DONE',
}

function lineTone(e: RunEvent): string {
  if (e.node === 'error') return 'text-crimson'
  if (e.event === 'titer.update') return 'text-brand-deep'
  if (e.event === 'attempt.new') {
    if (e.phase === 'exposure') return e.success ? 'text-crimson' : 'text-faint'
    // challenge phase: a success here is a residual breach; blocked is good
    if (e.success) return 'text-warn'
    return e.blocked ? 'text-steel' : 'text-faint'
  }
  return 'text-body'
}

function lineText(e: RunEvent): string {
  if (e.event === 'attempt.new') {
    const verdict = e.success ? 'BREACH' : e.blocked ? `blocked@${e.blocked}` : 'held'
    return `${(e.phase || '').padEnd(9)} ${(e.technique || '').padEnd(20)} ${verdict}`
  }
  if (e.event === 'titer.update' && e.titer) {
    const t = e.titer
    return `unseen ASR ${pct(t.asr_holdout)} · seen ${pct(t.asr_seeded)} · fp ${pct(t.fp_rate_benign)} · ${t.converged ? 'CONVERGED' : 'not converged'}`
  }
  return e.message || ''
}

export function LiveRun() {
  const [targets, setTargets] = useState<Target[]>([])
  const [targetId, setTargetId] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [events, setEvents] = useState<RunEvent[]>([])
  const [titer, setTiter] = useState<Titer | null>(null)
  const [note, setNote] = useState('')

  const sinceRef = useRef(0)
  const stopRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)

  // Load the real target list from the API on mount.
  useEffect(() => {
    api.targets()
      .then((ts) => {
        setTargets(ts)
        setTargetId((cur) => cur || ts.find((t) => t.pillar === 'app')?.id || ts[0]?.id || '')
      })
      .catch(() => setNote('API not reachable at 127.0.0.1:8000 — start it: uvicorn api.main:app --port 8000'))
  }, [])

  // Auto-scroll the log to the newest line.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [events])

  const poll = useCallback(async (runKey: string) => {
    while (!stopRef.current) {
      let batch
      try {
        batch = await api.runEvents(runKey, sinceRef.current)
      } catch {
        setNote('lost connection to the API mid-run')
        setPhase('error')
        return
      }
      if (batch.events.length) {
        sinceRef.current = batch.next
        setEvents((prev) => [...prev, ...batch.events])
        const lastTiter = [...batch.events].reverse().find((e) => e.event === 'titer.update')
        if (lastTiter?.titer) setTiter(lastTiter.titer)
      }
      if (batch.finished) {
        const errored = batch.events.some((e) => e.node === 'error')
        setPhase(errored ? 'error' : 'done')
        return
      }
      await new Promise((r) => setTimeout(r, 600))
    }
  }, [])

  const start = useCallback(async () => {
    if (!targetId) return
    setEvents([]); setTiter(null); setNote(''); sinceRef.current = 0; stopRef.current = false
    setPhase('running')
    try {
      const { run_key } = await api.startRun(targetId)
      poll(run_key)
    } catch (e) {
      setNote(`could not start run: ${(e as Error).message}`)
      setPhase('error')
    }
  }, [targetId, poll])

  useEffect(() => () => { stopRef.current = true }, [])

  // Live counters derived from the stream.
  const attempts = events.filter((e) => e.event === 'attempt.new')
  const nAttempts = attempts.length
  const nFindings = attempts.filter((e) => e.finding_id).length
  const nBreach = attempts.filter((e) => e.phase === 'challenge' && e.success).length
  const nBlocked = attempts.filter((e) => e.blocked).length
  const lastNode = [...events].reverse().find((e) => e.node && NODE_LABEL[e.node])?.node || 'idle'
  const target = targets.find((t) => t.id === targetId)

  return (
    <>
      <PageHead
        title="Live run — watch an op execute"
        sub="This page is not reading fixtures. It launches a real loop on the API and tails the exact events the engine emits, in order. Numbers here are produced live against the target."
      />

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[12px] font-semibold text-muted">Target</label>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={phase === 'running'}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-ink
                       disabled:opacity-50"
          >
            {targets.length === 0 && <option value="">— no targets —</option>}
            {targets.map((t) => (
              <option key={t.id} value={t.id}>{t.name} · {t.pillar}</option>
            ))}
          </select>
          <button
            onClick={start}
            disabled={phase === 'running' || !targetId}
            className="rounded-xl bg-brand px-4 py-1.5 text-[13px] font-semibold text-white
                       transition-colors hover:bg-brand-deep disabled:opacity-40"
          >
            {phase === 'running' ? 'Running…' : 'Run live op'}
          </button>
          <StatusChip phase={phase} node={lastNode} />
          {target && (
            <span className="ml-auto font-mono text-[11px] text-faint">{target.endpoint}</span>
          )}
        </div>
        {note && <p className="mt-3 text-[12px] text-crimson">{note}</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
        {/* ------------------------------------------------------ live log */}
        <div>
          <SectionHead hint={`${nAttempts} attempts · append-only`}>Run stream</SectionHead>
          <Card className="p-0">
            <div ref={logRef} className="h-[520px] overflow-y-auto px-4 py-3 font-mono text-[11.5px] leading-relaxed">
              {events.length === 0 && (
                <div className="grid h-full place-items-center text-center text-faint">
                  {phase === 'running'
                    ? 'waiting for the first event…'
                    : 'Pick a target and press Run. Every attempt and every metric will stream here as the engine produces it.'}
                </div>
              )}
              {events.map((e, i) => (
                <div key={i} className="flex gap-2 py-[1px]">
                  <span className="w-[74px] shrink-0 text-faint">
                    {e.node && NODE_LABEL[e.node] ? NODE_LABEL[e.node] : (e.event === 'attempt.new' ? 'ATTEMPT' : e.event === 'titer.update' ? 'TITER' : '·')}
                  </span>
                  <span className={lineTone(e)}>{lineText(e)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------ live stats */}
        <div>
          <SectionHead hint="updated as the stream lands">Live stats</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Attempts" value={String(nAttempts)} />
            <Metric label="Findings" value={String(nFindings)} tone={nFindings ? 'bad' : 'ink'} />
            <Metric label="Blocked (challenge)" value={String(nBlocked)} tone="ok" />
            <Metric label="Residual breach" value={String(nBreach)} tone={nBreach ? 'bad' : 'ok'} />
          </div>

          <div className="mt-4">
            <SectionHead hint="the four-metric titer">Result</SectionHead>
            <Card className="p-4">
              {!titer ? (
                <p className="text-[12.5px] text-faint">
                  The titer is written as a unit at the end of the pass — it will appear here once the
                  challenge phase completes.
                </p>
              ) : (
                <div className="space-y-2.5 text-[12.5px]">
                  <Row k="Unseen ASR" v={`${pct(titer.asr_holdout_before)} → ${pct(titer.asr_holdout)}`} />
                  <Row k="Seen ASR" v={`${pct(titer.asr_seeded_before)} → ${pct(titer.asr_seeded)}`} />
                  <Row k="False positives" v={pct(titer.fp_rate_benign)} />
                  <Row k="Latency Δ p95" v={`${titer.latency_delta_ms >= 0 ? '+' : ''}${titer.latency_delta_ms} ms`} />
                  <div className="border-t border-hair pt-2.5">
                    <Tag tone={titer.converged ? 'brand' : 'crimson'}>
                      {titer.converged ? 'CONVERGED' : 'not converged'}
                    </Tag>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

function StatusChip({ phase, node }: { phase: Phase; node: string }) {
  const map: Record<Phase, { label: string; cls: string }> = {
    idle: { label: 'idle', cls: 'bg-hair text-muted' },
    running: { label: `running · ${NODE_LABEL[node] || node}`, cls: 'bg-brand-tint text-brand-deep' },
    done: { label: 'complete', cls: 'bg-surface text-ok' },
    error: { label: 'error', cls: 'bg-surface text-crimson' },
  }
  const s = map[phase]
  return <span className={`pill px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{k}</span>
      <span className="font-mono font-semibold text-ink">{v}</span>
    </div>
  )
}
