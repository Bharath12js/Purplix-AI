"""LLM response cache, keyed on (provider, model, prompt_hash, seed).

Two jobs, and the second one is the reason this file exists at all:

1. Cost control. Re-running a loop shouldn't re-bill every attack.
2. REPLAY MODE. A completed real run leaves a complete set of cache rows. Set
   REPLAY_MODE=1 and the router reads cache-only, hard-failing on a miss — the
   identical code path, zero network, no mock layer to write and keep in sync.
   For a live demo this is worth more than any feature.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "llm_cache.sqlite"
_lock = threading.Lock()


class ReplayMiss(RuntimeError):
    """Replay mode was on and the call was not in the cache.

    Deliberately fatal: a miss during a rehearsal is exactly the signal you
    want, because it names the step that would have hit the network on stage.
    """


def replay_mode() -> bool:
    return os.getenv("REPLAY_MODE", "0") == "1"


def _conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(_DB_PATH, timeout=30)
    c.execute(
        """CREATE TABLE IF NOT EXISTS llm_cache (
               k TEXT PRIMARY KEY,
               provider TEXT, model TEXT, seed INTEGER,
               request_json TEXT, response_text TEXT,
               created_at TEXT DEFAULT CURRENT_TIMESTAMP
           )"""
    )
    return c


def make_key(task: str, messages: list[dict], seed: int, schema_name: str) -> str:
    """Cache key — deliberately MODEL-AGNOSTIC.

    The router rotates a pool, so the model that answers a given (task, prompt)
    varies run to run. Keying on the model would make replay miss whenever a
    different pooled model had answered last time. Keying on task+prompt instead
    means 'whichever model answered this exact request first' is what replay
    serves back — the availability trade the pool exists to make.
    """
    payload = json.dumps(
        {"task": task, "msgs": messages, "seed": seed, "schema": schema_name},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get(key: str) -> str | None:
    with _lock, _conn() as c:
        row = c.execute("SELECT response_text FROM llm_cache WHERE k = ?", (key,)).fetchone()
    return row[0] if row else None


def put(key: str, provider: str, model: str, seed: int, messages: list[dict], response_text: str) -> None:
    with _lock, _conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO llm_cache (k, provider, model, seed, request_json, response_text) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (key, provider, model, seed, json.dumps(messages, ensure_ascii=False), response_text),
        )


def stats() -> dict[str, int]:
    with _lock, _conn() as c:
        n = c.execute("SELECT COUNT(*) FROM llm_cache").fetchone()[0]
    return {"entries": n}
