# Integration — Red + Blue (AEGIS) + Purple into Purplix AI

**Status:** contract landed, fixtures landed, UI landed. Engine wiring is next.
**Date:** 2026-09-19 · **Owner:** sohan.k@purplix.ai

Three teams wrote three specs against the same loop:

| Spec | Source | What it owns |
|---|---|---|
| Red | `RED_TEAM_SPEC/` | Nine tool adapters, taxonomy map, corpus manifest, severity-weighted risk score, authorization gate, evidence redaction + retention |
| Blue (AEGIS) | `handover/blue team/blue/` | UFM, UCM, cross-layer chains, the T0–T4 escalation ladder, control templates and lifecycle, residual budgets |
| Purple | `purple-team/` | The pass state machine, five pass outcomes, the four-number scorecard, holdout rotation, campaign vs standing mode |

They agree on the loop. They do **not** agree on a vocabulary, and the places
they disagree are exactly where an integration goes quietly wrong. This document
is the reconciliation. The code form of it is [`core/spec.py`](../core/spec.py),
pinned by [`tests/test_spec_integration.py`](../tests/test_spec_integration.py).

---

## 1. The collision that matters: L1/L2/L3

This is the highest-risk item in the whole integration and it is worth reading
twice.

| | AEGIS means | Purplix / purple spec mean |
|---|---|---|
| **L1** | Application (the code, deps, host, HTTP surface) | Input detection |
| **L2** | Model (LLM + system prompt + RAG + I/O) | Output gating |
| **L3** | Agent (tools, memory, MCP, scheduler) | Configuration hardening |

Both readings are load-bearing in their own document. A bare `"L2"` arriving
over the wire is **ambiguous and looks perfectly valid either way** — which is
why it would not fail loudly, it would just silently file a model finding under
"output gating" forever.

**Resolution — neither is renamed; the axes are given different names:**

```
tier  (what is under test)    ->  pillar : model | agent | app
layer (where a control fires) ->  layer  : L1 | L2 | L3
```

Translation happens **once, at the ingest boundary**, via
`AEGIS_TIER_TO_PILLAR` / `PILLAR_TO_AEGIS_TIER`. The round-trip is tested. The
red spec's `"application"` → `"app"` mismatch goes through `RED_LAYER_TO_PILLAR`
in the same place.

On screen, `LayerPill` always renders `L2 · output` rather than a bare `L2`, for
the same reason.

---

## 2. Vocabulary map

| Concept | Red spec | Blue spec | Purple spec | **Purplix (canonical)** |
|---|---|---|---|---|
| Unit of work | op | round | pass | **pass** |
| Target tier | layer (model/application/agent) | layer (L1/L2/L3) | class (model/agent/application) | **pillar** (model/agent/app) |
| Enforcement point | — | enforcement_point | L1/L2/L3 | **layer** (L1/L2/L3) |
| Successful attack | finding | UFM finding | finding | **finding** (UFM-shaped) |
| Generated defence | — | UCM control | control | **control** (UCM-shaped) |
| Defence set | — | — | control bundle | **policy bundle** |
| Trained-on corpus | — | — | seen | **seen** (was: seeded) |
| Held-back corpus | — | — | unseen | **unseen** (was: held-out) |
| The four numbers | — | — | resilience scorecard / titer | **scorecard** |
| Sealed output | — | — | Assurance Record | **assurance record** |

Two renames landed across the codebase and the UI: `seeded → seen` and
`holdout → unseen`. The purple spec's wording won because it is the one that
reads correctly to a non-specialist, and this vocabulary ends up in front of
auditors.

---

## 3. What each spec contributed, and where it lives

### Red → `core/taxonomy.py`, `core/spec.py`

- **Nine adapters** (`ADAPTERS`) — promptfoo, garak, PyRIT, HarmBench, Precogly,
  HackAgent, AgentHarm, InjecAgent, AgentDojo — plus Purplix's own in-house
  runner, which is kept because OSS runners report scores and discard the
  per-attempt transcripts and technique labels this product depends on.
- **Taxonomy map** (`TAXONOMY_MAP`) — keyed by `(tool, technique)`, never by
  technique alone; two tools can use the same technique name for different
  things. An unmapped technique returns an **empty** taxonomy, never a guess: a
  wrong framework tag lands in a compliance export and nobody re-checks it.
- **Corpus manifest** (`CORPUS_MANIFEST`) — the real denominator.
  `applicable_cases` and `cases_run` are expected to diverge, and that gap *is*
  the coverage statement.
- **Risk score** (`compute_category_score`) — severity-weighted, with a hard
  ceiling of 20 the moment a Critical lands, so it cannot be averaged away.
- **Authorization gate** (`Authorization`) — a bare `authorized: true` is
  refused; an accountable reference is required. `credentials_ref` is
  format-checked against env-var syntax.

### Blue (AEGIS) → `core/spec.py`

- **UFM** (`UnifiedFinding`) — widened to carry the verbatim transcript
  alongside `evidence_ref`. AEGIS keeps the bytes elsewhere; Purplix's "no count
  without a path" rule needs them reachable from the finding.
- **UCM** (`UnifiedControl`) — template-backed, param-filled, lifecycle-tracked.
  `derived_from` has `min_length=1`; `state == "ACTIVE"` requires a
  `verification` block.
- **Cross-layer chains** (`CrossLayerChain`) — minimum two hops, scored end to
  end, cut at the cheapest breaking hop.
- **Escalation ladder** — `tier_trace` is mandatory on every finding. It is the
  audit trail behind the sub-8% LLM-invocation claim; without it that number is
  unverifiable.
- **Residual budgets** (`ResidualBudget`) — deterministic findings go to literal
  zero; probabilistic ones go to a budget. This was the pre-mortem's correction
  and it is the difference between a loop that terminates and one that cannot.

### Purple → `core/spec.py`

- **Scorecard** (`Scorecard`) — four fields, no optional ones. The model has no
  way to express a partial result, which is Invariant 2 at the type level.
- **Pass outcomes** (`decide_outcome`) — all five, in one function so the ladder
  cannot be reordered. `REGRESSED` is checked **first**: excellent ASR next to a
  blown FP budget is exactly what over-blocking looks like.
- **Holdout rotation** — a holdout that is reused stops being a holdout. Tracked
  per pass as `holdoutTechniques` / `retiredToSeen`.

---

## 4. Three reconciliations worth recording

**Judging is layered, not replaced.** The red spec's two-pass judge (cheap
first, escalate on doubt) and the blue spec's five-tier ladder (T0 deterministic
→ T4 LLM) are the same idea at different granularities. T0 subsumes Purplix's
canary oracle; the two-pass LLM judge is T4's internals. `tier_trace` records
the path, so `["T0"]` on a finding means no tokens were spent at all.

**Convergence targets differ by determinism, not by pillar.** The blue spec sets
residual to literal zero for L1 and to a budget for L2/L3. Mapped onto pillars
that would read as "app findings converge to zero, model findings do not" — but
the real axis is deterministic vs probabilistic, and both kinds exist on every
pillar. `fnd_13` (a config read) and `fnd_15` (a tenancy filter) are held to
zero; `fnd_08` (a multilingual jailbreak) is held to a budget. The pillar is
irrelevant to that choice.

**Exit criteria tightened to the purple spec's numbers.** Purplix shipped with
unseen ASR ≤ 20% / FP ≤ 10% / latency ≤ 400 ms. The purple spec specifies ≤ 5% /
≤ 2% / ≤ 100 ms. The tighter set won, which is why the current campaign reads
`REITERATE` at 6% rather than `CONVERGED` at 22%. That is the honest reading of
the same run, and making it look worse was the point.

---

## 5. What the fixtures now carry

`web/src/data/fixtures.ts` is the data contract the engines must satisfy.

- **All three pillars are live.** No "Sprint C" placeholders remain — model,
  agent and app each carry targets, findings, controls and coverage.
- **Every timestamp is anchored two hours ago.** One `CAMPAIGN_SEALED_AT`
  constant; every event sits inside a nine-minute window before it, so ordering
  between passes stays real while every relative label reads `2 h ago`. Format
  via `relTime()` / `absTime()` — never inline.
- **The numbers are deliberately imperfect.** Unseen ASR is 6% against a 5%
  budget. FP rate is non-zero. Two held-out techniques survive. Pass 1 is
  recorded as `REGRESSED`, not as progress. One chain (`chn_03`) is still open
  because no reviewed template covers it and the compiler correctly refused to
  invent one. One target is unpinned and says so. One adapter timed out and the
  run log shows a red line rather than a clean zero.

---

## 6. Not yet wired

Landed here as contract and fixtures; the engines still read the old path.

1. **`engine/red.py`** does not yet dispatch to the nine adapters — it runs the
   in-house runner only. The adapter registry and `ExecutionSpec` shape are
   defined; the subprocess/async plumbing is not.
2. **`engine/blue.py`** compiles free-form `ControlSpec` rather than
   template-backed `UnifiedControl`. The control grammar (`controls/templates/`
   in the AEGIS package) needs porting before the "never invents enforcement
   code" claim is true of this repo rather than of the spec.
3. **`engine/purple.py`** computes the scorecard but does not rotate the
   holdout, and `decide_outcome` is not yet called — `ExitCriteria.met_by` still
   returns a bare boolean, so only CONVERGED and REITERATE are reachable.
4. **Chains are not computed.** `CHAINS` is authored, not derived. Chain
   scoring needs `blast_radius` to be populated by the adapters first.
5. **Tier accounting is not instrumented.** `tier_trace` is on the model and in
   the fixtures; nothing writes it yet, so the LLM-invocation rate on screen is
   a target rather than a measurement. It must not be presented as measured
   until it is.

---

## 7. Open items inherited from the source specs

Carried forward unresolved — none of these are closed by this integration.

- **Precogly TM-BOM field shape** (red spec, Batch E / #12). The application
  layer's `tool_use_detected` branch depends on `component.type == "tool_call"`
  existing in Precogly's real export, verified against marketing material only.
  The failure-isolation wrapper makes a wrong assumption produce a logged error
  and a conservative branch rather than a crash — but it will still be the wrong
  branch. Stand up a real instance before implementing that branch.
- **Wrapper packaging** (Purplix open decision). Resolved in principle by
  `core/enforcer.py`: one class, three packagings — ASGI middleware for apps,
  reverse proxy for models, SDK hooks for agents, because tool-call
  interception is impossible at the network edge. Not yet built for agent or app.
- **Attack corpus licensing.** The fixtures cite HarmBench, AgentHarm,
  InjecAgent and AgentDojo corpus sizes. Importing their payloads needs a
  licensing review before shipping; the manifest counts are metadata and are
  fine to carry now.
- **Human oversight** (compliance `cm_04`, still a gap). Autonomy levels L0/L1
  exist in the config surface but there is no documented human review step on
  low-confidence verdicts. Marking this covered would be false.
