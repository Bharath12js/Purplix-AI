# Purplix AI — Master Design Plan

**One platform. Three engines. Three layers.**
Continuous Red → Blue → Purple teaming for models, agents and AI/agentic applications.

- **Version:** v1.0 · 2026-09-19
- **Owner:** sohan.k@sisainfosec.com
- **Scope of this doc:** product surface (pages, UX), system architecture, tech stack, data model, agent design, API contract, build phases.
- **Companion:** `Purplix-AI-Purple-Teaming-Pitch.pptx` (leadership narrative).

---

## 1. Product thesis

- **Unit of work is a loop iteration, not a scan.** Everything in the data model hangs off `loop_run`.
- **Three engines:** `Red` (offensive) → `Blue` (adaptive defence) → `Purple` (continuous assurance).
- **Three target layers (pillars):** `model`, `agent`, `app`. Every engine implements all three.
- **Hard rule — no count without a path.** Any number in the UI must be clickable down to the raw transcript that produced it.
- **Hard rule — held-out first.** Defence effectiveness is reported on attacks the compiler never saw, alongside false-positive rate on benign traffic.

---

## 2. Product surface (4 authenticated views)

> Naming in the deck is "engines"; naming in the code is `red` / `blue` / `purple` route groups.

### 2.1 Dashboard — `/`

- **Purpose:** estate-wide posture in one screen; entry point for drill-down.
- **Sections:** KPI strip → coverage matrix (3 pillars × posture) → trend charts → open exposures feed → recent loop runs.
- **Components:** `KpiTile`, `PostureMatrix`, `TrendChart`, `ExposureFeed`, `LoopRunTimeline`.
- **Charts:** posture over time (line), ASR before/after per target (grouped bar), coverage by pillar (stacked bar), exposure severity mix (donut).
- **Interaction:** every tile and chart segment is a link into a filtered `red` / `blue` / `purple` view.
- **Realtime:** subscribes to `loop.progress` over WebSocket; tiles animate as a run streams.

### 2.2 Red — `/red`

- **Purpose:** launch, watch and triage offensive runs.
- **Subroutes:** `/red/models`, `/red/agents`, `/red/apps`.
- **Shared components:** `TargetPicker`, `AttackPackSelector`, `RunStream` (virtualised log), `FindingTable`, `TranscriptDrawer`.
- **Per-pillar differences:**
  - `models` — attack pack × severity grid; prompt/response/judge triple per row.
  - `agents` — mission replay view; tool-call timeline with the hijack point marked.
  - `apps` — request/response pairs, auth context, retrieved chunks shown inline for RAG poisoning.
- **Key rule:** `FindingTable` rows always open `TranscriptDrawer` — never a summary modal.

### 2.3 Blue — `/blue`

- **Purpose:** compile, review, deploy and roll back defences. Adaptive: consumes live Red output.
- **Subroutes:** `/blue/models`, `/blue/agents`, `/blue/apps`.
- **Components:** `SignalInbox` (live findings from Red), `PolicyCompiler`, `PolicyDiff`, `ControlCard`, `DeploymentPanel`, `RollbackButton`.
- **`ControlCard` contract:** every control renders `derived_from: [finding_id...]` as chips; clicking a chip opens that finding's transcript.
- **Deployment:** controls are compiled to a versioned `policy_bundle`, deployed as an inline wrapper/proxy. Reversible, diffable, never a fine-tune.
- **Layers of a policy bundle:** `L1` input detection · `L2` output/leak gating · `L3` system-prompt & tool-scope hardening.

### 2.4 Purple — `/purple`

- **Purpose:** continuous testing and assurance; the loop controller.
- **Subroutes:** `/purple/models`, `/purple/agents`, `/purple/apps`.
- **Components:** `LoopController` (start/pause/schedule), `IterationTable`, `TiterPanel` (4 tiles, always together), `ConvergenceChart`, `EvidenceExport`.
- **Titer tiles (never shown apart):** `ASR seeded` · `ASR held-out` · `FP rate (benign)` · `added latency`.
- **Exit criteria (configurable per target):** held-out ASR ≤ X% **and** FP ≤ Y% **and** p95 latency delta ≤ Z ms, sustained for N consecutive iterations.
- **Output:** signed `assurance_record` (JSON) per iteration — target digest, policy hash, attack-pack hash, results, timestamps.

### 2.5 Cross-cutting UX rules

- Colour is semantic and reserved: `red` = offensive, `blue` = defensive, `purple` = assurance/platform. Pillars use purple tints only.
- Long-running work never blocks the UI — everything streams into an append-only run log.
- Every destructive action (deploy, rollback, delete target) requires typed confirmation and writes to `audit_log`.
- Empty states always offer the next action ("Run first exposure").

---

## 3. System architecture

```
                            ┌───────────────────────────────────────┐
  React SPA  ──REST/WS──►   │  API Gateway (FastAPI)                │
  (Vite, TS)                │  auth · RBAC · rate limit · audit     │
                            └──────────────┬────────────────────────┘
                                           │
                  ┌────────────────────────┼────────────────────────┐
                  ▼                        ▼                        ▼
         ┌────────────────┐       ┌────────────────┐       ┌────────────────┐
         │  RED SERVICE   │       │  BLUE SERVICE  │       │ PURPLE SERVICE │
         │ attack orch.   │──────►│ policy compiler│──────►│ loop controller│
         │ + judge        │ findings + deploy mgr  │ titer │ + scheduler    │
         └───────┬────────┘       └───────┬────────┘       └───────┬────────┘
                 │                        │                        │
                 └──────────┬─────────────┴────────────────────────┘
                            ▼
                 ┌─────────────────────────┐      ┌────────────────────────┐
                 │ Agent Runtime (LangGraph)│      │ Enforcement Wrapper    │
                 │ attacker · judge ·       │      │ (inline proxy, ASGI)   │
                 │ compiler · triage agents │      │ L1/L2/L3 policy bundle │
                 └────────────┬─────────────┘      └───────────┬────────────┘
                              ▼                                ▼
            ┌──────────────────────────────┐      ┌────────────────────────┐
            │ LLM Router                   │      │ TARGETS UNDER TEST     │
            │ Groq (fast/bulk) · Gemini    │      │ models · agents · apps │
            │ (deep/multimodal) · local    │      └────────────────────────┘
            └──────────────────────────────┘

  Data plane: Postgres (state) · Redis (queue + pub/sub) · S3/MinIO (transcripts, bundles) · OTel → Grafana
```

### Services

| Service | Responsibility | Scaling shape |
|---|---|---|
| `gateway` | Auth, RBAC, REST + WebSocket fan-out, audit | Stateless, HPA |
| `red-service` | Attack pack execution, judging, finding extraction | Worker pool, burst |
| `blue-service` | Policy compilation, bundle versioning, deploy/rollback | Low volume, high correctness |
| `purple-service` | Loop scheduling, titer computation, convergence, signing | Cron + queue |
| `agent-runtime` | LangGraph graphs for all LLM-driven agents | Worker pool, burst |
| `wrapper` | Inline enforcement proxy in front of a target | Sidecar, latency-critical |

---

## 4. Tech stack

### 4.1 Backend — Python

- `python` **3.12**
- `fastapi` + `uvicorn` — REST and WebSocket.
- `pydantic` v2 — every LLM output is parsed into a model; no free-text parsing anywhere.
- `sqlalchemy` 2.x + `alembic` — ORM and migrations.
- `celery` + `redis` — async job execution (attack runs, compilations, scheduled loops). `arq` is an acceptable lighter substitute.
- `httpx` (async) — all outbound LLM and target calls, with per-provider timeouts and retry/backoff.
- `langgraph` + `langchain-core` — agent graphs, state machines, checkpointing.
- `tenacity` — retries. `structlog` — structured JSON logging. `opentelemetry-sdk` — traces.
- `pytest`, `pytest-asyncio`, `ruff`, `mypy --strict` on `core/` and `schemas/`.

### 4.2 Frontend — React

- `react` 18 + `typescript` + `vite`.
- `tailwindcss` + `shadcn/ui` (Radix) — component base; theme tokens defined once (see §4.5).
- `@tanstack/react-query` — server state, polling, optimistic updates.
- `zustand` — local UI state (filters, drawer stack).
- `react-router` v6 — the four route groups.
- `recharts` — all charts (light footprint, composable).
- `@tanstack/react-virtual` — run-log and finding-table virtualisation (runs produce thousands of rows).
- `native WebSocket` + a thin `useRunStream()` hook — no socket.io.
- `zod` — mirror of backend pydantic schemas; generate from OpenAPI via `openapi-typescript`.

### 4.3 LLM providers

| Use | Provider / model | Why |
|---|---|---|
| Attack generation, mutation, bulk variants | **Groq** — `llama-3.3-70b-versatile` | Throughput and latency; attack batteries are high-volume |
| Fast judging (pass 1) | **Groq** — `llama-3.1-8b-instant` | Cheap first-pass verdict |
| Deep judging / disputed verdicts (pass 2) | **Gemini** — `gemini-2.5-pro` | Stronger reasoning, long context for full transcripts |
| Policy compilation from findings | **Gemini** — `gemini-2.5-pro` | Structured, high-stakes generation |
| App/agent multimodal evidence (screens, docs) | **Gemini** — `gemini-2.5-flash` | Native multimodal |
| Local/offline demo mode | `ollama` — pinned model | Deterministic, no network, `temperature=0` |

- **Router contract:** `core/llm/router.py` exposes `complete(task: TaskKind, messages, schema) -> ParsedModel`. Callers never name a provider.
- **Determinism:** `temperature=0`, fixed seeds, response cached on `(provider, model, prompt_hash, seed)` in Redis + S3.
- **Cost/limit guards:** per-run token budget, per-tenant daily cap, circuit breaker on provider 429s with automatic Groq↔Gemini failover.
- **Two-pass judging** is a cost control: 8B first, escalate to Gemini only on low confidence or disagreement.

### 4.4 Data & infra

- `postgresql` 16 — primary store. `pgvector` for attack-corpus similarity (held-out split, dedupe).
- `redis` 7 — Celery broker, WebSocket pub/sub, LLM response cache.
- `minio` / `s3` — transcripts, policy bundles, signed assurance records.
- `docker compose` for dev; `helm` + `kubernetes` for deploy.
- `opentelemetry` → `tempo`/`grafana`; `prometheus` metrics on every engine.
- Signing: `cryptography` Ed25519; public key published for record verification.

### 4.5 Design tokens (shared by PPT and UI)

```ts
// tailwind.config.ts — theme.extend.colors
export const tokens = {
  purple:  { DEFAULT: '#A624FF', deep: '#6E14C0', tint: '#F8F2FF', line: '#E8D9FC' },
  red:     { DEFAULT: '#E11D48', tint: '#FFF2F5', line: '#FAD3DE' },
  blue:    { DEFAULT: '#2563EB', tint: '#F0F5FF', line: '#D3E1FD' },
  ink:     '#1A1033',
  body:    '#544D6B',
  muted:   '#8E87A3',
  card:    '#FCFAFF',
  border:  '#EBE5F5',
}
// Base: white surfaces, purple as the only brand accent.
// Red/blue are SEMANTIC ONLY (offence/defence) — never decorative.
```

- Type: `Inter` (web) / `Segoe UI` (deck). Weights 400 / 600 / 700.
- Radius `12px` cards, `999px` pills. Borders 1px, no drop shadows.
- Dark mode: invert surfaces to `#120B22`, keep the same accents; charts must pass 4.5:1 in both themes.

---

## 5. Data model (core tables)

```sql
tenant(id, name, plan)
user(id, tenant_id, email, role)                        -- role: owner|operator|auditor|viewer

target(id, tenant_id, pillar, name, endpoint, auth_ref, digest, metadata)
                                                        -- pillar: model|agent|app

attack_pack(id, pillar, name, version, hash, source)    -- curated + generated
attack_case(id, pack_id, technique, severity, payload, is_holdout)
benign_case(id, pack_id, payload, expected_behaviour)

loop_run(id, target_id, iteration, status, started_at, ended_at, trigger)
                                                        -- trigger: manual|schedule|ci|drift

attempt(id, loop_run_id, attack_case_id, phase, request, response,
        tool_trace, latency_ms, verdict, judge_model, judge_rationale, confidence)
                                                        -- phase: exposure|challenge

finding(id, loop_run_id, attempt_id, technique, severity, title, summary, status)
                                                        -- status: open|compiled|mitigated|accepted

policy_bundle(id, target_id, version, hash, layers_json, status, deployed_at, rolled_back_at)
control(id, bundle_id, layer, kind, rule_json, rationale)
control_finding(control_id, finding_id)                 -- the "derived_from" link. NOT NULLABLE.

titer(id, loop_run_id, asr_seeded, asr_holdout, fp_rate_benign,
      latency_delta_ms, converged)

assurance_record(id, loop_run_id, payload_json, signature, signed_at, public_key_id)
audit_log(id, tenant_id, actor_id, action, entity, before, after, at)
```

- **Invariant 1:** no `control` may exist without ≥1 row in `control_finding`. Enforced by DB constraint + service check.
- **Invariant 2:** `titer` rows are written as a unit — all four metrics or none.
- **Invariant 3:** `attack_case.is_holdout` is assigned by **technique**, not random prompt split (random leaks near-duplicates and inflates the held-out score).
- **Retention:** transcripts in S3 with lifecycle policy; PII scrubbing pass before write.

---

## 6. Agent design (LangGraph)

| Agent | Model | Input | Output schema | Notes |
|---|---|---|---|---|
| `AttackPlanner` | Groq 70B | target profile, pillar, pack | `AttackPlan` | Chooses techniques and severity ladder |
| `AttackMutator` | Groq 70B | seed case, feedback | `list[AttackCase]` | Generates variants; dedupe via `pgvector` |
| `AgentMissionRunner` | Groq 70B | agent target, mission | `ToolTrace` | Drives multi-turn agent attacks, records tool calls |
| `Judge-Fast` | Groq 8B | attempt | `Verdict{success, confidence}` | Pass 1; escalates below threshold |
| `Judge-Deep` | Gemini 2.5 Pro | attempt + rubric | `Verdict{success, rationale, rubric_id}` | Pass 2, authoritative |
| `PolicyCompiler` | Gemini 2.5 Pro | findings cluster | `PolicyBundle{L1,L2,L3}` | Must emit `derived_from` per control |
| `FPReviewer` | Groq 70B | benign failures | `ControlPatch` | Narrows over-broad rules |
| `TriageSummariser` | Gemini 2.5 Flash | findings | `ExecSummary` | Powers the dashboard narrative |

**Graph shape (one iteration):**

```
plan → [mutate → execute → judge]×N → cluster_findings → compile_policy
     → deploy_wrapper → challenge(seeded + holdout + benign)
     → compute_titer → { converged? → sign_record : feedback → plan }
```

- Checkpoint after every node (`langgraph` sqlite/postgres saver) so a run resumes, never restarts.
- Every node emits an OTel span and a `loop.progress` event to Redis pub/sub → WebSocket.
- Guardrail on the platform itself: agent prompts are templated and versioned in `prompts/`, never string-concatenated from user input.

---

## 7. API surface (v1)

```
POST   /api/v1/targets                      register a model | agent | app
GET    /api/v1/targets?pillar=agent

POST   /api/v1/red/runs                     {target_id, pack_id, severity_max}
GET    /api/v1/red/runs/{id}
GET    /api/v1/red/runs/{id}/attempts       paginated, filterable by verdict
GET    /api/v1/findings/{id}                includes full transcript ref

POST   /api/v1/blue/compile                 {finding_ids[]} -> policy_bundle (draft)
POST   /api/v1/blue/bundles/{id}/deploy
POST   /api/v1/blue/bundles/{id}/rollback
GET    /api/v1/blue/bundles/{id}/diff?against=

POST   /api/v1/purple/loops                 {target_id, exit_criteria, schedule?}
GET    /api/v1/purple/loops/{id}/iterations
GET    /api/v1/purple/loops/{id}/titer
GET    /api/v1/purple/loops/{id}/record     signed assurance record (JSON)

GET    /api/v1/dashboard/summary            KPI strip + coverage matrix
WS     /api/v1/stream?run_id=               loop.progress | attempt.new | titer.update
```

- Auth: OIDC (`authlib`) + short-lived JWT; API keys for CI integration.
- RBAC: `owner` (all) · `operator` (run + deploy) · `auditor` (read + export records) · `viewer` (read).
- Every mutating endpoint writes `audit_log` in the same transaction.

---

## 8. Repository layout

```
purplix/
├── apps/
│   ├── api/                 # FastAPI gateway
│   ├── web/                 # React + Vite SPA
│   └── wrapper/             # inline enforcement proxy (ASGI)
├── services/
│   ├── red/                 # attack orchestration + judging
│   ├── blue/                # compiler + deployment manager
│   └── purple/              # loop controller + scheduler + signer
├── packages/
│   ├── core/                # domain models, invariants, shared utils
│   ├── llm/                 # provider router, caching, budgets
│   ├── agents/              # LangGraph graphs + versioned prompts
│   └── packs/               # attack + benign corpora (yaml), per pillar
├── db/                      # alembic migrations, seeds
├── infra/                   # docker-compose, helm, terraform
└── docs/                    # this plan, ADRs, runbooks
```

---

## 9. Build phases

### Phase 0 — walking skeleton (weeks 1–2)

- Monorepo, docker-compose (`postgres`, `redis`, `minio`), FastAPI + React shell with the four routes.
- `llm/router.py` with Groq + Gemini adapters, caching, budget guard.
- One pillar end-to-end: **model** red run → findings → transcript drawer.

### Phase 1 — close the loop (weeks 3–5)

- `PolicyCompiler` + `policy_bundle` + wrapper deployment for models.
- Challenge phase with held-out split and benign corpus; `TiterPanel` live.
- Signed `assurance_record` export.
- **Exit test:** a novel jailbreak typed by a stranger is blocked, FP rate stays in budget, and the record verifies.

### Phase 2 — three pillars (weeks 6–9)

- Agent red teaming (`AgentMissionRunner`, tool-trace UI) + agent defences (tool scoping, approval gates).
- App pen testing (RAG poisoning, tenancy, auth) + app defences (context isolation, output gating).
- Dashboard coverage matrix across all three.

### Phase 3 — continuous (weeks 10–12)

- Scheduler, CI webhook trigger, drift detection, convergence chart.
- Multi-tenancy, RBAC, audit export, framework mapping (EU AI Act / NIST AI RMF / ISO 42001).
- Grafana dashboards, SLOs, cost reporting per tenant.

---

## 10. Risks and the guard for each

| # | Risk | Guard |
|---|---|---|
| R1 | Defence memorises seeded attacks | Hold out **by technique**; report held-out ASR as the headline metric |
| R2 | Over-blocking collapses usability | Benign corpus + FP rate shown beside every titer; `FPReviewer` narrows rules |
| R3 | Judge errors propagate into controls | Two-pass judging, confidence threshold, human spot-check queue on low-confidence verdicts |
| R4 | LLM cost blowout on large estates | Response cache, 8B first pass, per-run token budget, circuit breaker |
| R5 | Provider outage mid-run | Router failover Groq↔Gemini; LangGraph checkpoints let a run resume |
| R6 | Wrapper adds unacceptable latency | p95 latency delta is an exit criterion, not a footnote; single detector pass per request |
| R7 | Platform becomes an attack tool | Tenant-scoped targets require proof of ownership; full `audit_log`; destructive actions gated |
| R8 | Adaptive attackers read the deployed policy | Loop (not the policy) is the product — continuous re-immunisation on schedule and on drift |

---

## 11. Open decisions

- **Wrapper placement:** sidecar proxy vs SDK middleware vs both. Leaning sidecar for model/app, SDK for agents (needs tool-call interception).
- **Attack corpus sourcing:** curated in-house vs importing public benchmarks (licensing review needed before shipping packs).
- **Record signing trust:** self-signed Ed25519 for v1; evaluate a transparency log for v2.
- **Groq model pinning:** provider deprecates model IDs on a short cycle — pin plus an automated availability check in CI.
