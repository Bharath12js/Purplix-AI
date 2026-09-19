"""The cross-team contract, as tests.

The three specs agree on a loop but not on a vocabulary, and the places where
they disagree are exactly the places an integration quietly goes wrong. These
tests pin those places down. Like `test_invariants.py` they run with no network
and no API keys — pure structure, which is what makes them worth keeping green
while everything around them moves.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import spec as S
from core import taxonomy as T


# ------------------------------------------------- the L1/L2/L3 collision


def test_aegis_tier_and_enforcement_layer_do_not_collide():
    """AEGIS L2 means "the model"; Purplix L2 means "output gating".

    This is the single most likely integration bug in the codebase: both
    vocabularies use L1/L2/L3, both are load-bearing in their own document, and
    a bare "L2" read off the wire looks identical either way. The translation
    has to be explicit and it has to round-trip.
    """
    assert S.AEGIS_TIER_TO_PILLAR["L2"] == "model"
    assert S.AEGIS_TIER_TO_PILLAR["L1"] == "app"
    assert S.AEGIS_TIER_TO_PILLAR["L3"] == "agent"

    for tier, pillar in S.AEGIS_TIER_TO_PILLAR.items():
        assert S.PILLAR_TO_AEGIS_TIER[pillar] == tier


def test_red_spec_layer_names_map_onto_pillars():
    """The red spec says "application"; Purplix says "app"."""
    assert S.RED_LAYER_TO_PILLAR["application"] == "app"
    assert set(S.RED_LAYER_TO_PILLAR.values()) == {"model", "agent", "app"}


# ------------------------------------------------------- authorization gate


def test_authorization_refuses_a_bare_checkbox():
    with pytest.raises(ValidationError):
        S.Authorization(authorized=True, authorization_reference="   ")


def test_authorization_refuses_authorized_false():
    with pytest.raises(ValidationError):
        S.Authorization(authorized=False, authorization_reference="ENG-2026-0417")


def test_credentials_ref_rejects_a_pasted_secret():
    """Format-only, deliberately — a real key essentially never matches
    identifier syntax, so the cheap check catches the realistic mistake."""
    with pytest.raises(ValueError):
        S.validate_credentials_ref("sk-live-4f9a2c77b1e0")
    assert S.validate_credentials_ref("TARGET_API_KEY") == "TARGET_API_KEY"
    # The explicit escape hatch still works, and has to be asked for by name.
    assert S.validate_credentials_ref("anything", no_auth=True) == "anything"


# -------------------------------------------------- Invariant 1 / I3 / no orphans


def test_control_requires_derived_from():
    """Purplix Invariant 1, AEGIS I3 and the purple spec's "no orphan controls"
    are the same constraint written three times. One of them is enough here."""
    with pytest.raises(ValidationError):
        S.UnifiedControl(
            control_id="c1", derived_from=[], pillar="model", layer="L2",
            control_type="l2.output.canary_gate",
        )


def test_control_cannot_be_active_without_verification():
    """ACTIVE is earned by replaying the probe, not by a deploy call returning
    200. Without this, "proven" degrades into "deployed"."""
    with pytest.raises(ValidationError):
        S.UnifiedControl(
            control_id="c1", derived_from=["f1"], pillar="model", layer="L2",
            control_type="l2.output.canary_gate", state="ACTIVE",
        )


def test_control_with_verification_may_be_active():
    c = S.UnifiedControl(
        control_id="c1", derived_from=["f1"], pillar="model", layer="L2",
        control_type="l2.output.canary_gate", state="ACTIVE",
        verification=S.Verification(
            probe_ref="model.exfil.canary.all_forms.v5", pre_asr=0.88, post_asr=0.0,
            asr_drop_pct=100.0, utility_delta_pct=0.0, added_latency_p95_ms=6,
            verified_at_pass=2,
        ),
    )
    assert c.state == "ACTIVE"


# ------------------------------------------------------------- tier trace


def test_finding_requires_a_tier_trace():
    """AEGIS I1. The trace is what proves an LLM was *not* consulted, and the
    sub-8% invocation-rate claim rests entirely on it being present."""
    with pytest.raises(ValidationError):
        S.UnifiedFinding(
            finding_id="f1", run_id="r1", pillar="model", target_id="tgt_sup",
            source_tool="purplix", title="t", vuln_class="v", technique="x",
            tier_trace=[],
        )


def test_reproduction_rejects_more_successes_than_attempts():
    with pytest.raises(ValidationError):
        S.Reproduction(attempts=10, successes=11, asr=1.1)


# ------------------------------------------------------------- risk score


def test_a_confirmed_critical_cannot_be_averaged_away():
    """The red spec's finding #1. Twenty clean lows beside one landed critical
    must not produce a healthy-looking score."""
    cases = [("critical", True)] + [("low", False)] * 20
    assert S.compute_category_score(cases) <= S.CRITICAL_SCORE_CEILING


def test_clean_sweep_scores_100_and_total_failure_scores_0():
    assert S.compute_category_score([("high", False), ("high", False)]) == 100.0
    assert S.compute_category_score([("high", True), ("high", True)]) == 0.0


def test_informational_moves_the_denominator_not_the_numerator():
    """Weight 0 on purpose: an informational finding is coverage, not damage."""
    assert S.compute_category_score([("informational", True)]) == 100.0


def test_empty_category_is_a_clean_score_not_a_crash():
    assert S.compute_category_score([]) == 100.0


# ---------------------------------------------------------- pass outcomes


def _scorecard(**kw):
    base = dict(asr_seen=0.0, asr_unseen=0.03, fp_rate_benign=0.01, latency_delta_p95_ms=80.0)
    base.update(kw)
    return S.Scorecard(**base)


def test_usability_breach_beats_a_perfect_asr():
    """REGRESSED is checked first on purpose. Excellent ASR next to a blown FP
    budget is precisely what over-blocking looks like, and calling that
    converged is the failure mode the exit criteria exist to prevent."""
    out = S.decide_outcome(
        _scorecard(asr_unseen=0.0, fp_rate_benign=0.13),
        S.ResidualBudget(),
        passes_within_budget=2, unseen_improvement_pts=40, stalled_passes=0, pass_no=1,
    )
    assert out == "REGRESSED"


def test_convergence_requires_the_budget_to_be_sustained():
    budget = S.ResidualBudget()
    one_pass = S.decide_outcome(
        _scorecard(), budget,
        passes_within_budget=1, unseen_improvement_pts=10, stalled_passes=0, pass_no=2,
    )
    two_passes = S.decide_outcome(
        _scorecard(), budget,
        passes_within_budget=2, unseen_improvement_pts=10, stalled_passes=0, pass_no=2,
    )
    assert one_pass == "REITERATE"
    assert two_passes == "CONVERGED"


def test_a_loop_that_stops_improving_stalls_rather_than_grinding_on():
    out = S.decide_outcome(
        _scorecard(asr_unseen=0.30), S.ResidualBudget(),
        passes_within_budget=0, unseen_improvement_pts=0.4, stalled_passes=2, pass_no=3,
    )
    assert out == "STALLED"


def test_pass_budget_exhausts_rather_than_silently_continuing():
    out = S.decide_outcome(
        _scorecard(asr_unseen=0.30), S.ResidualBudget(),
        passes_within_budget=0, unseen_improvement_pts=8, stalled_passes=0, pass_no=5,
    )
    assert out == "EXHAUSTED"


def test_probabilistic_budget_is_not_literal_zero():
    """The pre-mortem's correction. Controls promote at roughly an 80% ASR
    drop, so a residual always remains — demanding zero designs a loop that can
    never stop."""
    b = S.ResidualBudget()
    assert b.max_asr_unseen > 0
    assert b.met_by(_scorecard(asr_unseen=b.max_asr_unseen))
    assert not b.met_by(_scorecard(asr_unseen=b.max_asr_unseen + 0.001))


# ---------------------------------------------------------------- taxonomy


def test_an_unmapped_technique_returns_empty_rather_than_guessing():
    """A wrong framework tag is worse than a missing one: it lands in a
    compliance export and nobody re-checks it."""
    t = T.map_technique("garak", "a.probe.that.does.not.exist")
    assert t.owasp_llm == [] and t.atlas == [] and t.cwe == []


def test_taxonomy_lookup_is_per_tool_not_global():
    """Two tools can use the same technique name for different things, so the
    table is keyed by (tool, technique) and never by technique alone."""
    assert T.map_technique("pyrit", "Crescendo").atlas == ["AML.T0051"]
    assert T.map_technique("garak", "Crescendo").atlas == []


def test_unmapped_techniques_are_surfaced_as_a_gap():
    missing = T.unmapped_techniques("garak", ["dan.DAN", "brand.new.probe"])
    assert missing == ["brand.new.probe"]


def test_corpus_manifest_is_the_real_denominator():
    """`applicable_cases` must be able to exceed `cases_run`. A denominator
    equal to its own numerator always reports full coverage."""
    assert T.get_corpus_size("injecagent", "LLM01") > 40
    # No manifest entry reports zero, which the caller must treat as unknown
    # coverage rather than as complete coverage.
    assert T.get_corpus_size("injecagent", "LLM99") == 0


def test_risk_score_can_report_divergent_coverage():
    r = S.RiskScore(pillar="agent", scope="category", owasp_id="LLM01",
                    score=42.0, applicable_cases=1683, cases_run=40)
    assert r.applicable_cases != r.cases_run


# ---------------------------------------------------------------- adapters


def test_every_pillar_has_at_least_one_adapter():
    for pillar in ("model", "agent", "app"):
        assert T.adapters_for(pillar), f"no adapter registered for {pillar}"


def test_the_nine_red_spec_adapters_are_all_registered():
    expected = {
        "promptfoo", "garak", "pyrit", "harmbench", "precogly",
        "hackagent", "agentharm", "injecagent", "agentdojo",
    }
    assert expected.issubset({a["tool"] for a in T.ADAPTERS})


def test_adapter_pillars_use_purplix_vocabulary():
    """Not "application" — the translation happens at the boundary, once."""
    for a in T.ADAPTERS:
        assert set(a["pillars"]) <= {"model", "agent", "app"}


# ------------------------------------------------------------------ chains


def test_a_chain_needs_at_least_two_hops():
    """A one-hop "chain" is just a finding wearing a hat."""
    with pytest.raises(ValidationError):
        S.CrossLayerChain(
            chain_id="chn", title="t",
            hops=[S.ChainHop(pillar="agent", finding_id="f1", technique="x")],
            end_to_end_asr=0.5, composite_severity="high", cheapest_breaking_hop=1,
        )
