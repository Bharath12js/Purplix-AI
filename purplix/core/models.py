"""SQLAlchemy models — the §5 tables.

Sprint 0 runs these on SQLite; Sprint A repoints the same models at Postgres.
That is the whole reason to use a real ORM on day one rather than dicts.

`tenant_id` columns are present and defaulted even though Sprint 0 is
single-tenant. Retrofitting tenancy onto a schema that never had it is one of
the more miserable migrations there is, and the column costs nothing now.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

DEFAULT_TENANT = "t_purplix"


def _uid() -> str:
    return uuid.uuid4().hex[:16]


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Target(Base):
    __tablename__ = "target"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    tenant_id: Mapped[str] = mapped_column(String(32), default=DEFAULT_TENANT)
    pillar: Mapped[str] = mapped_column(String(16))  # model|agent|app
    name: Mapped[str] = mapped_column(String(128))
    endpoint: Mapped[str] = mapped_column(String(256), default="")
    digest: Mapped[str] = mapped_column(String(64), default="")
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AttackPack(Base):
    __tablename__ = "attack_pack"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    pillar: Mapped[str] = mapped_column(String(16))
    name: Mapped[str] = mapped_column(String(128))
    version: Mapped[str] = mapped_column(String(32), default="1.0")
    hash: Mapped[str] = mapped_column(String(64), default="")
    source: Mapped[str] = mapped_column(String(64), default="in-house")  # D2
    cases: Mapped[list["AttackCase"]] = relationship(back_populates="pack")


class AttackCase(Base):
    __tablename__ = "attack_case"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    pack_id: Mapped[str] = mapped_column(ForeignKey("attack_pack.id"))
    technique: Mapped[str] = mapped_column(String(64))
    taxonomy: Mapped[str] = mapped_column(String(64), default="")  # OWASP/ATLAS id, D2
    severity: Mapped[str] = mapped_column(String(16), default="high")
    payload: Mapped[str] = mapped_column(Text)
    objective: Mapped[str] = mapped_column(Text, default="")
    is_holdout: Mapped[bool] = mapped_column(Boolean, default=False)
    pack: Mapped[AttackPack] = relationship(back_populates="cases")


class BenignCase(Base):
    __tablename__ = "benign_case"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    pack_id: Mapped[str] = mapped_column(ForeignKey("attack_pack.id"))
    payload: Mapped[str] = mapped_column(Text)
    expected_behaviour: Mapped[str] = mapped_column(Text, default="")


class LoopRun(Base):
    __tablename__ = "loop_run"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    tenant_id: Mapped[str] = mapped_column(String(32), default=DEFAULT_TENANT)
    target_id: Mapped[str] = mapped_column(ForeignKey("target.id"))
    iteration: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    trigger: Mapped[str] = mapped_column(String(16), default="manual")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Attempt(Base):
    """One attack (or benign probe) against the target. THE transcript row.

    Every number in the UI resolves down to one of these — the §1 rule, "no
    count without a path", is really a statement about this table.
    """

    __tablename__ = "attempt"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    loop_run_id: Mapped[str] = mapped_column(ForeignKey("loop_run.id"))
    attack_case_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phase: Mapped[str] = mapped_column(String(16))  # exposure|challenge
    kind: Mapped[str] = mapped_column(String(16), default="seeded")  # seeded|holdout|benign
    technique: Mapped[str] = mapped_column(String(64), default="")
    request: Mapped[str] = mapped_column(Text)
    response: Mapped[str] = mapped_column(Text, default="")
    tool_trace: Mapped[list] = mapped_column(JSON, default=list)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    verdict: Mapped[bool] = mapped_column(Boolean, default=False)
    canary_leaked: Mapped[bool] = mapped_column(Boolean, default=False)
    judge_model: Mapped[str] = mapped_column(String(64), default="")
    judge_rationale: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    blocked_by_layer: Mapped[str | None] = mapped_column(String(8), nullable=True)
    blocked_by_control: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class Finding(Base):
    __tablename__ = "finding"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    loop_run_id: Mapped[str] = mapped_column(ForeignKey("loop_run.id"))
    attempt_id: Mapped[str] = mapped_column(ForeignKey("attempt.id"))
    technique: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16), default="high")
    title: Mapped[str] = mapped_column(String(256))
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="open")


class PolicyBundle(Base):
    __tablename__ = "policy_bundle"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    target_id: Mapped[str] = mapped_column(ForeignKey("target.id"))
    loop_run_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    hash: Mapped[str] = mapped_column(String(64), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|deployed|rolled_back
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rolled_back_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    controls: Mapped[list["Control"]] = relationship(back_populates="bundle")


class Control(Base):
    __tablename__ = "control"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    bundle_id: Mapped[str] = mapped_column(ForeignKey("policy_bundle.id"))
    layer: Mapped[str] = mapped_column(String(8))
    kind: Mapped[str] = mapped_column(String(64))
    rule_json: Mapped[dict] = mapped_column(JSON, default=dict)
    rationale: Mapped[str] = mapped_column(Text, default="")
    bundle: Mapped[PolicyBundle] = relationship(back_populates="controls")
    links: Mapped[list["ControlFinding"]] = relationship(back_populates="control")


class ControlFinding(Base):
    """The derived_from link. Invariant 1 — NOT NULLABLE, both columns."""

    __tablename__ = "control_finding"
    control_id: Mapped[str] = mapped_column(ForeignKey("control.id"), primary_key=True)
    finding_id: Mapped[str] = mapped_column(ForeignKey("finding.id"), primary_key=True)
    control: Mapped[Control] = relationship(back_populates="links")


class Titer(Base):
    __tablename__ = "titer"
    __table_args__ = (
        # Invariant 2, at the storage layer: a partial titer cannot be stored.
        CheckConstraint(
            "asr_seeded >= 0 AND asr_holdout >= 0 AND fp_rate_benign >= 0",
            name="ck_titer_complete",
        ),
    )
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    loop_run_id: Mapped[str] = mapped_column(ForeignKey("loop_run.id"))
    asr_seeded: Mapped[float] = mapped_column(Float, nullable=False)
    asr_holdout: Mapped[float] = mapped_column(Float, nullable=False)
    fp_rate_benign: Mapped[float] = mapped_column(Float, nullable=False)
    latency_delta_ms: Mapped[float] = mapped_column(Float, nullable=False)
    asr_seeded_before: Mapped[float] = mapped_column(Float, default=0.0)
    asr_holdout_before: Mapped[float] = mapped_column(Float, default=0.0)
    converged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AssuranceRecord(Base):
    __tablename__ = "assurance_record"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    loop_run_id: Mapped[str] = mapped_column(ForeignKey("loop_run.id"))
    target_id: Mapped[str] = mapped_column(String(32))
    payload_json: Mapped[dict] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64), default="")  # D3 hash chain
    self_hash: Mapped[str] = mapped_column(String(64), default="")
    signature: Mapped[str] = mapped_column(Text, default="")
    public_key_id: Mapped[str] = mapped_column(String(64), default="")
    signed_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uid)
    tenant_id: Mapped[str] = mapped_column(String(32), default=DEFAULT_TENANT)
    actor_id: Mapped[str] = mapped_column(String(64), default="demo")
    action: Mapped[str] = mapped_column(String(64))
    entity: Mapped[str] = mapped_column(String(128), default="")
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime, default=_now)


# ---------------------------------------------------------------- engine


from pathlib import Path  # noqa: E402

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "purplix.sqlite"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_conn, _rec):
    cur = dbapi_conn.cursor()
    # CHECK constraints are on by default, but FKs are NOT in SQLite unless
    # asked — and Invariant 1 leans on them.
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.close()


def init_db(drop: bool = False) -> None:
    if drop:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
