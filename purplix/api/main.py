"""FastAPI gateway.

Sprint 0 runs Red/Blue/Purple as modules in one process. The ROUTE SHAPE is
already the §7 v1 API, so Sprint C can split them into three services behind
the same URLs without the frontend noticing.

Progress delivery is polling, not WebSocket — cut-list item 2, taken up front.
A 500ms poll against an in-memory event buffer looks identical on screen and
has a fraction of the failure modes during a live clickthrough.
"""

from __future__ import annotations

import sys
import threading
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core import models as M
from core import signing
from core.schemas import ExitCriteria
from engine import loop, purple
from llm import cache

app = FastAPI(title="Purplix AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# run_id -> ordered event list. In-process, which is exactly what Sprint A
# replaces with Redis pub/sub behind these same event names.
EVENTS: dict[str, list[dict]] = defaultdict(list)
RUN_STATE: dict[str, str] = {}
_lock = threading.Lock()


@app.on_event("startup")
def _startup() -> None:
    M.init_db()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "cache_entries": cache.stats()["entries"], "replay_mode": cache.replay_mode()}


# ---------------------------------------------------------------- targets


@app.get("/api/v1/targets")
def list_targets(pillar: str | None = None) -> list[dict]:
    with M.SessionLocal() as s:
        q = s.query(M.Target)
        if pillar:
            q = q.filter(M.Target.pillar == pillar)
        return [
            {"id": t.id, "name": t.name, "pillar": t.pillar, "endpoint": t.endpoint, "digest": t.digest}
            for t in q.all()
        ]


# ---------------------------------------------------------------- red


class StartRun(BaseModel):
    target_id: str
    iteration: int | None = None


def _run_loop(target_id: str, run_key: str, iteration: int) -> None:
    def progress(ev: dict) -> None:
        with _lock:
            EVENTS[run_key].append(ev)
            if ev.get("run_id"):
                RUN_STATE[run_key] = ev["run_id"]

    try:
        loop.run_iteration(target_id, iteration=iteration, progress=progress, criteria=ExitCriteria())
        with _lock:
            EVENTS[run_key].append({"event": "loop.progress", "node": "finished", "message": "done"})
    except Exception as e:
        with _lock:
            EVENTS[run_key].append(
                {"event": "loop.progress", "node": "error", "message": f"{type(e).__name__}: {e}"}
            )


@app.post("/api/v1/red/runs")
def start_run(body: StartRun, bg: BackgroundTasks) -> dict:
    with M.SessionLocal() as s:
        if not s.get(M.Target, body.target_id):
            raise HTTPException(404, "unknown target")
        iteration = body.iteration or (
            s.query(M.LoopRun).filter(M.LoopRun.target_id == body.target_id).count() + 1
        )

    run_key = f"rk_{len(EVENTS) + 1}_{body.target_id[:6]}"
    with _lock:
        EVENTS[run_key] = []
    bg.add_task(_run_loop, body.target_id, run_key, iteration)
    return {"run_key": run_key, "iteration": iteration}


@app.get("/api/v1/red/runs/{run_key}/events")
def run_events(run_key: str, since: int = 0) -> dict:
    """Poll target. `since` is an index, so the client only ever pulls the tail."""
    with _lock:
        evs = EVENTS.get(run_key, [])
        return {
            "events": evs[since:],
            "next": len(evs),
            "run_id": RUN_STATE.get(run_key),
            "finished": any(e.get("node") in ("finished", "error") for e in evs),
        }


@app.get("/api/v1/red/runs/{run_id}/attempts")
def run_attempts(run_id: str, phase: str | None = None, only_success: bool = False) -> list[dict]:
    with M.SessionLocal() as s:
        q = s.query(M.Attempt).filter(M.Attempt.loop_run_id == run_id)
        if phase:
            q = q.filter(M.Attempt.phase == phase)
        if only_success:
            q = q.filter(M.Attempt.verdict.is_(True))
        return [
            {
                "id": a.id, "phase": a.phase, "kind": a.kind, "technique": a.technique,
                "request": a.request, "response": a.response, "verdict": a.verdict,
                "canary_leaked": a.canary_leaked, "judge_model": a.judge_model,
                "judge_rationale": a.judge_rationale, "confidence": a.confidence,
                "latency_ms": round(a.latency_ms, 1),
                "blocked_by_layer": a.blocked_by_layer, "blocked_by_control": a.blocked_by_control,
            }
            for a in q.order_by(M.Attempt.created_at).all()
        ]


@app.get("/api/v1/findings")
def list_findings(run_id: str | None = None) -> list[dict]:
    with M.SessionLocal() as s:
        q = s.query(M.Finding)
        if run_id:
            q = q.filter(M.Finding.loop_run_id == run_id)
        return [
            {"id": f.id, "run_id": f.loop_run_id, "attempt_id": f.attempt_id,
             "technique": f.technique, "severity": f.severity, "title": f.title,
             "summary": f.summary, "status": f.status}
            for f in q.all()
        ]


@app.get("/api/v1/findings/{finding_id}")
def get_finding(finding_id: str) -> dict:
    """A finding always carries its full transcript.

    §1's hard rule — no count without a path — is really a statement about this
    endpoint: there is no way to read a finding without the evidence attached.
    """
    with M.SessionLocal() as s:
        f = s.get(M.Finding, finding_id)
        if not f:
            raise HTTPException(404, "unknown finding")
        a = s.get(M.Attempt, f.attempt_id)
        return {
            "id": f.id, "technique": f.technique, "severity": f.severity, "title": f.title,
            "summary": f.summary, "status": f.status,
            "transcript": {
                "attempt_id": a.id, "request": a.request, "response": a.response,
                "verdict": a.verdict, "canary_leaked": a.canary_leaked,
                "judge_model": a.judge_model, "judge_rationale": a.judge_rationale,
                "confidence": a.confidence, "latency_ms": round(a.latency_ms, 1),
            },
        }


# ---------------------------------------------------------------- blue


@app.get("/api/v1/blue/bundles")
def list_bundles(target_id: str | None = None) -> list[dict]:
    with M.SessionLocal() as s:
        q = s.query(M.PolicyBundle)
        if target_id:
            q = q.filter(M.PolicyBundle.target_id == target_id)
        return [
            {"id": b.id, "version": b.version, "hash": b.hash, "summary": b.summary,
             "status": b.status, "run_id": b.loop_run_id,
             "controls": len(b.controls),
             "deployed_at": b.deployed_at.isoformat() if b.deployed_at else None}
            for b in q.order_by(M.PolicyBundle.created_at.desc()).all()
        ]


@app.get("/api/v1/blue/bundles/{bundle_id}")
def get_bundle(bundle_id: str) -> dict:
    with M.SessionLocal() as s:
        b = s.get(M.PolicyBundle, bundle_id)
        if not b:
            raise HTTPException(404, "unknown bundle")
        controls = []
        for c in b.controls:
            links = s.query(M.ControlFinding).filter(M.ControlFinding.control_id == c.id).all()
            derived = []
            for ln in links:
                f = s.get(M.Finding, ln.finding_id)
                if f:
                    derived.append({"id": f.id, "title": f.title, "technique": f.technique,
                                    "severity": f.severity})
            controls.append({
                "id": c.id, "layer": c.layer, "kind": c.kind, "rationale": c.rationale,
                "patterns": c.rule_json.get("patterns", []),
                "system_prompt_addendum": c.rule_json.get("system_prompt_addendum", ""),
                "derived_from": derived,
            })
        controls.sort(key=lambda c: c["layer"])
        return {"id": b.id, "version": b.version, "hash": b.hash, "summary": b.summary,
                "status": b.status, "run_id": b.loop_run_id, "controls": controls}


@app.post("/api/v1/blue/bundles/{bundle_id}/rollback")
def rollback(bundle_id: str) -> dict:
    """Reversible in one call — the whole argument for compiling policy instead
    of fine-tuning. You cannot roll back a set of weights."""
    from datetime import datetime, timezone

    with M.SessionLocal() as s:
        b = s.get(M.PolicyBundle, bundle_id)
        if not b:
            raise HTTPException(404, "unknown bundle")
        before = b.status
        b.status = "rolled_back"
        b.rolled_back_at = datetime.now(timezone.utc)
        s.add(M.AuditLog(action="bundle.rollback", entity=f"policy_bundle:{bundle_id}",
                         before={"status": before}, after={"status": "rolled_back"}))
        s.commit()
        return {"id": b.id, "status": b.status}


# ---------------------------------------------------------------- purple


@app.get("/api/v1/purple/loops/{run_id}/titer")
def get_titer(run_id: str) -> dict:
    with M.SessionLocal() as s:
        t = s.query(M.Titer).filter(M.Titer.loop_run_id == run_id).first()
        if not t:
            raise HTTPException(404, "no titer for this run")
        return {
            "asr_seeded": t.asr_seeded, "asr_holdout": t.asr_holdout,
            "fp_rate_benign": t.fp_rate_benign, "latency_delta_ms": t.latency_delta_ms,
            "asr_seeded_before": t.asr_seeded_before, "asr_holdout_before": t.asr_holdout_before,
            "converged": t.converged,
            "criteria": ExitCriteria().model_dump(),
        }


@app.get("/api/v1/purple/loops")
def list_loops(target_id: str | None = None) -> list[dict]:
    with M.SessionLocal() as s:
        q = s.query(M.LoopRun)
        if target_id:
            q = q.filter(M.LoopRun.target_id == target_id)
        out = []
        for r in q.order_by(M.LoopRun.started_at.desc()).all():
            t = s.query(M.Titer).filter(M.Titer.loop_run_id == r.id).first()
            out.append({
                "id": r.id, "iteration": r.iteration, "status": r.status,
                "trigger": r.trigger,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "findings": s.query(M.Finding).filter(M.Finding.loop_run_id == r.id).count(),
                "titer": None if not t else {
                    "asr_seeded": t.asr_seeded, "asr_holdout": t.asr_holdout,
                    "fp_rate_benign": t.fp_rate_benign, "latency_delta_ms": t.latency_delta_ms,
                    "asr_holdout_before": t.asr_holdout_before, "converged": t.converged,
                },
            })
        return out


@app.get("/api/v1/purple/loops/{run_id}/record")
def get_record(run_id: str) -> dict:
    with M.SessionLocal() as s:
        r = s.query(M.AssuranceRecord).filter(M.AssuranceRecord.loop_run_id == run_id).first()
        if not r:
            raise HTTPException(404, "no assurance record for this run")
        rec = {"payload": r.payload_json, "prev_hash": r.prev_hash, "self_hash": r.self_hash,
               "signature": r.signature, "public_key_id": r.public_key_id}
        # Verified server-side on read, so the UI shows a checked claim rather
        # than a stored boolean somebody could have flipped.
        return {**rec, "verified": signing.verify_record(rec)}


@app.get("/api/v1/.well-known/purplix-key")
def public_key() -> dict:
    return {"public_key_id": signing.public_key_id(), "public_key_pem": signing.public_key_pem(),
            "algorithm": "Ed25519"}


# ---------------------------------------------------------------- dashboard


@app.get("/api/v1/dashboard/summary")
def dashboard_summary() -> dict:
    with M.SessionLocal() as s:
        runs = s.query(M.LoopRun).order_by(M.LoopRun.started_at.desc()).all()
        latest_titer = (
            s.query(M.Titer).order_by(M.Titer.created_at.desc()).first()
        )
        open_findings = s.query(M.Finding).filter(M.Finding.status == "open").count()
        targets = s.query(M.Target).all()

        return {
            "kpis": {
                "targets": len(targets),
                "loop_runs": len(runs),
                "open_findings": open_findings,
                "asr_holdout": latest_titer.asr_holdout if latest_titer else None,
                "asr_holdout_before": latest_titer.asr_holdout_before if latest_titer else None,
                "fp_rate": latest_titer.fp_rate_benign if latest_titer else None,
                "latency_delta_ms": latest_titer.latency_delta_ms if latest_titer else None,
                "converged": latest_titer.converged if latest_titer else None,
            },
            "coverage": [
                {"pillar": p,
                 "targets": sum(1 for t in targets if t.pillar == p),
                 "runs": sum(1 for r in runs if s.get(M.Target, r.target_id) and s.get(M.Target, r.target_id).pillar == p)}
                for p in ("model", "agent", "app")
            ],
            "recent_runs": [
                {"id": r.id, "iteration": r.iteration, "status": r.status,
                 "started_at": r.started_at.isoformat() if r.started_at else None,
                 "target": (s.get(M.Target, r.target_id).name if s.get(M.Target, r.target_id) else "?")}
                for r in runs[:8]
            ],
            "exposures": [
                {"id": f.id, "title": f.title, "severity": f.severity, "technique": f.technique,
                 "status": f.status}
                for f in s.query(M.Finding).order_by(M.Finding.id.desc()).limit(10).all()
            ],
        }
