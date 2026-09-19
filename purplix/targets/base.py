"""Target profiles — what the loop needs to know about a thing under test.

Sprint 0 shipped with exactly one target and the engines imported it by name:
`from targets.support_bot import SYSTEM_PROMPT, call_target, canary_leaked`.
That was correct for one target and silently wrong for two — a second target
row in the database would have been attacked by sending its payloads to the
support bot, and every number on screen would have been about the wrong system
while looking perfectly valid.

A profile is the seam. It answers five questions the loop cannot answer for
itself:

    call()              how do I reach this target and what comes back?
    oracle()            did the attack succeed, deterministically?
    judge_rules         what must this target never do (for the LLM judge)?
    fallback_controls() if the policy-compiler LLM is down, what is the
                        evidence-derived defence for THIS target?
    preflight()         is it reachable right now, and if not, say so loudly.

`deterministic_oracle` is the one flag that changes the loop's cost. A target
whose success signal is a canary string needs no judge model at all, which is
why the demo-app target runs end to end with no API keys while the support bot
cannot.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from core.packs import Expectation  # noqa: F401  (re-exported for profiles)
from core.schemas import ControlSpec


@dataclass
class CallResult:
    """One round trip to the target.

    `text` is what the enforcer's L2 gate inspects and what the judge reads.
    `trace` is the step-by-step record for multi-step probes — it is what makes
    a chained finding ("poison a document, then ask a benign question")
    readable as evidence rather than as a single opaque request.
    """

    text: str
    latency_ms: float
    trace: list[dict] = field(default_factory=list)


class TargetUnreachable(RuntimeError):
    """Raised by preflight(). Distinct from LLMError so the loop can say which
    side of the wire failed instead of blaming the model router."""


class TargetProfile:
    """Base class. Subclasses fill in the parts that differ per target."""

    key: str = ""
    pillar: str = "model"
    display_name: str = ""
    endpoint: str = ""
    digest: str = ""
    pack: str = "model"
    deterministic_oracle: bool = False

    # The system prompt the L3 hardening layer is appended to. Empty for
    # targets whose prompt is not ours to edit (the demo app owns its own).
    system_prompt: str = ""

    # Text handed to the judge and to the policy compiler describing what this
    # target must never do. Target-specific by necessity: a compiler prompt
    # written about a refund code produces nonsense controls for a web app.
    judge_rules: str = ""
    policy_brief: str = ""
    fp_warning: str = ""

    def meta(self) -> dict:
        """Stored on the Target row so a run can be replayed against the same
        configuration later."""
        return {"adapter": self.key, "pack": self.pack, "pillar": self.pillar}

    # ------------------------------------------------------------ wire
    def preflight(self) -> None:
        return None

    def call(self, payload: str, system_prompt: str | None = None,
             probe: dict | None = None) -> CallResult:
        raise NotImplementedError

    # ------------------------------------------------------------ scoring
    def oracle(self, text: str, expect: Expectation) -> tuple[bool, str]:
        """Deterministic ground truth. Returns (succeeded, rationale).

        A profile that returns kind="judge" here is saying "I have no ground
        truth for this case" — which is honest, and sends the case to the LLM
        judge rather than scoring it as a failure. Scoring an unjudgeable case
        as a failure is the direction that flatters the product.
        """
        return False, ""

    # ------------------------------------------------------------ defence
    def fallback_controls(self, findings: list[dict]) -> list[ControlSpec]:
        """Evidence-derived controls used when the compiler LLM is unavailable."""
        raise NotImplementedError
