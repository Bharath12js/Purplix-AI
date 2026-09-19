"""Attack/benign pack loading and hashing.

Pack hash goes into the assurance record: a result is only meaningful if you
can say which corpus produced it.

A pack is per-pillar. Sprint 0 shipped only `packs/model/`, and the loader was
called `load_model_pack()` — a name that quietly assumed there would only ever
be one pillar. Standing up a second target (the demo-app, `app` pillar) needs a
second corpus with a different shape: its cases carry a deterministic `expect`
oracle and a `probe` describing the HTTP interaction, because an app finding is
a boundary crossing measured by a canary, not a judge's opinion of a chat reply.
`load_pack(pillar)` is the general form; `load_model_pack()` stays as the alias
the existing model loop and tests already call.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import yaml

PACKS_DIR = Path(__file__).resolve().parent.parent / "packs"


@dataclass
class Expectation:
    """Deterministic success oracle for one case, parsed from `expect:`.

    kind:
      canary   — the named canary string must appear in the scored response
      contains — a literal substring must appear
      status   — the scored HTTP status must equal `value`
      judge    — no deterministic signal; the LLM judge decides (the default)

    A case with no `expect` block is `judge` — honest about having no ground
    truth rather than scoring an unjudgeable case as a failure.
    """

    kind: str = "judge"
    id: str = ""
    value: str = ""


@dataclass
class Case:
    technique: str
    payload: str
    objective: str = "leak_canary"
    severity: str = "high"
    taxonomy: str = ""
    is_holdout: bool = False
    expect: Expectation = field(default_factory=Expectation)
    # For app/agent pillars: the concrete interaction to run. None for model
    # pillar, where the payload IS the whole interaction (a single chat turn).
    probe: dict | None = None


@dataclass
class BenignItem:
    payload: str
    expected_behaviour: str = ""
    probe: dict | None = None


@dataclass
class Pack:
    name: str
    version: str
    pillar: str
    source: str = "in-house"
    cases: list[Case] = field(default_factory=list)
    benign: list[BenignItem] = field(default_factory=list)
    hash: str = ""


def _hash_file(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def _expect(raw: dict) -> Expectation:
    e = raw.get("expect")
    if not e:
        return Expectation()
    return Expectation(kind=e.get("kind", "judge"), id=e.get("id", ""), value=str(e.get("value", "")))


def _case(raw: dict, is_holdout: bool) -> Case:
    return Case(
        technique=raw["technique"],
        payload=raw["payload"].strip(),
        objective=raw.get("objective", "leak_canary"),
        severity=raw.get("severity", "high"),
        taxonomy=raw.get("taxonomy", ""),
        is_holdout=is_holdout,
        expect=_expect(raw),
        probe=raw.get("probe"),
    )


def load_pack(pillar: str) -> Pack:
    """Load the seeded + holdout + benign corpus for one pillar."""
    base = PACKS_DIR / pillar
    seeded_f, holdout_f, benign_f = base / "seeded.yaml", base / "holdout.yaml", base / "benign.yaml"

    seeded = yaml.safe_load(seeded_f.read_text(encoding="utf-8"))
    holdout = yaml.safe_load(holdout_f.read_text(encoding="utf-8"))
    benign = yaml.safe_load(benign_f.read_text(encoding="utf-8"))

    cases = [_case(c, False) for c in seeded["cases"]] + [_case(c, True) for c in holdout["cases"]]

    combined = hashlib.sha256(
        "".join(_hash_file(f) for f in (seeded_f, holdout_f, benign_f)).encode()
    ).hexdigest()[:16]

    return Pack(
        name=seeded["name"],
        version=seeded["version"],
        pillar=seeded["pillar"],
        source=seeded.get("source", "in-house"),
        cases=cases,
        benign=[
            BenignItem(
                payload=b["payload"].strip(),
                expected_behaviour=b.get("expected_behaviour", ""),
                probe=b.get("probe"),
            )
            for b in benign["cases"]
        ],
        hash=combined,
    )


def load_model_pack() -> Pack:
    """Back-compat alias — the model loop and invariant tests call this."""
    return load_pack("model")


def seeded_cases(p: Pack) -> list[Case]:
    return [c for c in p.cases if not c.is_holdout]


def holdout_cases(p: Pack) -> list[Case]:
    return [c for c in p.cases if c.is_holdout]
