"""Technique -> taxonomy mapping and the corpus-size manifest (Red spec 2.4 / 2.5).

Two static, hand-curated, versioned tables. Both are deliberately NOT a live
dependency on any one tool's own categorisation:

1. `TAXONOMY_MAP` — per-tool technique -> OWASP/ATLAS/CWE/ASI. If each adapter
   inherited its tool's own labels, findings from two tools would end up tagged
   against two different revisions of the same category, and the coverage
   matrix would silently double-count. Re-sync this file **as one unit** when
   the taxonomy revises.

2. `CORPUS_MANIFEST` — how many cases each benchmark actually holds per
   category. This is the real denominator. Without it, "coverage" is a number
   divided by itself, which always looks like 100%.

Both tables are versioned together (`TAXONOMY_VERSION`) because a coverage
figure is only interpretable against the pair.
"""

from __future__ import annotations

from core.spec import Taxonomy

TAXONOMY_VERSION = "2026.09-owasp-llm-2026r1"

# ---------------------------------------------------------------- techniques

#: Seeded from each tool's own mapping at authoring time, then owned here.
#: Purplix's in-house techniques sit under the `purplix` key alongside the
#: wrapped OSS tools — the loop does not care who authored a probe, only that
#: the label is stable across passes.
TAXONOMY_MAP: dict[str, dict[str, dict[str, list[str]]]] = {
    "purplix": {
        "authority_impersonation": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0051"], "cwe": ["CWE-1427"]},
        "prefix_injection": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0051"], "cwe": ["CWE-1427"]},
        "role_play_override": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
        "context_poisoning": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0051"]},
        "refusal_suppression": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
        "hypothetical_framing": {"owasp_llm": ["LLM06"], "atlas": ["AML.T0054"]},
        "encoding_base64": {"owasp_llm": ["LLM02"], "atlas": ["AML.T0057"]},
        "multilingual_pivot": {"owasp_llm": ["LLM06"], "atlas": ["AML.T0054"]},
        "leetspeak_cipher": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
    },
    "promptfoo": {
        "jailbreak:composite": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
        "pii:direct": {"owasp_llm": ["LLM02"], "cwe": ["CWE-359"]},
        "indirect-prompt-injection": {"owasp_llm": ["LLM01"], "owasp_asi": ["ASI01"], "cwe": ["CWE-1427"]},
        "agentic:tool-misuse": {"owasp_llm": ["LLM06"], "owasp_asi": ["ASI02"]},
    },
    "garak": {
        "dan.DAN": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
        "leakreplay": {"owasp_llm": ["LLM02"], "atlas": ["AML.T0057"]},
        "encoding.InjectBase64": {"owasp_llm": ["LLM02"], "atlas": ["AML.T0057"]},
    },
    "pyrit": {
        "Crescendo": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0051"]},
        "SkeletonKey": {"owasp_llm": ["LLM01"], "atlas": ["AML.T0054"]},
        "xpia": {"owasp_llm": ["LLM01"], "owasp_asi": ["ASI01"], "cwe": ["CWE-1427"]},
    },
    "hackagent": {
        "AdvPrefix": {"owasp_llm": ["LLM01"]},
        "AutoDAN-Turbo": {"owasp_llm": ["LLM01"]},
        "PAIR": {"owasp_llm": ["LLM01"]},
    },
    "agentharm": {
        "fraud": {"owasp_llm": ["LLM06"], "owasp_asi": ["ASI02"]},
        "cybercrime": {"owasp_llm": ["LLM01"], "owasp_asi": ["ASI02"]},
    },
    "injecagent": {
        "tool-response-injection": {"owasp_llm": ["LLM01"], "owasp_asi": ["ASI01"], "cwe": ["CWE-1427"]},
    },
    "agentdojo": {
        "workspace-injection": {"owasp_llm": ["LLM01"], "owasp_asi": ["ASI01"]},
    },
    "precogly": {
        "tool_scope_escalation": {"owasp_llm": ["LLM06"], "owasp_asi": ["ASI02"], "atlas": ["AML.T0053"]},
        "memory_poisoning": {"owasp_asi": ["ASI04"], "atlas": ["AML.T0051"]},
        "unrestricted_egress": {"owasp_asi": ["ASI05", "ASI10"], "cwe": ["CWE-918"]},
    },
    "harmbench": {
        "standard": {"owasp_llm": ["LLM01"]},
        "contextual": {"owasp_llm": ["LLM01"]},
    },
}

#: Defensive counterpart — D3FEND technique per control type. The blue spec
#: carries this on the control, not the finding, which is what lets a
#: compliance row point at a *defence* rather than only at a hole.
D3FEND_BY_CONTROL_TYPE: dict[str, list[str]] = {
    "l1.input.structural_detector": ["D3-IAA"],
    "l1.waf.crs_rule": ["D3-IAA"],
    "l2.output.canary_gate": ["D3-OTF"],
    "l2.input.injection_classifier": ["D3-MAC"],
    "l2.output.content_classifier": ["D3-OTF"],
    "l3.prompt.instruction_hierarchy": ["D3-MAC"],
    "l3.tool.scope_policy": ["D3-EAL"],
    "l3.egress.allowlist": ["D3-OTF"],
    "l3.approval.gate": ["D3-EAL"],
}


def map_technique(tool_name: str, technique: str) -> Taxonomy:
    """Red spec 2.4. Called by every adapter's `normalize()`.

    An unmapped technique returns an EMPTY taxonomy rather than a guess. A
    wrong framework tag is worse than a missing one: it lands in a compliance
    export and nobody re-checks it.
    """
    entry = TAXONOMY_MAP.get(tool_name, {}).get(technique, {})
    return Taxonomy(
        owasp_llm=list(entry.get("owasp_llm", [])),
        owasp_asi=list(entry.get("owasp_asi", [])),
        atlas=list(entry.get("atlas", [])),
        cwe=list(entry.get("cwe", [])),
        d3fend=list(entry.get("d3fend", [])),
    )


def unmapped_techniques(tool_name: str, techniques: list[str]) -> list[str]:
    """What this tool emitted that the table does not know about.

    Surfaced rather than swallowed: an unmapped technique is a coverage gap in
    *our* table, and it should show up as a to-do, not vanish.
    """
    known = TAXONOMY_MAP.get(tool_name, {})
    return [t for t in techniques if t not in known]


# ---------------------------------------------------------------- corpora

#: Total case counts per tool per OWASP category, counted once against each
#: benchmark's real dataset. `cases_run` (what a pass executed) is tracked
#: separately and the two are expected to diverge — that gap is the coverage
#: statement, and hiding it is how "we tested LLM01" comes to mean nothing.
CORPUS_MANIFEST: dict[str, dict[str, int]] = {
    "harmbench": {"LLM01": 200, "LLM02": 45},
    "agentharm": {"LLM06": 30, "LLM01": 25},
    "injecagent": {"LLM01": 1054},
    "agentdojo": {"LLM01": 629},
    "garak": {"LLM01": 118, "LLM02": 64},
    "promptfoo": {"LLM01": 86, "LLM02": 31, "LLM06": 24},
    "pyrit": {"LLM01": 72},
    "purplix": {"LLM01": 12, "LLM02": 4, "LLM06": 6},
}


def get_corpus_size(tool_name: str, owasp_id: str) -> int:
    """The real denominator. Zero means "we have no manifest entry" — which the
    caller must report as unknown coverage, never as full coverage."""
    return CORPUS_MANIFEST.get(tool_name, {}).get(owasp_id, 0)


# ---------------------------------------------------------------- adapters

#: Red spec 2.3 — the nine adapters, plus Purplix's own in-house runner.
#: `pillar` uses Purplix vocabulary (see core.spec.RED_LAYER_TO_PILLAR).
ADAPTERS: list[dict] = [
    {"tool": "promptfoo", "pillars": ["model", "app"], "mechanism": "async subprocess (Node CLI)",
     "stage": 1, "note": "Stages its native promptfooconfig.yaml; plugin selection cannot be expressed as CLI flags."},
    {"tool": "garak", "pillars": ["model"], "mechanism": "async subprocess (Python CLI)",
     "stage": 2, "note": "Model type and probes read straight from CLI args — no staged files needed."},
    {"tool": "pyrit", "pillars": ["model", "app"], "mechanism": "native async library call",
     "stage": 3, "note": "Its orchestrator is already async, so it composes without an event-loop bridge."},
    {"tool": "harmbench", "pillars": ["model"], "mechanism": "async library call",
     "stage": 0, "note": "Independent lane — gathered concurrently with stages 1-3."},
    {"tool": "precogly", "pillars": ["app", "agent"], "mechanism": "async HTTP (REST / MCP)",
     "stage": 0, "note": "Threat model first; one adapter, different library pack per pillar."},
    {"tool": "hackagent", "pillars": ["agent"], "mechanism": "async subprocess / library",
     "stage": 1, "note": "AdvPrefix, AutoDAN-Turbo, PAIR, TAP, FlipAttack, BoN."},
    {"tool": "agentharm", "pillars": ["agent"], "mechanism": "async library call",
     "stage": 2, "note": "User-driven track; gathered in parallel."},
    {"tool": "injecagent", "pillars": ["agent"], "mechanism": "async library call",
     "stage": 2, "note": "Content-driven track; gathered in parallel."},
    {"tool": "agentdojo", "pillars": ["agent"], "mechanism": "async library call",
     "stage": 2, "note": "Content-driven track; gathered in parallel."},
    {"tool": "purplix", "pillars": ["model", "agent", "app"], "mechanism": "in-house runner + canary oracle",
     "stage": 1, "note": "Keeps per-attempt transcripts and technique labels that OSS runners discard."},
]


def adapters_for(pillar: str) -> list[dict]:
    return [a for a in ADAPTERS if pillar in a["pillars"]]
