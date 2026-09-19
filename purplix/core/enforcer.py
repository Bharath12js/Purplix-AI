"""PolicyEnforcer — the single enforcement core (D1).

One entrypoint, written once:

    enforce_input(bundle, text)  -> EnforcementResult      # L1
    enforce_output(bundle, text) -> EnforcementResult      # L2
    harden(bundle, system)       -> str                    # L3

Sprint 0 calls this in-process. Sprint B repackages the SAME class three ways
without touching the logic:

    app   -> ASGI middleware        (sees auth context + retrieved chunks)
    model -> reverse-proxy sidecar  (zero customer code change)
    agent -> SDK callback hooks     (tool-call interception is impossible at
                                     the network edge — you must sit inside
                                     the agent loop)

That is why placement was never really the decision; packaging was.
"""

from __future__ import annotations

import re
import time

from core.schemas import EnforcementResult, PolicyBundleSpec

# Compiled-pattern cache: a policy bundle is re-applied across hundreds of
# attempts in a challenge phase, and re-compiling regexes each time is exactly
# the kind of avoidable cost that turns up as latency_delta_ms on stage.
_compiled: dict[str, re.Pattern | None] = {}


def _compile(pattern: str) -> re.Pattern | None:
    if pattern not in _compiled:
        try:
            _compiled[pattern] = re.compile(pattern, re.IGNORECASE | re.DOTALL)
        except re.error:
            # A compiler-authored regex that doesn't compile is a bad control,
            # not a crash. It is skipped and stays visible in the bundle so a
            # human can see the compiler produced junk.
            _compiled[pattern] = None
    return _compiled[pattern]


class PolicyEnforcer:
    """Stateless w.r.t. requests; holds a bundle and applies it."""

    def __init__(self, bundle: PolicyBundleSpec | None, control_ids: dict[int, str] | None = None) -> None:
        self.bundle = bundle
        # index in bundle.controls -> DB control id, so a block can name the
        # exact control that fired and the UI can link it to its evidence.
        self.control_ids = control_ids or {}
        self.last_overhead_ms = 0.0

    # ------------------------------------------------------------ L1
    def enforce_input(self, text: str) -> EnforcementResult:
        t0 = time.perf_counter()
        try:
            if not self.bundle:
                return EnforcementResult(allowed=True)
            for i, c in enumerate(self.bundle.controls):
                if c.layer != "L1":
                    continue
                for p in c.patterns:
                    rx = _compile(p)
                    if rx and rx.search(text):
                        return EnforcementResult(
                            allowed=False,
                            layer="L1",
                            control_id=self.control_ids.get(i),
                            reason=f"input matched {c.kind}: /{p}/",
                        )
            return EnforcementResult(allowed=True)
        finally:
            self.last_overhead_ms += (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------ L2
    def enforce_output(self, text: str) -> EnforcementResult:
        t0 = time.perf_counter()
        try:
            if not self.bundle:
                return EnforcementResult(allowed=True)
            for i, c in enumerate(self.bundle.controls):
                if c.layer != "L2":
                    continue
                for p in c.patterns:
                    rx = _compile(p)
                    if rx and rx.search(text):
                        return EnforcementResult(
                            allowed=False,
                            layer="L2",
                            control_id=self.control_ids.get(i),
                            reason=f"output gated by {c.kind}: /{p}/",
                        )
            return EnforcementResult(allowed=True)
        finally:
            self.last_overhead_ms += (time.perf_counter() - t0) * 1000

    # ------------------------------------------------------------ L3
    def harden(self, system_prompt: str) -> str:
        if not self.bundle:
            return system_prompt
        adds = [c.system_prompt_addendum for c in self.bundle.controls if c.layer == "L3" and c.system_prompt_addendum]
        if not adds:
            return system_prompt
        return system_prompt + "\n\n# Hardening (compiled by Purplix Blue)\n" + "\n".join(f"- {a}" for a in adds)

    def reset_overhead(self) -> None:
        self.last_overhead_ms = 0.0


BLOCK_MESSAGE = (
    "I can't help with that request. If you believe this is a mistake, "
    "please rephrase or contact support."
)
