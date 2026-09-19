/**
 * API client. Mirrors the §7 v1 surface.
 *
 * Sprint A generates these types from OpenAPI via openapi-typescript; for a
 * 4-hour build they're hand-written, which is honest about what they are.
 */

const BASE = 'http://127.0.0.1:8000'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

// ------------------------------------------------------------------ types

export type Target = { id: string; name: string; pillar: string; endpoint: string; digest: string }

export type RunEvent = {
  event?: string
  node?: string
  message?: string
  phase?: string
  kind?: string
  technique?: string
  success?: boolean
  blocked?: string | null
  title?: string
  attempt_id?: string
  finding_id?: string
  run_id?: string
  titer?: Titer
  before?: { asr_seeded: number; asr_holdout: number }
}

export type Finding = {
  id: string; run_id?: string; attempt_id: string; technique: string
  severity: string; title: string; summary: string; status: string
}

export type Transcript = {
  attempt_id: string; request: string; response: string; verdict: boolean
  canary_leaked: boolean; judge_model: string; judge_rationale: string
  confidence: number; latency_ms: number
}

export type FindingDetail = Finding & { transcript: Transcript }

export type Control = {
  id: string; layer: 'L1' | 'L2' | 'L3'; kind: string; rationale: string
  patterns: string[]; system_prompt_addendum: string
  derived_from: { id: string; title: string; technique: string; severity: string }[]
}

export type Bundle = {
  id: string; version: number; hash: string; summary: string; status: string
  run_id: string | null; controls: Control[]
}

export type BundleSummary = {
  id: string; version: number; hash: string; summary: string; status: string
  run_id: string | null; controls: number; deployed_at: string | null
}

export type Titer = {
  asr_seeded: number; asr_holdout: number; fp_rate_benign: number
  latency_delta_ms: number; asr_seeded_before: number; asr_holdout_before: number
  converged: boolean
  criteria?: { max_asr_holdout: number; max_fp_rate: number; max_latency_delta_ms: number }
}

export type LoopSummary = {
  id: string; iteration: number; status: string; trigger: string
  started_at: string | null; findings: number
  titer: Titer | null
}

export type Attempt = {
  id: string; phase: string; kind: string; technique: string
  request: string; response: string; verdict: boolean; canary_leaked: boolean
  judge_model: string; judge_rationale: string; confidence: number
  latency_ms: number; blocked_by_layer: string | null; blocked_by_control: string | null
}

export type Dashboard = {
  kpis: {
    targets: number; loop_runs: number; open_findings: number
    asr_holdout: number | null; asr_holdout_before: number | null
    fp_rate: number | null; latency_delta_ms: number | null; converged: boolean | null
  }
  coverage: { pillar: string; targets: number; runs: number }[]
  recent_runs: { id: string; iteration: number; status: string; started_at: string | null; target: string }[]
  exposures: { id: string; title: string; severity: string; technique: string; status: string }[]
}

export type AssuranceRecord = {
  payload: Record<string, unknown>
  prev_hash: string; self_hash: string; signature: string
  public_key_id: string; verified: boolean
}

// ------------------------------------------------------------------ calls

export const api = {
  health: () => get<{ ok: boolean; cache_entries: number; replay_mode: boolean }>('/health'),
  targets: () => get<Target[]>('/api/v1/targets'),

  startRun: (target_id: string) =>
    post<{ run_key: string; iteration: number }>('/api/v1/red/runs', { target_id }),
  runEvents: (runKey: string, since: number) =>
    get<{ events: RunEvent[]; next: number; run_id: string | null; finished: boolean }>(
      `/api/v1/red/runs/${runKey}/events?since=${since}`,
    ),
  attempts: (runId: string, phase?: string) =>
    get<Attempt[]>(`/api/v1/red/runs/${runId}/attempts${phase ? `?phase=${phase}` : ''}`),

  findings: (runId?: string) => get<Finding[]>(`/api/v1/findings${runId ? `?run_id=${runId}` : ''}`),
  finding: (id: string) => get<FindingDetail>(`/api/v1/findings/${id}`),

  bundles: () => get<BundleSummary[]>('/api/v1/blue/bundles'),
  bundle: (id: string) => get<Bundle>(`/api/v1/blue/bundles/${id}`),
  rollback: (id: string) => post<{ id: string; status: string }>(`/api/v1/blue/bundles/${id}/rollback`),

  loops: () => get<LoopSummary[]>('/api/v1/purple/loops'),
  titer: (runId: string) => get<Titer>(`/api/v1/purple/loops/${runId}/titer`),
  record: (runId: string) => get<AssuranceRecord>(`/api/v1/purple/loops/${runId}/record`),

  dashboard: () => get<Dashboard>('/api/v1/dashboard/summary'),
}

export const pct = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`
