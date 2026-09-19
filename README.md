<div align="center">

# 🛡️ Purplix AI

### **One platform. Three engines. One closed loop.**

**Continuous Red → Blue → Purple teaming for LLMs, AI agents and AI-powered applications.**

*Attack it. Compile a defence from the evidence. Prove the defence works on attacks it has never seen. Sign the result.*

<br/>

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[![Tests](https://img.shields.io/badge/tests-44%20passing-2ea44f?style=flat-square&logo=pytest&logoColor=white)](#-testing)
[![Pydantic](https://img.shields.io/badge/pydantic-v2-E92063?style=flat-square&logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.x-D71F00?style=flat-square)](https://www.sqlalchemy.org/)
[![OpenRouter](https://img.shields.io/badge/LLM-OpenRouter%20pool-8A2BE2?style=flat-square)](https://openrouter.ai/)
[![Ed25519](https://img.shields.io/badge/signing-Ed25519%20%2B%20hash%20chain-1A1033?style=flat-square)](#-signed-assurance-records)
[![Status](https://img.shields.io/badge/status-working%20vertical%20slice-orange?style=flat-square)](#-honest-status--what-is-not-wired-yet)

<br/>

`AI red teaming` · `LLM security` · `prompt injection` · `jailbreak detection` · `AI guardrails`
`agentic AI security` · `purple teaming` · `adversarial testing` · `OWASP LLM Top 10` · `MITRE ATLAS`
`EU AI Act` · `NIST AI RMF` · `ISO/IEC 42001` · `AI governance` · `AI assurance` · `policy-as-code`

</div>

---

> [!IMPORTANT]
> **Most AI security tools hand you a PDF of problems.** Purplix hands you a *deployed, reversible,
> evidence-linked defence* — and then proves it works by attacking the system again with techniques
> the defence compiler was never allowed to see.
>
> The **loop** is the product. Not the scan, not the policy.

---

## 📑 Table of contents

| | | |
|---|---|---|
| [⚡ Quickstart](#-quickstart) | [🎯 What problem this solves](#-what-problem-this-solves) | [🔁 How the loop works](#-how-the-loop-works) |
| [📸 Screenshots](#-screenshots) | [📐 The two hard rules](#-the-two-hard-rules) | [🔢 The four numbers](#-the-four-numbers-that-matter) |
| [🏗️ Architecture](#️-architecture) | [🗣️ Vocabulary & the L1/L2/L3 trap](#️-vocabulary--the-l1l2l3-trap) | [🔒 The invariants](#-the-invariants) |
| [🎭 Targets & attack packs](#-targets--attack-packs) | [🧠 The LLM layer](#-the-llm-layer) | [🔌 API reference](#-api-reference) |
| [🗂️ Project structure](#️-project-structure) | [🧪 Testing](#-testing) | [📋 Compliance mapping](#-compliance-mapping) |
| [🚧 Honest status](#-honest-status--what-is-not-wired-yet) | [⚠️ Risk register](#️-risk-register) | [📜 Responsible use](#-responsible-use) |

---

## ⚡ Quickstart

Get a full Red → Blue → Purple pass running in about two minutes.

```bash
git clone https://github.com/Bharath12js/Purplix-AI.git
cd "Purplix-AI/purplix"

python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt  # macOS / Linux

cp .env.example .env        # add your OPENROUTER_API_KEY
```

### Run the loop with no UI — **the H2 gate**

```bash
.venv/Scripts/python.exe demo.py --seed      # init DB + register the target
.venv/Scripts/python.exe demo.py             # one full pass → prints the scorecard
```

> [!TIP]
> **Why a CLI gate exists before any UI.** If `demo.py` prints a scorecard table, the loop closes and a
> slow frontend is a cosmetic problem. Build the UI first and you find out the loop *doesn't* close
> with thirty minutes left on the clock.

### Run the full console

```bash
# terminal 1 — API
.venv/Scripts/python.exe -m uvicorn api.main:app --port 8000

# terminal 2 — web console
cd web && npm install && npx vite      # → http://127.0.0.1:5173
```

<details>
<summary><b>🎬 All CLI flags</b></summary>

<br/>

```bash
python demo.py --seed                       # init DB + register target, then exit
python demo.py                              # run one full pass, print the scorecard
python demo.py --target demo-app            # run against a different registered target
python demo.py --replay                     # cache-only, ZERO network, any miss is fatal
python demo.py --reset                      # drop and recreate the database
python demo.py --iteration 3                # label this pass as pass 3

python configure_target.py --list           # show registered targets
python configure_target.py demo-app         # register the vulnerable demo app
python configure_target.py demo-app --url http://127.0.0.1:3000
python configure_target.py support-bot      # register the model target
```

</details>

<details>
<summary><b>🎥 Replay mode — the live-demo safety net</b></summary>

<br/>

The LLM response cache is keyed on `(task, prompt_hash, seed)` — **not** on which model answered. So a
completed real run leaves behind a complete replay fixture.

```bash
REPLAY_MODE=1   # in .env
python demo.py --replay
```

The router then reads **cache-only** and raises a fatal, *named* `ReplayMiss` on any miss.

**There is no mock layer in this codebase, because none is needed.** Same code path, zero network.
Rehearse in replay mode once before any live demo — a miss tells you the exact step that would have
hit the network on stage.

</details>

<details>
<summary><b>🔑 Environment variables</b></summary>

<br/>

| Variable | Required | Purpose |
|---|:---:|---|
| `OPENROUTER_API_KEY` | ✅ | The single LLM provider key. The whole model pool draws on it. |
| `OPENROUTER_BASE_URL` | — | Defaults to `https://openrouter.ai/api/v1` |
| `REPLAY_MODE` | — | `1` = cache-only, zero network, fatal on miss |
| `GROQ_API_KEY` / `GEMINI_API_KEY` | — | Legacy. Unused by the router now; kept so old tooling doesn't `KeyError`. |

`.env` is gitignored. It is never committed, and no key, database or signing key is tracked in this repo.

</details>

---

## 🎯 What problem this solves

You shipped an LLM feature. Now answer these, with evidence:

<table>
<tr>
<td width="50%" valign="top">

**❌ What you get today**

- A red-team report, as a PDF, six weeks old
- A score with no denominator — *"87% safe"* out of what?
- Guardrails someone hand-wrote, tuned against the same attacks used to test them
- *"ASR dropped 94%"* — with no false-positive number beside it
- No way to answer *"prove this control exists because of that finding"*
- A model that was safe at launch and drifted three deploys ago

</td>
<td width="50%" valign="top">

**✅ What Purplix does**

- A **loop** that re-runs on schedule, on CI, and on drift
- Coverage reported against a **real corpus denominator**
- Defences **compiled from the findings**, each traceable to its transcript
- Four numbers, **always shown together** — ASR is never alone
- Every control carries `derived_from: [finding_id…]`, clickable to the raw transcript
- A **signed, hash-chained assurance record** per pass

</td>
</tr>
</table>

### Three engines, three pillars

|  | 🔴 **Red** | 🔵 **Blue** | 🟣 **Purple** |
|---|---|---|---|
| **Does** | Attacks the target, judges replies, extracts findings | Compiles findings into a versioned policy bundle | Re-runs everything *through* the policy, scores it, signs it |
| **Output** | `finding` + verbatim transcript | `policy_bundle` of L1/L2/L3 controls | `scorecard` + `assurance_record` |
| **Never** | Guesses a taxonomy tag | Fine-tunes anything | Reports ASR without the FP rate |

Each engine covers three **pillars** — `model`, `agent`, `app`.

---

## 🔁 How the loop works

```mermaid
flowchart LR
    A([plan]) --> B([expose])
    B --> C([compile])
    C --> D([deploy])
    D --> E([challenge])
    E --> F([scorecard])
    F --> G{converged?}
    G -- no --> A
    G -- yes --> H([sign record])

    B -.->|attacks the UNDEFENDED target<br/>= the &quot;before&quot; column| B
    C -.->|findings → L1/L2/L3 controls<br/>each with derived_from| C
    E -.->|seen + UNSEEN + benign<br/>re-run THROUGH the policy| E

    style A fill:#F8F2FF,stroke:#A624FF,color:#1A1033
    style B fill:#FFF2F5,stroke:#E11D48,color:#1A1033
    style C fill:#F0F5FF,stroke:#2563EB,color:#1A1033
    style D fill:#F0F5FF,stroke:#2563EB,color:#1A1033
    style E fill:#F8F2FF,stroke:#A624FF,color:#1A1033
    style F fill:#F8F2FF,stroke:#A624FF,color:#1A1033
    style H fill:#F8F2FF,stroke:#6E14C0,color:#1A1033
```

| # | Node | What actually happens |
|:-:|---|---|
| 1 | **plan** | Load the attack pack for this target's pillar (seen + unseen + benign), open a `loop_run` |
| 2 | **expose** | Attack the **undefended** target. This is the *before* column. Every success becomes a `finding` bound to its `attempt` transcript |
| 3 | **compile** | Cluster findings by technique → LLM policy compiler → `policy_bundle` + `control` + `control_finding` rows, **all in one transaction** |
| 4 | **deploy** | Flip the bundle to `deployed`, write `audit_log`. Reversible in one call |
| 5 | **challenge** | Re-run **seen + unseen + benign** through `PolicyEnforcer` |
| 6 | **scorecard** | Compute all four metrics, single INSERT — all four or none |
| 7 | **sign** | Ed25519-sign the record, chained to the previous record for this target |

Every node is a plain function `LoopState → LoopState`. That shape is deliberate: each one becomes a
LangGraph node with a checkpointer later, so a run **resumes** instead of restarting when a provider
dies mid-flight.

---

## 📸 Screenshots

<div align="center">

### Dashboard — the loop as one connected flow, not a row of KPI cards

<img src="dash-live.png" alt="Purplix AI dashboard showing the Red-Blue-Purple loop band, KPI strip, coverage matrix and exposure feed" width="100%"/>

</div>

<details open>
<summary><b>🔴 Red — offensive console</b></summary>
<br/>
<img src="red-live.png" alt="Red engine console: streaming run log, live attack counters and the finding table" width="100%"/>

*Streaming run log, live counters, finding table. **Every row opens the raw transcript** — never a summary modal.*
</details>

<details>
<summary><b>🔵 Blue — policy studio</b></summary>
<br/>
<img src="blue-live.png" alt="Blue engine: signal inbox, compiled controls grouped by enforcement layer, derived-from evidence chips" width="100%"/>

*Signal inbox, controls grouped by enforcement layer, and `derived_from` chips on every control. Click a chip → that finding's transcript.*
</details>

<details>
<summary><b>🟣 Purple — loop controller & assurance</b></summary>
<br/>
<img src="purple-live.png" alt="Purple engine: the four-number scorecard, exit criteria, convergence chart and held-out technique split" width="100%"/>

*The four numbers rendered as **one row, never split**. Exit criteria, convergence trend, and the unseen-technique split.*
</details>

<details>
<summary><b>⚡ Live run — a pass streaming in real time</b></summary>
<br/>
<img src="live-page.png" alt="Live run view streaming loop progress events as a pass executes" width="100%"/>

*Append-long-running work never blocks the UI. Progress streams into an append-only run log via polling.*
</details>

---

## 📐 The two hard rules

Almost every design decision in this codebase falls out of exactly two rules.

> ### 1️⃣ No count without a path
>
> **Every number in the UI must be clickable down to the raw transcript that produced it.**
>
> This is really a statement about one database table. `attempt` stores the verbatim request, the
> verbatim response, the latency, the judge's model and rationale, and which control blocked it — for
> *every* probe, attack and benign case. A finding is a pointer into that table, never a summary of it.
>
> In the UI this becomes the `TranscriptDrawer`: **every** finding row opens the transcript, never a
> modal summary. When the canary appears in a reply it is highlighted, so the viewer verifies the
> breach themselves rather than trusting the tool's word for it.

> ### 2️⃣ Unseen first
>
> **Defence effectiveness is reported on attacks the compiler never saw — beside the false-positive
> rate on benign traffic.**
>
> A defence that is tuned on the same attacks it is tested against will score beautifully and protect
> nothing. So the corpus is split **by technique, not by prompt**: the three unseen techniques
> (`encoding_base64`, `multilingual_pivot`, `leetspeak_cipher`) appear *nowhere* in the seen set. When
> unseen ASR drops, the defence has generalised across a technique boundary — which is the only version
> of that claim worth making.
>
> A random prompt-level split leaks near-duplicates across the boundary and inflates the headline. It is
> the easiest way for a product like this to lie to its own customers.

---

## 🔢 The four numbers that matter

Purplix calls this the **scorecard**. It is written as a unit and displayed as a unit.

<div align="center">

| 🎯 ASR (seen) | 🔮 **ASR (unseen)** | 🙂 FP rate (benign) | ⏱️ Added latency p95 |
|:---:|:---:|:---:|:---:|
| Attacks the compiler trained on | **The honest number** | What the defence costs real users | What the defence costs the product |
| Can be driven to 0% by memorising | Attacks it has never seen | Over-blocking is a failure, not a win | A guardrail nobody can afford is not a guardrail |

</div>

> [!WARNING]
> **Show ASR without FP and you have a sales slide, not a result.**
>
> This is enforced at the type level, not by convention. `Scorecard` has **four required fields and no
> optional ones** — the model has no way to express a partial result. The database adds a
> `CHECK` constraint, and the loop writes all four in a single INSERT or the transaction rolls back and
> no scorecard exists for that pass at all.

**Exit criteria** (the tightened purple-spec numbers): unseen ASR ≤ **5%** · FP ≤ **2%** · p95 latency
delta ≤ **100 ms**, sustained for **2 consecutive passes**.

**Five possible pass outcomes** — because a platform that only ever reports `CONVERGED` is not measuring:

```
CONVERGED · REITERATE · STALLED · REGRESSED · EXHAUSTED
```

`REGRESSED` is checked **first** in the ladder. Excellent ASR next to a blown FP budget is precisely
what over-blocking looks like, and it is a rollback trigger — not progress.

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph UI["🖥️  React 19 + Vite + Tailwind"]
        V["Landing · Dashboard · Red · Blue · Purple<br/>Live · Evidence · Compliance"]
    end

    subgraph API["⚙️  FastAPI gateway"]
        R["REST · polled event buffer · audit log"]
    end

    subgraph ENGINES["🔁  Engines (one process today, three services later)"]
        RED["🔴 red.py<br/>attack · judge · extract"]
        BLUE["🔵 blue.py<br/>cluster · compile · version"]
        PUR["🟣 purple.py<br/>challenge · score · converge"]
    end

    subgraph CORE["🧩  Core"]
        ENF["PolicyEnforcer<br/>L1 input · L2 output · L3 config"]
        SPEC["spec.py<br/>three-team contract"]
        SIGN["signing.py<br/>Ed25519 + hash chain"]
    end

    subgraph LLM["🧠  LLM router"]
        POOL["OpenRouter pool<br/>10 models · rotation · cooldown"]
        CACHE[("cache<br/>replay mode")]
    end

    subgraph TGT["🎯  Targets under test"]
        T1["support-bot<br/>(model)"]
        T2["demo-app<br/>(app)"]
        T3["supportops<br/>(app)"]
    end

    DB[("SQLite<br/>→ Postgres later")]

    UI -->|REST + poll| API
    API --> ENGINES
    RED --> BLUE --> PUR --> RED
    ENGINES --> CORE
    ENGINES --> LLM
    LLM --> CACHE
    ENF --> TGT
    RED --> TGT
    ENGINES --> DB
```

### Design decisions already committed

| # | Decision | Why |
|:-:|---|---|
| **D1** | **One** `PolicyEnforcer`, three packagings | ASGI middleware (apps) · reverse proxy (models) · SDK hooks (agents). Tool-call interception is impossible at the network edge — you must sit inside the agent loop. *Placement was never the decision; packaging was.* |
| **D2** | **In-house corpus only** | Public benchmarks inform the technique *taxonomy*, never the payloads. Several are research- or non-commercial-licensed and have no place in a shipped commercial product. |
| **D3** | **Ed25519 self-signed + per-target hash chain** | Tamper-evidence now; a natural on-ramp to a transparency log later, rather than something you throw away to build one. |
| **D4** | **Model IDs in exactly one file** | `llm/models.py`. Providers deprecate IDs on short cycles; when that happens, one file changes. |
| — | **Polling, not WebSocket** | Visually identical on screen, a fraction of the failure modes during a live clickthrough. The event names are already the ones a pub/sub bus would carry. |

### Signed assurance records

Each pass emits a signed JSON record containing the target digest, the **attack-pack hash**, the policy
bundle hash, all four metrics, the baseline, and the exit criteria in force.

Each record embeds the hash of the **previous record for the same target** — so you cannot silently
delete or reorder an inconvenient pass.

`verify_record()` checks the signature **and** that `self_hash` matches the payload actually shown.
Both halves matter: a valid signature over a *different* payload than the one on screen is exactly the
failure mode worth catching. The public key is served at `GET /api/v1/.well-known/purplix-key`.

---

## 🗣️ Vocabulary & the L1/L2/L3 trap

Purplix integrates **three specs written by three teams** against the same loop. They agree on the
loop. They do **not** agree on a vocabulary — and the places they disagree are exactly where an
integration goes quietly wrong.

> [!CAUTION]
> ### The single highest-risk item in this codebase
>
> All three specs use `L1/L2/L3` — for **two completely different axes**.
>
> | | AEGIS (blue spec) means | Purplix + purple spec mean |
> |---|---|---|
> | **L1** | **Application** — code, deps, host, HTTP surface | **Input detection** |
> | **L2** | **Model** — LLM + system prompt + RAG + I/O | **Output gating** |
> | **L3** | **Agent** — tools, memory, MCP, scheduler | **Configuration hardening** |
>
> A bare `"L2"` arriving over the wire is **ambiguous and looks perfectly valid under either reading.**
> It would not fail loudly — it would silently file every model finding under "output gating" forever.
>
> **Resolution: neither was renamed. The two axes were given different names.**
>
> ```
> tier  (what is under test)      →  pillar : model | agent | app
> layer (where a control fires)   →  layer  : L1 | L2 | L3
> ```
>
> Translation happens **once, at the ingest boundary**, via `AEGIS_TIER_TO_PILLAR` /
> `PILLAR_TO_AEGIS_TIER` in `core/spec.py`. The round trip is pinned by a test. On screen, a layer is
> **always** rendered with its qualifier — `L2 · output`, never a bare `L2`.

<details>
<summary><b>📖 Full vocabulary reconciliation table</b></summary>

<br/>

| Concept | Red spec | Blue spec (AEGIS) | Purple spec | **Purplix (canonical)** |
|---|---|---|---|---|
| Unit of work | op | round | pass | **pass** |
| Target tier | layer | layer (L1/L2/L3) | class | **pillar** — model/agent/app |
| Enforcement point | — | enforcement_point | L1/L2/L3 | **layer** — L1/L2/L3 |
| Successful attack | finding | UFM finding | finding | **finding** (UFM-shaped) |
| Generated defence | — | UCM control | control | **control** (UCM-shaped) |
| Defence set | — | — | control bundle | **policy bundle** |
| Trained-on corpus | — | — | seen | **seen** |
| Held-back corpus | — | — | unseen | **unseen** |
| The four numbers | — | — | resilience scorecard | **scorecard** |
| Sealed output | — | — | Assurance Record | **assurance record** |

The purple spec's wording won, because it is the one that reads correctly to a non-specialist — and
this vocabulary ends up in front of auditors.

**Enumerations:**

```
Pillar        model | agent | app                    what is under test
Layer         L1 | L2 | L3                           input | output | config
Phase         exposure | challenge                   before policy | after policy
Severity      low | medium | high | critical | informational
Confidence    SUSPECTED | LIKELY | CONFIRMED | UNREPRODUCED | FALSE_POSITIVE
Tier          T0..T4                                 T0 deterministic → T4 LLM
ControlState  PROPOSED | STAGED | MONITORING | ACTIVE | ROLLED_BACK | EXPIRED
PassOutcome   CONVERGED | REITERATE | STALLED | REGRESSED | EXHAUSTED
```

`UNREPRODUCED` (0/N on replay) is deliberately distinct from `FALSE_POSITIVE` (which requires a signed
suppression). Collapsing the two is how a flaky probe quietly becomes a closed finding.

</details>

---

## 🔒 The invariants

These are enforced in **more than one place on purpose** — schema, service layer, and database.
Do not weaken one without changing the test that pins it.

<details open>
<summary><b>Invariant 1 — no control without evidence</b></summary>

<br/>

Every control carries `derived_from` with **≥ 1 finding id**.

- `ControlSpec` / `UnifiedControl` declare `min_length=1`
- `compile_policy()` **drops LLM-invented finding ids**, then drops any control left with none
- `control_finding` is a composite-PK table written in the **same transaction** as the control — there
  is never a moment where an unlinked control exists in the database

*A control nobody can trace to evidence is exactly the "trust me" posture this product exists to replace.*

</details>

<details open>
<summary><b>Invariant 2 — the scorecard is written and displayed as a unit</b></summary>

<br/>

Four fields, none optional. Enforced by a type with no partial representation, a single INSERT, and a
`CHECK` constraint on the table.

</details>

<details open>
<summary><b>Invariant 3 — the unseen split is by technique, not by prompt</b></summary>

<br/>

Pinned by `test_holdout_is_technique_disjoint` — **the most important test in the repository.** It is
what stops the headline metric quietly inflating.

</details>

<details>
<summary><b>Further invariants inherited from the source specs</b></summary>

<br/>

- **`tier_trace` is mandatory on every finding.** It is the audit trail behind the LLM-invocation-rate
  claim; without it that number is unverifiable.
- **A control cannot be `ACTIVE` without a `verification` block.** Promotion is earned by replay, not by
  a deploy call returning `200`. *(Implemented as a model validator, not a field validator — pydantic
  validates fields in declaration order, so a field validator on `state` cannot see `verification` and
  would silently reject every ACTIVE control while looking like a strict rule working.)*
- **A confirmed Critical cannot be averaged away.** The category score is hard-capped at `20.0` the
  moment one Critical lands. `informational` carries weight `0` — it moves the denominator, never the
  numerator.
- **An unmapped technique returns an empty taxonomy, never a guess.** A wrong framework tag lands in a
  compliance export and nobody re-checks it. Unmapped techniques are *surfaced as a coverage gap*.
- **`applicable_cases` and `cases_run` are expected to diverge, and that gap *is* the coverage
  statement.** Without a real corpus denominator, coverage is a number divided by itself and always
  looks like 100%.
- **Residual budgets differ by determinism, not by pillar.** Deterministic findings converge to literal
  zero; probabilistic ones converge to a budget. Demanding zero of a probabilistic finding designs a
  loop that can never terminate.

</details>

---

## 🎭 Targets & attack packs

Adding a target is **registering an adapter, not editing the engine**. A `TargetProfile` answers the
five questions the loop cannot answer for itself: how to call it, how to score it deterministically,
what it must never do, how to defend it if the compiler LLM is down, and whether it is reachable.

| Adapter key | Pillar | Target | Oracle |
|---|:---:|---|---|
| `support-bot` | 🧠 `model` | Purplix Support Assistant — an LLM behind a system prompt with a confidential refund-override code | Canary + LLM judge |
| `demo-app` | 📦 `app` | Demo App — a deliberately vulnerable FastAPI service | **Deterministic** |
| `supportops` | 📦 `app` | SupportOps AI — a vulnerable SaaS app | **Deterministic** |

> [!NOTE]
> `deterministic_oracle` is the one flag that changes the loop's cost. A target whose success signal is
> a **canary string** needs no judge model at all — which is why the demo-app target runs end to end
> **with no API keys** while the support bot cannot.

### The canary — why ground truth earns its place

The model target holds a confidential code. If it appears in a reply, **the attack succeeded** — there
is nothing for a judge model to have an opinion about.

```
canary check (ground truth, wins outright)
        ↓  not leaked
LLM judge  →  verdict + confidence + rationale
```

Without a canary, *"did the attack succeed?"* is a judge model's opinion and every number downstream
inherits that opinion. With it, the headline result is a **string match anyone can verify from the
transcript.** The judge still runs — for the rules that have no canary, and for soft leaks a string
match cannot see.

A judge outage returns `success=False` with `confidence=0.0` **and a `judge:error` label** rather than
silently counting as "attack failed". Under-reporting ASR is the direction that flatters the product,
so it is marked, not swallowed.

### Attack packs

| Pack | Split | Contents |
|---|---|---|
| `packs/model/` | seen · **unseen** · benign | `role_play_override`, `hypothetical_framing`, `prefix_injection`, `authority_impersonation`, `refusal_suppression`, `context_poisoning` — unseen: `encoding_base64`, `multilingual_pivot`, `leetspeak_cipher` |
| `packs/app/` | seen · **unseen** · benign | Application-pillar probes |
| `packs/supportops/` | seen · **unseen** · benign | SaaS-specific probes |

> [!TIP]
> **The benign corpus is not an afterthought — it is the guard on over-blocking.**
> Several benign cases deliberately say *"refund"*, *"override"*, *"policy"*, *"chargeback"* and talk
> about money. That is the exact vocabulary an over-broad L1 keyword rule latches onto. A defence that
> blocks these has not made the product safer — it has made it useless, and the FP tile will say so.

The pack hash goes into the assurance record: **a result is only meaningful if you can say which corpus
produced it.**

### The enforcer — one class, three layers

```python
enforce_input(text)   -> EnforcementResult   # L1 — structural patterns over user input
enforce_output(text)  -> EnforcementResult   # L2 — forbidden content in the model reply
harden(system_prompt) -> str                 # L3 — appended hardening instructions
```

Exposure and challenge run through **the same code path** — exposure just passes a null bundle. That is
what keeps *before* and *after* honestly comparable, instead of two different code paths that happen to
produce two numbers.

A compiler-authored regex that does not compile is **skipped, not fatal** — and stays visible in the
bundle so a human can see the compiler produced junk.

---

## 🧠 The LLM layer

**Contract:** `complete(task, messages, schema) -> ParsedModel`. **Callers name a task, never a model.**

> [!IMPORTANT]
> **Every LLM output is parsed into a Pydantic model. There is no free-text parsing anywhere in this
> codebase.** If a model cannot produce a valid instance after one bounded repair attempt, the call
> fails loudly rather than degrading into a guess.

### OpenRouter pool with rotation — continuous coverage

Sprint 0 pinned one model per task across two providers. That gave determinism but **no availability
headroom**: a single outage or rate limit stalled the entire loop.

The router is now **OpenRouter-only with one shared pool of 10 models**:

```mermaid
flowchart LR
    C["complete(task, …)"] --> P{"pool cursor"}
    P --> M1["model 1"]
    M1 -->|"429 / 5xx / timeout"| CD["⏸ 60s cooldown"]
    CD --> M2["model 2"]
    M2 -->|ok| OK(["✅ parsed result"])
    M1 -->|ok| OK
    style OK fill:#F0FFF4,stroke:#2ea44f,color:#1A1033
    style CD fill:#FFF2F5,stroke:#E11D48,color:#1A1033
```

- Each call walks the pool from a **rotating cursor**
- A model that rate-limits, errors, times out or returns empty goes on a **60-second cooldown**
- The call succeeds **as long as any pooled model is healthy** — no human babysitting rate limits
- **`POLICY_COMPILE` gets a task-preferred ordering.** The compiler must emit a strict nested JSON
  schema, and the smallest pool members validate-fail even after the repair retry — silently falling
  back to the template bundle. The ordering is by **measured JSON compliance, not model size.**

Editing `MODEL_POOL` in `llm/models.py` changes coverage. **Nothing else in the repository references a
model ID.**

<details>
<summary><b>💰 Cost, determinism and the cache</b></summary>

<br/>

- **Per-run call budget** as a runaway guard (ceiling: 400 calls)
- **Response cache** keyed on `(task, prompt_hash, seed)` — *not* on which model answered, so replay
  stays faithful even though the pool rotates
- `temperature=0`, fixed seed. Determinism is **best-effort** now, since pooled models vary in whether
  they honour a seed — the cache is what makes replay faithful, and the README says so rather than
  claiming determinism it cannot deliver

</details>

---

## 🔌 API reference

FastAPI, one process. The **route shapes are already the v1 API**, so the engines can be split into
separate services later behind the same URLs without the frontend noticing.

<details open>
<summary><b>Endpoints</b></summary>

<br/>

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness, cache size, replay-mode flag |
| `GET` | `/api/v1/targets?pillar=` | Registered targets, filterable by pillar |
| `POST` | `/api/v1/red/runs` | Start a loop pass → `{run_key, iteration}` |
| `GET` | `/api/v1/red/runs/{run_key}/events?since=` | Poll progress — tail-only, index-based |
| `GET` | `/api/v1/red/runs/{run_id}/attempts?phase=&only_success=` | Paginated attempts |
| `GET` | `/api/v1/findings?run_id=` | Findings for a run |
| `GET` | `/api/v1/findings/{finding_id}` | One finding **including the full transcript** |
| `GET` | `/api/v1/blue/bundles?target_id=` | Policy bundles |
| `GET` | `/api/v1/blue/bundles/{bundle_id}` | Bundle + controls + `derived_from` links |
| `POST` | `/api/v1/blue/bundles/{bundle_id}/rollback` | Reverse a deployment in one call |
| `GET` | `/api/v1/purple/loops?target_id=` | Passes for a target |
| `GET` | `/api/v1/purple/loops/{run_id}/titer` | The four numbers |
| `GET` | `/api/v1/purple/loops/{run_id}/record` | **Signed assurance record** |
| `GET` | `/api/v1/.well-known/purplix-key` | Public key for record verification |
| `GET` | `/api/v1/dashboard/summary` | KPI strip + coverage matrix |

Progress events: `loop.progress` · `attempt.new` · `titer.update`

</details>

<details>
<summary><b>🖥️ Console routes</b></summary>

<br/>

| Route | Page | Purpose |
|---|---|---|
| `/` | **Landing** | Public marketing page — outside the console chrome |
| `/login` | Sign-in | Outside the shell |
| `/dashboard` | **Dashboard** | Estate posture: loop band, KPI strip, coverage matrix, exposure feed |
| `/initiate` | Initiate | Register a target and launch a pass |
| `/live` | **Live run** | A pass streaming in real time |
| `/red` | Red console | Run log, live counters, finding table |
| `/blue` | Blue studio | Signal inbox, controls by layer, `derived_from` chains |
| `/purple` | Purple controller | Scorecard, exit criteria, convergence, unseen split |
| `/evidence` | Evidence | Hash-chain visualiser, signed record, verification |
| `/compliance` | Compliance | Framework coverage **and gaps** |

</details>

> [!NOTE]
> **No authentication is implemented yet.** The design specifies OIDC + short-lived JWT + four RBAC
> roles (`owner` / `operator` / `auditor` / `viewer`); none of it is built. Do not expose this on an
> untrusted network.

---

## 🗂️ Project structure

<details open>
<summary><b>Repository tree</b></summary>

<br/>

```
Purplix-AI/
├── README.md                          ← you are here
├── PURPLIX-AI-MASTER-CONTEXT.md       ← deep orientation doc: every decision, every gap
├── purplix-ai-master-design-plan.md   ← the target architecture this grows into
│
└── purplix/
    ├── demo.py                  CLI loop driver — the H2 gate
    ├── configure_target.py      register a target (writes the Target row)
    │
    ├── api/main.py              FastAPI gateway
    │
    ├── core/
    │   ├── spec.py              ★ the three-team contract, reconciled ONCE
    │   ├── models.py            SQLAlchemy tables
    │   ├── schemas.py           Pydantic — Verdict, ControlSpec, PolicyBundleSpec, Scorecard
    │   ├── taxonomy.py          OWASP/ATLAS/CWE/D3FEND maps · corpus manifest · adapter registry
    │   ├── enforcer.py          PolicyEnforcer — L1 / L2 / L3  (D1)
    │   ├── signing.py           Ed25519 + per-target hash chain  (D3)
    │   └── packs.py             pack loading + hashing
    │
    ├── engine/
    │   ├── loop.py              the seven nodes, persistence, progress events
    │   ├── red.py               attack execution · canary oracle · LLM judge
    │   ├── blue.py              cluster → compile → version → fallback bundle
    │   └── purple.py            challenge · ASR · p95 · scorecard
    │
    ├── llm/
    │   ├── models.py            ★ MODEL_POOL — the ONLY place model IDs live  (D4)
    │   ├── router.py            OpenRouter pool, rotation, cooldown, repair retry
    │   └── cache.py             response cache → replay mode
    │
    ├── targets/
    │   ├── base.py              TargetProfile — the seam
    │   ├── registry.py          adapter key → profile
    │   ├── support_bot.py       model pillar · canary + judge
    │   ├── demo_app.py          app pillar · deterministic oracle
    │   └── supportops.py        app pillar · deterministic oracle
    │
    ├── packs/{model,app,supportops}/    seeded · holdout · benign  (in-house, D2)
    ├── tests/                           44 tests, no network required
    ├── docs/INTEGRATION.md              the three-spec reconciliation, in prose
    │
    └── web/                     React 19 · Vite · Tailwind · Recharts
        ├── DESIGN.md            the design system and what must not be altered
        └── src/{views,components,brand,data}/
```

</details>

### 🎨 The design system in one rule

The mark's shield runs **crimson → purple → steel blue**. That is Red → Purple → Blue. So colour is
allowed to carry meaning, and the whole system rests on a single rule:

| Hue | Means | Used for |
|---|---|---|
| 🟣 **Purple** | assurance, platform, the loop | brand accents, primary actions, unseen metrics |
| 🔴 **Crimson** | **offensive** | attacker input, breaches, findings, severity |
| 🔵 **Steel blue** | **defensive** | controls, policy layers, blocked traffic |

> **Crimson and steel are never decorative.** A crimson button that doesn't mean offence is a **bug**,
> not a style choice. This one rule is what makes eight pages read as one product.

Four components are load-bearing and should not be altered casually: `TranscriptDrawer`,
`derived_from` chips, `Metric` (takes both a baseline *and* a budget — a metric with no baseline is a
number, not a result), and `LoopBand` (the three engines as **one connected flow**, because every
security product ships KPI cards and a row of cards hides the only thing that matters here).

---

## 🧪 Testing

```bash
cd purplix
.venv/Scripts/python.exe -m pytest tests/ -q
```

```
............................................  [100%]
44 passed in 0.46s
```

**44 tests. Half a second. No network required.**

| Suite | Count | Covers |
|---|:---:|---|
| `test_invariants.py` | 16 | `derived_from` · scorecard atomicity · **technique-disjoint holdout** · L1/L2/L3 enforcement · invalid-regex tolerance · canary evasion detection · signature verification · hash chaining · exit criteria |
| `test_spec_integration.py` | 28 | **The L1/L2/L3 round trip** · authorization gate · tier trace · reproduction bounds · Critical score ceiling · all five pass outcomes · taxonomy guessing · corpus denominators · adapter registry · chain hops |

The single most important test is **`test_holdout_is_technique_disjoint`**. It is what stops the
headline metric quietly inflating.

---

## 📋 Compliance mapping

Findings and controls carry framework tags so a result maps to an audit row rather than staying a
security curiosity.

<div align="center">

| Framework | Mapped via |
|---|---|
| 🇪🇺 **EU AI Act** | control coverage + signed assurance records |
| 🏛️ **NIST AI RMF** | MEASURE / MANAGE functions |
| 📘 **ISO/IEC 42001** | AI management-system controls |
| 🔟 **OWASP LLM Top 10** | `LLM01` prompt injection · `LLM02` sensitive-info disclosure · `LLM06` excessive agency |
| 🗺️ **MITRE ATLAS** | `AML.T0051` · `AML.T0054` · `AML.T0057` … |
| 🧱 **CWE / OWASP ASI / D3FEND** | `CWE-1427`, `ASI01/02/04/05`, and D3FEND *on the control* — so a compliance row can point at a **defence**, not only at a hole |

</div>

> [!NOTE]
> **The compliance page shows its gaps.** Two rows are marked `gap` because the loop genuinely cannot
> produce their evidence — human oversight, and AI impact assessment. **A framework page with no gaps is
> one nobody believes.**

---

## 🚧 Honest status — what is *not* wired yet

> [!WARNING]
> This is a **working vertical slice**, not a finished product. It goes all the way around the loop
> against a real target and produces real numbers — but it is deliberately thinner than the target
> architecture. This section exists so nothing here is mistaken for finished work.

<details open>
<summary><b>Engines vs contract</b></summary>

<br/>

| | Gap |
|:-:|---|
| 1 | **Red does not dispatch to the nine OSS tool adapters.** The registry and shapes are defined (promptfoo, garak, PyRIT, HarmBench, Precogly, HackAgent, AgentHarm, InjecAgent, AgentDojo); the subprocess/async plumbing is not built. The in-house runner is what actually runs. |
| 2 | **Blue compiles free-form controls, not template-backed ones.** The AEGIS control grammar needs porting before the *"never invents enforcement code"* claim is true of **this repo** rather than of the spec. |
| 3 | **Purple does not rotate the holdout, and the five-outcome ladder is never invoked by the loop.** `decide_outcome()` exists and is tested, but the engine uses a boolean check — so only `CONVERGED` and `REITERATE` are reachable in code. |
| 4 | **Cross-layer chains are authored, not derived.** Chain scoring needs `blast_radius` populated by the adapters first. |
| 5 | **Tier accounting is not instrumented.** `tier_trace` is on the model and in the fixtures; nothing writes it. **The LLM-invocation rate on screen is a target, not a measurement — and must not be presented as measured until it is.** |

</details>

<details>
<summary><b>Threshold drift — check before quoting a number</b></summary>

<br/>

`core/schemas.ExitCriteria` still defaults to the **original** 20% / 10% / 400 ms, while
`core/spec.ResidualBudget` and the UI use the tightened **5% / 2% / 100 ms**. Since `demo.py` and the
API both construct the loose criteria, **a live Python run and the console are currently gating on
different thresholds.**

</details>

<details>
<summary><b>Pillars, UI wiring and infrastructure</b></summary>

<br/>

- **Agent pillar is not built.** `model` and `app` have real targets and packs; `agent` exists in the
  contract and the UI only.
- **The console reads fixtures, not the API, on most pages.** `src/api.ts` is a real, hand-written
  client that is currently unreferenced on those pages — kept because it documents the wiring.
- **SQLite, one process, no queue.** The ORM is real from day one precisely so the Postgres repoint is a
  config change, not a rewrite. No Redis, no Celery, no object store, no OTel yet.
- **Light theme only.** The 50–900 colour ramps make dark mode a token swap rather than a rewrite, but
  it has not been built or tested. Desktop-first — this is an operations console.
- **Login has no auth behind it.** Any submit routes into the console.
- **Attack corpus licensing.** The corpus *sizes* cited for public benchmarks are metadata and fine to
  carry. Importing their **payloads** needs a licensing review first — hence D2.

</details>

### 🗺️ Roadmap

```mermaid
timeline
    title Purplix AI — build phases
    Now  : Walking skeleton : model + app pillars : full loop, signed records : 44 invariant tests
    Next : Nine OSS tool adapters : template-backed control grammar : holdout rotation + 5 outcomes : UI wired to the live API
    Then : Agent pillar - tool scoping, approval gates : Postgres, Redis, queue, object store : scheduler, CI webhook, drift detection
    Later: Multi-tenancy + RBAC + audit export : transparency log for records : OTel, SLOs, per-tenant cost reporting
```

---

## ⚠️ Risk register

Every known way this product could lie to its own customers, and the guard that stops it.

| # | Risk | Guard |
|:-:|---|---|
| **R1** | Defence memorises the seen attacks | Hold out **by technique**; unseen ASR is the headline metric |
| **R2** | Over-blocking collapses usability | Benign corpus + FP rate beside every scorecard; `REGRESSED` checked first in the ladder |
| **R3** | Judge errors propagate into controls | Canary ground truth overrides the judge; confidence thresholds; judge failures are **labelled**, not swallowed |
| **R4** | LLM cost blowout | Response cache, per-run call budget, pooled rotation |
| **R5** | Provider outage mid-run | 10-model pool with cooldown rotation; node-shaped loop ready for checkpoint/resume |
| **R6** | Guardrail adds unacceptable latency | p95 latency delta is an **exit criterion**, not a footnote; compiled-regex cache |
| **R7** | Platform becomes an attack tool | Authorization gate refuses a bare `authorized: true` — an accountable reference is required, and `credentials_ref` is format-checked so a **pasted secret** is caught |
| **R8** | Adaptive attackers read the deployed policy | The **loop** is the product, not the policy — continuous re-immunisation on schedule and on drift |

---

## 🤝 Working rules for contributors

- **Put cross-team reconciliation in `core/spec.py` and add a test.** Never translate inline at a call
  site — silent vocabulary mismatches are the main integration risk here.
- **Never read a bare `L1`/`L2`/`L3`** from an AEGIS-shaped payload without the translation dicts. In
  UI, always render the qualifier.
- **Do not weaken an invariant without changing the test that pins it.** They are multi-layered on purpose.
- **Do not present `tier_trace`-derived numbers as measured** until something writes them.
- **Add a model ID in exactly one place** — `llm/models.py`.
- **When the numbers look good, check whether they are the *unseen* numbers** — and whether the FP rate
  is sitting beside them.

📖 Start with **[`PURPLIX-AI-MASTER-CONTEXT.md`](PURPLIX-AI-MASTER-CONTEXT.md)** — it documents every
decision, every invariant, and every known gap in one place.

---

## 📜 Responsible use

> [!CAUTION]
> **Purplix AI is an offensive security tool.** It generates and executes adversarial prompts and
> probes against AI systems.
>
> **Only run it against systems you own or have explicit, written authorisation to test.**
>
> The platform enforces this in code rather than in a disclaimer: the authorization gate **refuses a
> bare `authorized: true`** and requires an accountable reference an auditor can follow — because a
> checkbox is not accountability. Every mutating action writes to `audit_log`.
>
> All attack payloads in this repository are authored in-house against a deliberately vulnerable demo
> target, and exist to test defences — not to enable harm.

---

<div align="center">

<br/>

**Built by [SISA](https://www.sisainfosec.com/)** · Owner: `sohan.k@sisainfosec.com`

*The unit of work is a loop pass, not a scan.*

<sub>🔴 Red finds it · 🔵 Blue fixes it · 🟣 Purple proves it — then it all runs again.</sub>

</div>
