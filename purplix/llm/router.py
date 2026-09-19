"""Provider router — OpenRouter pool with rotation for continuous coverage.

Contract (unchanged for callers):

    complete(task: TaskKind, messages, schema) -> ParsedModel
    complete_raw(task: TaskKind, messages, json_mode=False) -> str

Callers still name a TASK, never a model. What changed underneath: instead of
one pinned model per task across two providers, there is ONE shared pool of
OpenRouter models (llm/models.MODEL_POOL). Each call walks the pool from a
rotating cursor; a model that rate-limits (429), errors (5xx), times out or
returns empty is put on a short cooldown and the next model is tried. The call
succeeds as long as ANY pooled model is healthy — that is the whole point:
continuous coverage for every call site, no human babysitting rate limits.

Determinism is now best-effort (pooled models vary in honouring a seed). The
response cache carries replay mode, and it is keyed on task+prompt — NOT on
which model answered — so a completed real run still replays offline.

Every LLM output is still parsed into a pydantic model. No free-text parsing.
"""

from __future__ import annotations

import contextvars
import json
import os
import re
import time
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from llm import cache
from llm.models import COOLDOWN_SECONDS, MODEL_POOL, SEED, TASK_PREFERRED, TEMPERATURE, TaskKind

T = TypeVar("T", bound=BaseModel)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
_TIMEOUT = httpx.Timeout(connect=10.0, read=90.0, write=30.0, pool=10.0)
# Headroom for the policy compiler: reasoning models emit chain-of-thought
# before the JSON, and a bundle for a full findings cluster is non-trivial —
# 1024 truncated the object mid-array and forced the template fallback.
_MAX_TOKENS = 2048

# Which model answered the most recent successful call — read by callers that
# label a transcript with its judge/target model. A ContextVar so concurrent
# background runs (the API launches loops as background tasks) don't clobber
# each other's label.
_last_model: contextvars.ContextVar[str] = contextvars.ContextVar("last_model", default="none")

# Rotation state, shared across the process and guarded together.
_cursor = 0
_cooldown_until: dict[str, float] = {}
import threading  # noqa: E402

_pool_lock = threading.Lock()


class LLMError(RuntimeError):
    pass


def last_model() -> str:
    """The model id that served the most recent successful completion."""
    return _last_model.get()


class Budget:
    """Per-run call budget — R4's guard, in its smallest honest form.

    Counts calls, not tokens: a call ceiling is enough to stop a runaway loop.
    A single logical completion may try several pooled models before one
    answers; the budget is spent once per logical completion, not per attempt,
    so rotation does not burn the budget faster than the old single-provider
    path did.
    """

    def __init__(self, max_calls: int = 400) -> None:
        self.max_calls = max_calls
        self.calls = 0

    def spend(self) -> None:
        self.calls += 1
        if self.calls > self.max_calls:
            raise LLMError(f"run budget exhausted ({self.max_calls} calls)")


BUDGET = Budget()


def _balanced_objects(text: str) -> list[str]:
    """Every top-level balanced {...} substring, in order of appearance."""
    out: list[str] = []
    depth, start, in_str, esc = 0, -1, False, False
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and start >= 0:
                out.append(text[start : i + 1])
    return out


def _extract_json(text: str) -> str:
    """Pull the intended JSON object out of a model reply.

    Reasoning models wrap the answer in chain-of-thought that itself contains
    stray braces (e.g. a canary token `{ID:...}`). Taking the FIRST brace grabs
    that junk and fails validation. Instead: consider every balanced {...},
    keep the ones that actually parse as a JSON object, and return the LARGEST —
    which is the real payload, wherever in the text it landed.
    """
    fenced = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    best: str | None = None
    for obj in _balanced_objects(text):
        try:
            if isinstance(json.loads(obj), dict) and (best is None or len(obj) > len(best)):
                best = obj
        except (json.JSONDecodeError, ValueError):
            continue
    if best is not None:
        return best
    start = text.find("{")
    return text[start:] if start != -1 else text


def _api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not key:
        raise LLMError("OPENROUTER_API_KEY not set")
    return key


def _base_url() -> str:
    base = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    return f"{base}/chat/completions"


def _extract_content(choice: dict) -> str:
    """Prefer `content`; fall back to `reasoning` (some models leave content
    empty and put the answer in reasoning)."""
    msg = choice.get("message", {}) or {}
    text = (msg.get("content") or "").strip()
    if text:
        return text
    return (msg.get("reasoning") or "").strip()


class _ModelFailed(Exception):
    """Internal: this model didn't answer; rotate to the next one."""


def _call_one(model: str, messages: list[dict], json_mode: bool) -> str:
    body: dict = {
        "model": model,
        "messages": messages,
        "temperature": TEMPERATURE,
        "seed": SEED,
        "max_tokens": _MAX_TOKENS,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    try:
        r = httpx.post(
            _base_url(),
            headers={
                "Authorization": f"Bearer {_api_key()}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://purplix.ai",
                "X-Title": "Purplix AI",
            },
            json=body,
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError as e:
        raise _ModelFailed(f"{model}: {type(e).__name__}") from e

    if r.status_code == 429:
        raise _ModelFailed(f"{model}: 429 rate-limited")
    if r.status_code >= 500:
        raise _ModelFailed(f"{model}: HTTP {r.status_code}")
    if r.status_code != 200:
        # 4xx other than 429 (bad model id, response_format unsupported, quota):
        # treat as this-model-failed and rotate rather than killing the loop.
        raise _ModelFailed(f"{model}: HTTP {r.status_code} {r.text[:160]}")

    try:
        text = _extract_content(r.json()["choices"][0])
    except (KeyError, IndexError, ValueError) as e:
        raise _ModelFailed(f"{model}: unparseable response ({e})") from e
    if not text:
        raise _ModelFailed(f"{model}: empty reply")
    return text


def _rotate_and_call(messages: list[dict], json_mode: bool,
                     preferred: list[str] | None = None) -> tuple[str, str]:
    """Walk the pool from the rotating cursor, skipping cooled-down models.

    `preferred` (a task's schema-capable subset) is tried FIRST, in the given
    order, before the normal rotation — the compiler task needs the larger
    models up front or it validate-fails into the template fallback. Everything
    else is unaffected.

    Returns (response_text, model_used). Raises LLMError only when the whole
    pool is exhausted in one logical completion.
    """
    global _cursor
    errors: list[str] = []
    pref = list(preferred or [])

    for _round in range(2):  # a second pass gives cooled-down models a chance
        now = time.time()
        with _pool_lock:
            start = _cursor
        rotation = MODEL_POOL[start:] + MODEL_POOL[:start]
        # preferred first, then the rest of the rotation with no duplicates
        order = pref + [m for m in rotation if m not in pref]

        cooling: list[float] = []
        for model in order:
            until = _cooldown_until.get(model, 0.0)
            if until > now:
                cooling.append(until)
                continue
            try:
                text = _call_one(model, messages, json_mode)
            except _ModelFailed as e:
                _cooldown_until[model] = time.time() + COOLDOWN_SECONDS
                errors.append(str(e))
                continue
            # success — spread load: next call starts after this model
            with _pool_lock:
                if model in MODEL_POOL:
                    _cursor = (MODEL_POOL.index(model) + 1) % len(MODEL_POOL)
            _last_model.set(model)
            return text, model

        # Every model was cooling down: wait until the soonest one frees up,
        # then take the second pass. Bounded so a live demo never hangs long.
        if cooling and _round == 0:
            wait = max(0.0, min(cooling) - time.time())
            time.sleep(min(wait, COOLDOWN_SECONDS))

    raise LLMError("OpenRouter pool exhausted: " + "; ".join(errors[-len(MODEL_POOL):]))


def complete_raw(task: TaskKind, messages: list[dict], json_mode: bool = False) -> str:
    """Single completion, cached, served from the rotating pool."""
    key = cache.make_key(task.value, messages, SEED, "json" if json_mode else "raw")

    hit = cache.get(key)
    if hit is not None:
        return hit

    if cache.replay_mode():
        raise cache.ReplayMiss(
            f"replay miss: task={task.value}. "
            "This call would have hit the network during the demo."
        )

    BUDGET.spend()
    text, model = _rotate_and_call(messages, json_mode, TASK_PREFERRED.get(task.value))
    cache.put(key, "openrouter", model, SEED, messages, text)
    return text


def complete(task: TaskKind, messages: list[dict], schema: type[T]) -> T:
    """Completion parsed into `schema`. One bounded repair retry (S3's guard)."""
    text = complete_raw(task, messages, json_mode=True)
    try:
        return schema.model_validate_json(_extract_json(text))
    except (ValidationError, ValueError) as e:
        repair = messages + [
            {"role": "assistant", "content": text},
            {
                "role": "user",
                "content": (
                    f"That did not validate against the required schema: {e}\n\n"
                    f"Return ONLY a JSON object matching this schema:\n"
                    f"{json.dumps(schema.model_json_schema(), indent=2)}"
                ),
            },
        ]
        text2 = complete_raw(task, repair, json_mode=True)
        return schema.model_validate_json(_extract_json(text2))
