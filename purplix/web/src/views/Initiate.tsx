import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  EXIT_CRITERIA, SEAMS, TARGETS, adaptersFor, pct, relTime, type Pillar,
} from '../data/fixtures'
import {
  Card, PageHead, SectionHead, StatePill, StatusPill, Tag,
} from '../components/ui'

/* ============================================================== the form */

/**
 * Initiate a loop.
 *
 * Three pillars, three genuinely different launch forms. The temptation is one
 * generic form with a pillar dropdown, but a model run and an agent run do not
 * take the same inputs — a model needs a judge rubric and a holdout split, an
 * agent needs a mission set and a sandbox tier, an app needs a surface depth
 * and an auth context. Collapsing them into shared fields would mean either
 * asking every operator for things their pillar ignores, or quietly defaulting
 * decisions that change what the run measures.
 *
 * Every field here is an input that ends up hashed into the assurance record.
 * That is the test for whether something belongs on this page: if changing it
 * would invalidate cross-pass comparison, the operator has to see it before
 * the run, not discover it afterwards in the evidence.
 */

type Option = { value: string; label: string; note?: string }

/** Depth of the application surface under test — the "application level". */
const APP_LEVELS: Option[] = [
  { value: 'api', label: 'API surface only', note: 'endpoints + auth, no UI' },
  { value: 'retrieval', label: 'Retrieval layer', note: 'adds RAG corpus + chunk provenance' },
  { value: 'journey', label: 'Full user journey', note: 'adds session, tenancy, multi-step state' },
  { value: 'chained', label: 'Chained AI + classic', note: 'adds SSRF, IDOR, injection composition' },
]

const ENVIRONMENTS: Option[] = [
  { value: 'preprod', label: 'Pre-prod replica', note: 'prod-shaped data · safe for destructive probes' },
  { value: 'staging', label: 'Staging', note: 'synthetic data · lowest fidelity' },
  { value: 'prod-ro', label: 'Production (read-only)', note: 'real traffic · destructive probes disabled' },
]

const AUTH_CONTEXTS: Option[] = [
  { value: 'anon', label: 'Unauthenticated' },
  { value: 'tenant-a', label: 'Authenticated · tenant A' },
  { value: 'cross', label: 'Cross-tenant (A probing B)', note: 'required to test tenancy boundaries' },
  { value: 'privileged', label: 'Privileged / support role' },
]

const MISSIONS: Option[] = [
  { value: 'kyc-verify', label: 'KYC verification mission', note: '6 tools · 12-step ceiling' },
  { value: 'doc-triage', label: 'Document triage mission', note: '4 tools · read-only' },
  { value: 'full-autonomy', label: 'Full autonomy sweep', note: 'every declared tool · 40-step ceiling' },
]

const SANDBOX_TIERS: Option[] = [
  { value: 'none', label: 'As declared in manifest', note: 'uses whatever the target ships' },
  { value: 'microvm', label: 'Force remote microVM', note: 'no host backend reachable' },
  { value: 'container', label: 'Force container', note: 'caps dropped · RO rootfs' },
]

const JUDGES: Option[] = [
  { value: 'canary', label: 'Canary oracle + two-pass LLM', note: 'ground truth where a canary exists' },
  { value: 'boundary-v7', label: 'app/boundary-v7 rubric', note: 'boundary-crossing, not wrong text' },
  { value: 'action-trace', label: 'Action-trace oracle', note: 'agent pillar — scores the call, not the reply' },
]

const HOLDOUTS: Option[] = [
  { value: '21', label: '21% · technique-disjoint', note: 'default · rotates every pass' },
  { value: '30', label: '30% · technique-disjoint', note: 'slower convergence, stronger claim' },
  { value: '15', label: '15% · technique-disjoint', note: 'faster, thinner evidence' },
]

const TRIGGERS: Option[] = [
  { value: 'manual', label: 'Run once now' },
  { value: 'schedule', label: 'Run now, then weekly' },
  { value: 'ci', label: 'Run now, then on every CI build', note: 'returns a release verdict' },
  { value: 'drift', label: 'Run now, then on digest change' },
]

/* ============================================================ the pillars */

type PillarSpec = {
  key: Pillar
  title: string
  role: string
  blurb: string
  /** What "success" means here — the rubric difference that matters most. */
  successIs: string
  accent: 'crimson' | 'steel' | 'brand'
}

const PILLARS: PillarSpec[] = [
  {
    key: 'model', title: 'Model', role: 'Initiate a model loop',
    blurb: 'Jailbreak and injection batteries, data-extraction probes, refusal-bypass suites against the prompt and its context.',
    successIs: 'The model produced content its policy forbids, or leaked context it should not have.',
    accent: 'crimson',
  },
  {
    key: 'agent', title: 'Agent', role: 'Initiate an agent loop',
    blurb: 'Tool abuse, privilege escalation, goal hijack and memory poisoning across multi-step missions.',
    successIs: 'The agent took an ACTION it should not have. Wrong text is not the failure — the tool call is.',
    accent: 'brand',
  },
  {
    key: 'app', title: 'Application', role: 'Initiate an app loop',
    blurb: 'RAG poisoning, tenancy and auth boundaries, chained AI plus classic exploits over full user journeys.',
    successIs: 'A boundary was crossed — another tenant’s data, an unauthorised record, poisoned retrieval reaching a user.',
    accent: 'steel',
  },
]

const ACCENT = {
  crimson: { ring: 'border-crimson-line', bg: 'bg-crimson-tint', text: 'text-crimson', dot: 'bg-crimson' },
  steel: { ring: 'border-steel-line', bg: 'bg-steel-tint', text: 'text-steel', dot: 'bg-steel' },
  brand: { ring: 'border-brand-line', bg: 'bg-brand-tint', text: 'text-brand-deep', dot: 'bg-brand' },
} as const

/* ================================================================= view */

export function Initiate() {
  const nav = useNavigate()
  const [pillar, setPillar] = useState<Pillar>('model')

  const spec = PILLARS.find((p) => p.key === pillar)!
  const accent = ACCENT[spec.accent]
  const targets = useMemo(() => TARGETS.filter((t) => t.pillar === pillar), [pillar])

  const [targetId, setTargetId] = useState(targets[0]?.id ?? '')
  const target = TARGETS.find((t) => t.id === targetId) ?? targets[0]

  // Per-pillar config. Kept in one object so the summary panel can read it
  // without every field needing to exist on every pillar.
  const [env, setEnv] = useState('preprod')
  const [appLevel, setAppLevel] = useState('retrieval')
  const [auth, setAuth] = useState('cross')
  const [mission, setMission] = useState('kyc-verify')
  const [sandbox, setSandbox] = useState('microvm')
  const [judge, setJudge] = useState('canary')
  const [holdout, setHoldout] = useState('21')
  const [trigger, setTrigger] = useState('manual')
  const [destructive, setDestructive] = useState(false)

  // Switching pillar re-points the target; leaving a model target selected
  // under an agent form is the kind of thing that silently runs the wrong pack.
  const choosePillar = (p: Pillar) => {
    setPillar(p)
    const first = TARGETS.find((t) => t.pillar === p)
    setTargetId(first?.id ?? '')
    setJudge(p === 'agent' ? 'action-trace' : p === 'app' ? 'boundary-v7' : 'canary')
  }

  const adapters = adaptersFor(pillar)
  const seams = target ? SEAMS.filter((s) => s.targetId === target.id) : []
  const unpinned = target && !target.pinned

  return (
    <>
      <PageHead
        title="Initiate a loop"
        sub="One pass is attack → capture → defend → challenge → prove. Everything on this page is hashed into the assurance record, because a number you cannot tie back to its inputs is not evidence."
      />

      {/* Pillar choice — three real forms, not one form with a dropdown. */}
      <SectionHead hint="pick what is under test">Pillar</SectionHead>
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {PILLARS.map((p) => {
          const on = p.key === pillar
          const a = ACCENT[p.accent]
          const count = TARGETS.filter((t) => t.pillar === p.key).length
          return (
            <button
              key={p.key}
              onClick={() => choosePillar(p.key)}
              className={`card flex flex-col gap-2 p-4 text-left transition-all ${
                on ? `${a.ring} ${a.bg} shadow-sm` : 'hover:border-border hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-pill ${on ? a.dot : 'bg-border'}`} />
                <span className={`font-brand text-[15px] font-bold ${on ? a.text : 'text-ink'}`}>
                  {p.title}
                </span>
                <span className="ml-auto text-[11px] text-faint">{count} targets</span>
              </div>
              <p className="text-[12px] leading-relaxed text-body">{p.blurb}</p>
              <div className="mt-auto border-t border-hair pt-2">
                <div className="label mb-1">Success is</div>
                <p className="text-[11.5px] leading-snug text-body">{p.successIs}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        {/* ------------------------------------------------------ the form */}
        <div className="space-y-5">
          <div>
            <SectionHead hint={`${spec.role.toLowerCase()}`}>Target and scope</SectionHead>
            <Card className="grid gap-4 p-4 sm:grid-cols-2">
              <Select
                label="Target"
                value={targetId}
                onChange={setTargetId}
                options={targets.map((t) => ({
                  value: t.id,
                  label: t.name,
                  note: `${t.vendor} · ${t.env}`,
                }))}
              />
              <Select
                label="Environment"
                value={env}
                onChange={setEnv}
                options={ENVIRONMENTS}
                help="Recorded on the assurance record as measurement fidelity."
              />

              {/* The application-level dropdown, per your note. */}
              {pillar === 'app' && (
                <>
                  <Select
                    label="Application level"
                    value={appLevel}
                    onChange={setAppLevel}
                    options={APP_LEVELS}
                    help="How deep the surface goes. Each level adds attack classes, not just volume."
                  />
                  <Select
                    label="Auth context"
                    value={auth}
                    onChange={setAuth}
                    options={AUTH_CONTEXTS}
                    help="Tenancy findings are unreachable without a cross-tenant context."
                  />
                </>
              )}

              {pillar === 'agent' && (
                <>
                  <Select label="Mission set" value={mission} onChange={setMission} options={MISSIONS} />
                  <Select
                    label="Sandbox tier"
                    value={sandbox}
                    onChange={setSandbox}
                    options={SANDBOX_TIERS}
                    help="Forcing a tier measures the agent, not its deployment accident."
                  />
                </>
              )}

              {pillar === 'model' && (
                <Select
                  label="Attack pack"
                  value="core"
                  onChange={() => {}}
                  options={[{ value: 'core', label: 'purplix-model-core v1.0', note: '12 seen · 6 unseen · 8 benign' }]}
                />
              )}

              <Select
                label="Judge rubric"
                value={judge}
                onChange={setJudge}
                options={JUDGES}
                help="Pinned and hashed. Changing it mid-campaign invalidates cross-pass comparison."
              />
              <Select
                label="Holdout split"
                value={holdout}
                onChange={setHoldout}
                options={HOLDOUTS}
                help="Split by technique, never by prompt — a random split leaks near-duplicates."
              />
            </Card>
          </div>

          <div>
            <SectionHead hint="when it runs again">Trigger and safety</SectionHead>
            <Card className="grid gap-4 p-4 sm:grid-cols-2">
              <Select label="Trigger" value={trigger} onChange={setTrigger} options={TRIGGERS} />
              <div>
                <div className="label mb-1.5">Destructive probes</div>
                <button
                  onClick={() => setDestructive((d) => !d)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                    destructive
                      ? 'border-crimson-line bg-crimson-tint text-crimson'
                      : 'border-border bg-card text-ink hover:bg-surface'
                  }`}
                >
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-[4px] border ${
                    destructive ? 'border-crimson bg-crimson' : 'border-border bg-card'
                  }`} />
                  {destructive ? 'Enabled for this run' : 'Disabled (default)'}
                </button>
                <p className="mt-1.5 text-[11px] leading-snug text-body">
                  Off by default and refused outright on a production environment. Delete, write and
                  spend actions stay simulated unless this is on.
                </p>
              </div>
            </Card>
          </div>

          {/* Honest pre-flight. Both of these change what the run can claim. */}
          {(unpinned || seams.length > 0) && (
            <div className="space-y-2.5">
              {unpinned && (
                <Card className="flex items-start gap-3 border-warn/20 bg-warn-tint px-4 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-warn" />
                  <div>
                    <div className="text-[12.5px] font-semibold text-ink">Target is unpinned</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-body">
                      {target?.pinNote} Results will carry this limitation on the record. Without a
                      digest you cannot tell a defence improvement from a model update.
                    </p>
                  </div>
                </Card>
              )}
              {seams.map((s) => (
                <Card key={s.id} className="flex items-start gap-3 border-warn/20 bg-warn-tint px-4 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-pill bg-warn" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">Missing seam</span>
                      <Tag tone="crimson">{s.reason}</Tag>
                      <span className="font-mono text-[11px] text-muted">{s.name}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-body">
                      This run will measure {s.closes.length} finding
                      {s.closes.length === 1 ? '' : 's'} it cannot close, and will report
                      them as advisory rather than as a compiler failure.
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------- what will run */}
        <div className="space-y-5 lg:sticky lg:top-6">
          <div>
            <SectionHead hint="read this before you launch">What this will run</SectionHead>
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={`pill ${accent.bg} ${accent.text} border ${accent.ring}`}>
                  {spec.title}
                </span>
                {target && <StatePill state={target.state} />}
                {target && <Tag tone="steel">{target.tier}</Tag>}
              </div>

              <div className="card divide-y divide-hair px-3 py-1">
                <Row k="Target" v={target?.name ?? '—'} />
                <Row k="Digest" v={target?.digest ?? '—'} mono />
                <Row k="Threat model" v={target?.threatModelRef ?? '—'} mono />
                <Row k="Engagement" v={target?.engagementRef ?? '—'} mono />
                <Row k="Environment" v={labelOf(ENVIRONMENTS, env)} />
                {pillar === 'app' && <Row k="Application level" v={labelOf(APP_LEVELS, appLevel)} />}
                {pillar === 'app' && <Row k="Auth context" v={labelOf(AUTH_CONTEXTS, auth)} />}
                {pillar === 'agent' && <Row k="Mission" v={labelOf(MISSIONS, mission)} />}
                {pillar === 'agent' && <Row k="Sandbox" v={labelOf(SANDBOX_TIERS, sandbox)} />}
                <Row k="Judge" v={labelOf(JUDGES, judge)} />
                <Row k="Holdout" v={labelOf(HOLDOUTS, holdout)} />
                <Row k="Trigger" v={labelOf(TRIGGERS, trigger)} />
              </div>

              <div className="mt-3">
                <div className="label mb-1.5">Adapters in this pass</div>
                <div className="flex flex-wrap gap-1.5">
                  {adapters.map((a) => <Tag key={a.tool} tone="crimson">{a.tool}</Tag>)}
                </div>
              </div>

              <div className="mt-3 border-t border-hair pt-3">
                <div className="label mb-1.5">Exit criteria</div>
                <ul className="space-y-1 text-[11.5px] leading-snug text-body">
                  <li>Unseen ASR ≤ {pct(EXIT_CRITERIA.maxAsrUnseen)} — on the <em>enforceable</em> half</li>
                  <li>Confirmed FP ≤ {pct(EXIT_CRITERIA.maxFpRate)} — production canary, not the synthetic corpus</li>
                  <li>Latency p95 ≤ {EXIT_CRITERIA.maxLatencyDeltaMs} ms</li>
                  <li>Sustained {EXIT_CRITERIA.sustainedPasses} passes on a rotated holdout</li>
                  <li>Budget {EXIT_CRITERIA.maxPasses} passes, then reported honestly as exhausted</li>
                </ul>
              </div>

              <button
                onClick={() => nav('/purple')}
                disabled={!target}
                className="btn-primary mt-4 w-full"
              >
                Launch pass 1
              </button>
              <p className="mt-2 text-[11px] leading-snug text-faint">
                No approval gate. Blue compiles and deploys without sign-off; rollback is the safety
                mechanism, and every bundle version reverts exactly.
              </p>
            </Card>
          </div>

          <div>
            <SectionHead hint="last run per target">This pillar</SectionHead>
            <Card className="divide-y divide-hair">
              {targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTargetId(t.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    t.id === targetId ? 'bg-brand-tint/60' : 'hover:bg-surface'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink">{t.name}</div>
                    <div className="text-[11px] text-faint">
                      {t.passes > 0 ? `${t.passes} passes · ${relTime(t.lastRunAt)}` : 'never run'}
                    </div>
                  </div>
                  <StatusPill status={t.posture} />
                </button>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

/* ============================================================== pieces */

const labelOf = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label ?? v

function Select({ label, value, onChange, options, help }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  help?: string
}) {
  const note = options.find((o) => o.value === value)?.note
  return (
    <label className="block">
      <div className="label mb-1.5">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-ink
                   outline-none transition-colors focus:border-brand-line focus:ring-2 focus:ring-brand-tint"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {note && <div className="mt-1 text-[11px] text-muted">{note}</div>}
      {help && <p className="mt-1 text-[11px] leading-snug text-body">{help}</p>}
    </label>
  )
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[11.5px] text-muted">{k}</span>
      <span className={`min-w-0 truncate text-right text-[11.5px] text-ink ${mono ? 'font-mono text-[11px]' : ''}`}>
        {v}
      </span>
    </div>
  )
}
