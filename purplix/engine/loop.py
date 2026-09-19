"""The loop — one iteration, end to end.

    plan -> expose -> cluster -> compile -> deploy -> challenge -> titer -> sign

Each step below is a plain function taking and returning `LoopState`. That
shape is not incidental: in Sprint B each one becomes a LangGraph node with a
Postgres checkpointer, so a run RESUMES instead of restarting when a provider
dies mid-flight (R5). Writing them as free functions over an explicit state
dict today costs nothing and makes that migration mechanical.

Persistence and progress events are handled here rather than inside red/blue/
purple so those stay pure and testable.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable

from core import models as M
from core import packs as P
from core import signing
from core.enforcer import PolicyEnforcer
from core.schemas import ExitCriteria, PolicyBundleSpec, TiterSpec
from engine import blue, purple, red
from targets.base import TargetProfile
from targets.registry import profile_for

ProgressFn = Callable[[dict], None]


@dataclass
class LoopState:
    target_id: str
    run_id: str = ""
    iteration: int = 1
    pack: P.Pack | None = None
    profile: TargetProfile | None = None
    criteria: ExitCriteria = field(default_factory=ExitCriteria)

    baseline_seeded: list[dict] = field(default_factory=list)
    baseline_holdout: list[dict] = field(default_factory=list)
    baseline_latencies: list[float] = field(default_factory=list)

    findings: list[dict] = field(default_factory=list)
    bundle: PolicyBundleSpec | None = None
    bundle_id: str = ""
    used_fallback_compiler: bool = False
    control_ids: dict[int, str] = field(default_factory=dict)

    seeded_after: list[dict] = field(default_factory=list)
    holdout_after: list[dict] = field(default_factory=list)
    benign_after: list[dict] = field(default_factory=list)

    titer: TiterSpec | None = None
    record: dict | None = None

    progress: ProgressFn | None = None

    def emit(self, **ev) -> None:
        if self.progress:
            self.progress({"run_id": self.run_id, **ev})


def _save_attempt(s: M.Session, run_id: str, phase: str, kind: str, technique: str, a: dict) -> M.Attempt:
    row = M.Attempt(
        loop_run_id=run_id,
        phase=phase,
        kind=kind,
        technique=technique,
        request=a["request"],
        response=a.get("raw_response") or a["response"],
        latency_ms=a.get("latency_ms", 0.0),
        verdict=bool(a.get("verdict", False)),
        canary_leaked=bool(a.get("canary_leaked", False)),
        tool_trace=a.get("tool_trace", []),
        judge_model=a.get("judge_model", ""),
        judge_rationale=a.get("judge_rationale", ""),
        confidence=a.get("confidence", 0.0),
        blocked_by_layer=a.get("blocked_by_layer"),
        blocked_by_control=a.get("blocked_by_control"),
    )
    s.add(row)
    s.flush()
    return row


# ---------------------------------------------------------------- nodes


def node_plan(st: LoopState) -> LoopState:
    with M.SessionLocal() as s:
        target = s.get(M.Target, st.target_id)
        if not target:
            raise RuntimeError(f"unknown target {st.target_id}")
        st.profile = profile_for(target)
        run = M.LoopRun(target_id=st.target_id, iteration=st.iteration, status="running", trigger="manual")
        s.add(run)
        s.commit()
        st.run_id = run.id

    # A target that isn't reachable should fail here, named, not halfway through
    # exposure with a wall of transport errors that look like blocked attacks.
    st.profile.preflight()
    st.pack = P.load_pack(st.profile.pack)
    st.emit(
        event="loop.progress",
        node="plan",
        message=f"Loaded pack {st.pack.name} v{st.pack.version} "
        f"({len(P.seeded_cases(st.pack))} seeded, {len(P.holdout_cases(st.pack))} held-out, "
        f"{len(st.pack.benign)} benign)",
    )
    return st


def node_expose(st: LoopState) -> LoopState:
    """Exposure: attack the UNDEFENDED target. This is the 'before' column."""
    assert st.pack
    no_policy = PolicyEnforcer(None)

    with M.SessionLocal() as s:
        for c in P.seeded_cases(st.pack):
            a = red.run_case(c, no_policy, st.profile)
            st.baseline_seeded.append(a)
            if a["latency_ms"] > 0:
                st.baseline_latencies.append(a["latency_ms"])
            row = _save_attempt(s, st.run_id, "exposure", "seeded", c.technique, a)

            if a["verdict"]:
                f = red.finding_from_attempt(c, a, st.profile)
                fr = M.Finding(
                    loop_run_id=st.run_id,
                    attempt_id=row.id,
                    technique=c.technique,
                    severity=f["severity"],
                    title=f["title"],
                    summary=f["summary"],
                )
                s.add(fr)
                s.flush()
                st.findings.append(
                    {
                        "id": fr.id,
                        "attempt_id": row.id,
                        "technique": c.technique,
                        "severity": f["severity"],
                        "title": f["title"],
                        "request": a["request"],
                        "response": a["response"],
                    }
                )
                st.emit(event="attempt.new", node="expose", phase="exposure", technique=c.technique,
                        success=True, title=f["title"], attempt_id=row.id, finding_id=fr.id)
            else:
                st.emit(event="attempt.new", node="expose", phase="exposure", technique=c.technique,
                        success=False, title=f"Blocked: {c.technique}", attempt_id=row.id)
            s.commit()

        # Held-out attacks also run undefended, to establish the 'before' number
        # the headline improvement is measured against.
        for c in P.holdout_cases(st.pack):
            a = red.run_case(c, no_policy, st.profile)
            st.baseline_holdout.append(a)
            if a["latency_ms"] > 0:
                st.baseline_latencies.append(a["latency_ms"])
            _save_attempt(s, st.run_id, "exposure", "holdout", c.technique, a)
            s.commit()
            st.emit(event="attempt.new", node="expose", phase="exposure", technique=c.technique,
                    kind="holdout", success=a["verdict"])

    st.emit(event="loop.progress", node="expose",
            message=f"Exposure complete — {len(st.findings)} findings from {len(st.baseline_seeded)} seeded attacks")
    return st


def node_compile(st: LoopState) -> LoopState:
    if not st.findings:
        raise RuntimeError(
            "exposure produced zero findings — nothing to compile. "
            "Check GROQ_API_KEY and that the target is reachable."
        )

    bundle, fallback = blue.compile_policy(st.findings, st.profile)
    st.bundle, st.used_fallback_compiler = bundle, fallback

    with M.SessionLocal() as s:
        pb = M.PolicyBundle(
            target_id=st.target_id,
            loop_run_id=st.run_id,
            version=st.iteration,
            hash=blue.bundle_hash(bundle),
            summary=bundle.summary,
            status="draft",
        )
        s.add(pb)
        s.flush()
        st.bundle_id = pb.id

        for i, c in enumerate(bundle.controls):
            ctrl = M.Control(
                bundle_id=pb.id,
                layer=c.layer,
                kind=c.kind,
                rule_json={"patterns": c.patterns, "system_prompt_addendum": c.system_prompt_addendum},
                rationale=c.rationale,
            )
            s.add(ctrl)
            s.flush()
            st.control_ids[i] = ctrl.id
            # Invariant 1: the link rows are written in the SAME transaction as
            # the control. There is never a moment where an unlinked control
            # exists in the database.
            for fid in c.derived_from:
                s.add(M.ControlFinding(control_id=ctrl.id, finding_id=fid))
        s.commit()

    st.emit(event="loop.progress", node="compile",
            message=f"Compiled {len(bundle.controls)} controls"
                    f"{' (fallback compiler)' if fallback else ''} — bundle {st.bundle_id}")
    return st


def node_deploy(st: LoopState) -> LoopState:
    with M.SessionLocal() as s:
        pb = s.get(M.PolicyBundle, st.bundle_id)
        pb.status = "deployed"
        pb.deployed_at = datetime.now(timezone.utc)
        s.add(M.AuditLog(action="bundle.deploy", entity=f"policy_bundle:{st.bundle_id}",
                         after={"status": "deployed", "hash": pb.hash}))
        s.commit()
    st.emit(event="loop.progress", node="deploy", message=f"Bundle {st.bundle_id} deployed (inline wrapper)")
    return st


def node_challenge(st: LoopState) -> LoopState:
    assert st.pack and st.bundle
    enforcer = PolicyEnforcer(st.bundle, st.control_ids)

    def on_progress(phase, kind, case, attempt):
        st.emit(event="attempt.new", node="challenge", phase=phase, kind=kind,
                technique=getattr(case, "technique", "benign"),
                success=attempt.get("verdict", False) or attempt.get("false_positive", False),
                blocked=attempt.get("blocked_by_layer"))

    st.seeded_after, st.holdout_after, st.benign_after = purple.challenge(
        P.seeded_cases(st.pack), P.holdout_cases(st.pack), st.pack.benign, enforcer, on_progress,
        profile=st.profile,
    )

    with M.SessionLocal() as s:
        for a in st.seeded_after:
            _save_attempt(s, st.run_id, "challenge", "seeded", a["_case"].technique, a)
        for a in st.holdout_after:
            _save_attempt(s, st.run_id, "challenge", "holdout", a["_case"].technique, a)
        for b in st.benign_after:
            _save_attempt(s, st.run_id, "challenge", "benign", "benign",
                          {**b, "verdict": b["false_positive"], "confidence": 1.0,
                           "judge_model": "benign-probe", "canary_leaked": False})
        s.commit()

    st.emit(event="loop.progress", node="challenge", message="Challenge complete")
    return st


def node_titer(st: LoopState) -> LoopState:
    t = purple.compute_titer(
        st.seeded_after, st.holdout_after, st.benign_after, st.baseline_latencies, st.criteria
    )
    st.titer = t

    with M.SessionLocal() as s:
        # Invariant 2: one INSERT, all four metrics, or the transaction rolls
        # back and no titer exists for this run at all.
        s.add(
            M.Titer(
                loop_run_id=st.run_id,
                asr_seeded=t.asr_seeded,
                asr_holdout=t.asr_holdout,
                fp_rate_benign=t.fp_rate_benign,
                latency_delta_ms=t.latency_delta_ms,
                asr_seeded_before=purple.asr(st.baseline_seeded),
                asr_holdout_before=purple.asr(st.baseline_holdout),
                converged=t.converged,
            )
        )
        s.commit()

    st.emit(event="titer.update", node="titer", titer=t.model_dump(),
            before={"asr_seeded": purple.asr(st.baseline_seeded),
                    "asr_holdout": purple.asr(st.baseline_holdout)})
    return st


def node_sign(st: LoopState) -> LoopState:
    assert st.titer and st.pack and st.bundle

    with M.SessionLocal() as s:
        prev = (
            s.query(M.AssuranceRecord)
            .filter(M.AssuranceRecord.target_id == st.target_id)
            .order_by(M.AssuranceRecord.signed_at.desc())
            .first()
        )
        prev_hash = prev.self_hash if prev else ""
        target = s.get(M.Target, st.target_id)

        payload = {
            "schema": "purplix.assurance/v1",
            "run_id": st.run_id,
            "iteration": st.iteration,
            "target": {"id": st.target_id, "name": target.name, "pillar": target.pillar,
                       "digest": target.digest},
            "attack_pack": {"name": st.pack.name, "version": st.pack.version, "hash": st.pack.hash,
                            "source": st.pack.source},
            "policy_bundle": {"id": st.bundle_id, "hash": blue.bundle_hash(st.bundle),
                              "controls": len(st.bundle.controls)},
            "results": st.titer.model_dump(),
            "baseline": {"asr_seeded": purple.asr(st.baseline_seeded),
                         "asr_holdout": purple.asr(st.baseline_holdout)},
            "exit_criteria": st.criteria.model_dump(),
            "signed_at": datetime.now(timezone.utc).isoformat(),
        }
        rec = signing.sign_record(payload, prev_hash)
        s.add(
            M.AssuranceRecord(
                loop_run_id=st.run_id,
                target_id=st.target_id,
                payload_json=rec["payload"],
                prev_hash=rec["prev_hash"],
                self_hash=rec["self_hash"],
                signature=rec["signature"],
                public_key_id=rec["public_key_id"],
            )
        )
        run = s.get(M.LoopRun, st.run_id)
        run.status = "converged" if st.titer.converged else "complete"
        run.ended_at = datetime.now(timezone.utc)
        s.commit()

    st.record = rec
    st.emit(event="loop.progress", node="sign",
            message=f"Assurance record signed (key {rec['public_key_id']}, chained to {prev_hash[:8] or 'genesis'})")
    return st


# ---------------------------------------------------------------- driver

NODES = [node_plan, node_expose, node_compile, node_deploy, node_challenge, node_titer, node_sign]


def run_iteration(target_id: str, iteration: int = 1, progress: ProgressFn | None = None,
                  criteria: ExitCriteria | None = None) -> LoopState:
    st = LoopState(target_id=target_id, iteration=iteration, progress=progress,
                   criteria=criteria or ExitCriteria())
    t0 = time.perf_counter()
    try:
        for node in NODES:
            st = node(st)
    except Exception as e:
        if st.run_id:
            with M.SessionLocal() as s:
                run = s.get(M.LoopRun, st.run_id)
                if run:
                    run.status = "failed"
                    run.ended_at = datetime.now(timezone.utc)
                    s.commit()
        st.emit(event="loop.progress", node="error", message=f"{type(e).__name__}: {e}")
        raise
    st.emit(event="loop.progress", node="done",
            message=f"Iteration {iteration} complete in {time.perf_counter() - t0:.1f}s")
    return st
