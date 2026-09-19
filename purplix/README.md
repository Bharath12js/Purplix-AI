# Purplix AI — Sprint 0 vertical slice

One process, SQLite, no queue. Runs the **whole** Red → Blue → Purple loop
against a real OpenRouter-hosted target and produces real numbers.

This is deliberately thinner but goes all the way around, rather than going
deep on Red alone. See `../lets-plan-the-deisgn-wobbly-flute.md` for how it
grows into the §3 architecture (Sprints A–D).

## Setup

```bash
cd purplix
cp .env.example .env        # then fill in OPENROUTER_API_KEY
.venv/Scripts/python.exe demo.py --seed
```

Every LLM call site draws from one shared, rotating OpenRouter pool: on a
rate-limit or error the router advances to the next model and cools the failing
one down, so the loop keeps running as long as any pooled model is healthy. The
pool and cooldown live in `llm/models.py` (`MODEL_POOL`, `COOLDOWN_SECONDS`) —
the only place a model ID appears.

## The H2 gate — prove the loop with no UI

```bash
.venv/Scripts/python.exe demo.py
```

Prints the four titer metrics. If this works, everything else is cosmetic.

## Run the app

```bash
# terminal 1
.venv/Scripts/python.exe -m uvicorn api.main:app --port 8000
# terminal 2
cd web && npx vite
```

Open http://127.0.0.1:5173

## Replay mode — the live-demo safety net

The LLM cache is keyed on `(task, prompt_hash, seed)` — deliberately *not* on
which pooled model answered, so a completed real run leaves a complete replay
fixture even though rotation means a different model may answer each run. No
mock layer exists because none is needed.

```bash
# after at least one successful real run:
.venv/Scripts/python.exe demo.py --replay      # cache-only, any miss is fatal
```

Set `REPLAY_MODE=1` in `.env` to run the whole app offline. Rehearse in replay
mode at least once — a cache miss names the exact step that would have hit the
network on stage.

## Tests

```bash
.venv/Scripts/python.exe -m pytest tests/ -q
```

16 invariant tests, no network required. The one that matters most is
`test_holdout_is_technique_disjoint` — it is what stops the headline metric
quietly inflating.

## Layout

```
api/      FastAPI gateway (§7 route shapes)   -> apps/api/ in Sprint C
core/     models · schemas · enforcer · signing · packs
llm/      router · pinned model IDs (D4) · cache
engine/   red · blue · purple · loop          -> services/* in Sprint C
packs/    in-house attack + benign corpora (D2)
targets/  the Purplix Support Assistant under test
web/      Vite + React + Tailwind
demo.py   CLI loop driver
```

## Decisions already committed

- **D1** one `PolicyEnforcer`, three adapters (ASGI / proxy / SDK hooks)
- **D2** in-house corpus only; public benchmarks inform taxonomy, never payloads
- **D3** Ed25519 self-signed + per-target hash chain
- **D4** model IDs in `llm/models.py`, one file — now a rotating OpenRouter
  pool (`MODEL_POOL`) rather than one pinned model per task
