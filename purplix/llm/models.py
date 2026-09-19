"""Model pool + task kinds — the ONLY place model IDs live (D4).

Sprint 0 pinned one model per task across two providers (Groq + Gemini). That
gave determinism but no availability headroom: a single provider outage or a
rate-limit stalled the whole loop.

The router is now OpenRouter-only with ONE shared pool. Every call site draws
from the same ordered list; on a rate-limit (429) / server error / timeout the
router advances to the next model and puts the failing one on a short cooldown,
so the loop keeps running as long as ANY model in the pool is healthy. That is
the whole objective: continuous coverage for every call site.

`TaskKind` is kept — callers still name a task, and the task name is part of the
cache key and the on-screen label — but a task no longer selects a model. The
pool is shared and identical for all of them.
"""

from __future__ import annotations

from enum import Enum


class TaskKind(str, Enum):
    """What the caller wants done. Every task draws from the shared pool."""

    ATTACK_GEN = "attack_gen"
    JUDGE = "judge"
    JUDGE_FAST = "judge_fast"      # kept for back-compat; same shared pool
    JUDGE_DEEP = "judge_deep"      # kept for back-compat; same shared pool
    POLICY_COMPILE = "policy_compile"
    TARGET = "target"             # the system under test


# The rotating pool. Order is the round-robin priority. Every entry is a live
# OpenRouter slug (validated against the /models catalog). Five carry no `:free`
# suffix and bill on the key; five have free tiers. Edit THIS list to change
# coverage — nothing else references a model ID.
MODEL_POOL: list[str] = [
    "ibm-granite/granite-4.2-8b",
    "z-ai/glm-5.3-flash",
    "tencent/hy-mt2-30b-a3b",
    "qwen/qwen3.8-27b",
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning",
    "deepseek/deepseek-v4-flash-0731",
    "qwen/qwen3.7-flash",
    "qwen/qwen3.6-35b-a3b",
    "google/gemma-4-26b-a4b-it",
]

# Task-preferred ordering. The shared pool is right for most calls, but the
# policy compiler must emit a STRICT nested JSON schema (PolicyBundleSpec), and
# the smallest free models in the pool cannot do that reliably — they validate-
# fail even after the repair retry, and the loop silently falls back to the
# template bundle. So POLICY_COMPILE tries the larger, schema-capable pool
# members FIRST, then rotates through the rest. Every entry is still a pool
# member, so nothing new is introduced — only the order for this one task.
# Ordered by MEASURED JSON compliance, not size. Most pool models emit chain-of-
# thought and get truncated before the JSON closes; tencent/hy-mt2 reliably
# returns a clean, complete PolicyBundleSpec object with `response_format`
# honoured, so it leads. The rest are fallbacks for when it rate-limits.
COMPILER_MODELS: list[str] = [
    "tencent/hy-mt2-30b-a3b",
    "qwen/qwen3.6-35b-a3b",
    "qwen/qwen3.8-27b",
    "z-ai/glm-5.3-flash",
    "deepseek/deepseek-v4-flash-0731",
]

TASK_PREFERRED: dict[str, list[str]] = {
    "policy_compile": COMPILER_MODELS,
}

# How long a model is skipped after it rate-limits / errors, before the pool
# will try it again. Long enough to clear a 429 window, short enough that a
# 10-model pool never runs dry in a normal loop.
COOLDOWN_SECONDS = 60.0

# Confidence below which a judge would escalate — retained as a constant so any
# external reference resolves, but the single-pool judge no longer escalates.
JUDGE_ESCALATION_THRESHOLD = 0.80

# Fixed seed + temperature. Determinism is best-effort now (pooled models vary
# in whether they honour a seed); the cache is what makes replay faithful, and
# it is keyed on task+prompt, not on which model happened to answer.
SEED = 7731
TEMPERATURE = 0.0
