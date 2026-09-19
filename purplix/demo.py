"""CLI loop driver — the H2 gate.

    python demo.py --seed          # register the target, init the DB
    python demo.py                 # run one full iteration, print the titer table
    python demo.py --replay        # same, cache-only, zero network

This exists so the loop can be proven BEFORE any UI is written. If this prints
a titer table, a slow frontend is a cosmetic problem. Build the UI first and
you find out the loop doesn't close with 30 minutes left.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

# A stock Windows console is cp1252, and rich's box-drawing + the progress
# arrows are not in it. Without this the whole run dies on a UnicodeEncodeError
# at the FIRST progress line — i.e. on stage, ten seconds in, having done the
# work and printed none of it.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from rich.console import Console
from rich.table import Table

from core import models as M
from core.schemas import ExitCriteria
from engine import loop, purple
from llm import cache
from targets.registry import _ADAPTERS

console = Console()


def ensure_target(adapter: str = "support-bot") -> tuple[str, str]:
    """Register (idempotently) and return (target_id, display_name)."""
    if adapter not in _ADAPTERS:
        raise SystemExit(f"unknown target {adapter!r}. Known: {', '.join(_ADAPTERS)}")
    profile = _ADAPTERS[adapter]()
    M.init_db()
    with M.SessionLocal() as s:
        t = s.query(M.Target).filter(M.Target.name == profile.display_name).first()
        if not t:
            t = M.Target(
                pillar=profile.pillar,
                name=profile.display_name,
                endpoint=profile.meta().get("base_url", profile.endpoint),
                digest=profile.digest,
                meta=profile.meta(),
            )
            s.add(t)
            s.commit()
        return t.id, profile.display_name


def on_progress(ev: dict) -> None:
    node = ev.get("node", "")
    if ev.get("event") == "attempt.new":
        ok = ev.get("success")
        kind = ev.get("kind", "seeded")
        mark = "[red]BREACH[/red]" if ok and kind != "benign" else "[green]held [/green]"
        blocked = f" [dim](blocked {ev['blocked']})[/dim]" if ev.get("blocked") else ""
        console.print(f"  {mark} {kind:<8} {ev.get('technique','')}{blocked}")
    elif ev.get("event") == "titer.update":
        pass
    else:
        msg = ev.get("message", "")
        if msg:
            console.print(f"[bold magenta]▸ {node}[/bold magenta] {msg}")


def print_titer(st: loop.LoopState) -> None:
    t = st.titer
    before_seeded = purple.asr(st.baseline_seeded)
    before_holdout = purple.asr(st.baseline_holdout)

    tbl = Table(title="TITER — all four metrics, or none (Invariant 2)", title_style="bold magenta")
    tbl.add_column("Metric")
    tbl.add_column("Before", justify="right")
    tbl.add_column("After", justify="right")
    tbl.add_column("Budget", justify="right")

    def pc(x: float) -> str:
        return f"{x * 100:.0f}%"

    tbl.add_row("ASR seeded", pc(before_seeded), f"[bold]{pc(t.asr_seeded)}[/bold]", "—")
    tbl.add_row("ASR held-out", pc(before_holdout), f"[bold]{pc(t.asr_holdout)}[/bold]",
                f"≤ {pc(st.criteria.max_asr_holdout)}")
    tbl.add_row("FP rate (benign)", "0%", f"[bold]{pc(t.fp_rate_benign)}[/bold]",
                f"≤ {pc(st.criteria.max_fp_rate)}")
    tbl.add_row("Added latency p95", "—", f"[bold]{t.latency_delta_ms:+.0f} ms[/bold]",
                f"≤ {st.criteria.max_latency_delta_ms:.0f} ms")
    console.print()
    console.print(tbl)

    verdict = "[bold green]CONVERGED[/bold green]" if t.converged else "[bold yellow]NOT CONVERGED — next iteration[/bold yellow]"
    console.print(f"\nExit criteria: {verdict}")
    if st.used_fallback_compiler:
        console.print("[yellow]NOTE: fallback compiler was used (policy LLM unavailable).[/yellow]")
    console.print(f"Findings: {len(st.findings)}   Controls: {len(st.bundle.controls)}   "
                  f"Record: {st.record['self_hash'][:16]}…")
    console.print(f"[dim]LLM cache: {cache.stats()['entries']} entries "
                  f"(this is the replay fixture — REPLAY_MODE=1 to use it)[/dim]")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true", help="init DB + register target, then exit")
    ap.add_argument("--replay", action="store_true", help="cache-only, no network")
    ap.add_argument("--reset", action="store_true", help="drop and recreate the DB")
    ap.add_argument("--target", default="support-bot",
                    help="target adapter: support-bot (model, needs keys) | demo-app (app, offline)")
    ap.add_argument("--iteration", type=int, default=1)
    args = ap.parse_args()

    if args.replay:
        os.environ["REPLAY_MODE"] = "1"
        console.print("[bold]REPLAY MODE[/bold] — cache-only, any miss is fatal\n")

    if args.reset:
        M.init_db(drop=True)
        console.print("[yellow]database reset[/yellow]")

    target_id, target_name = ensure_target(args.target)
    if args.seed:
        console.print(f"[green]target ready[/green] {target_id} — {target_name}")
        return 0

    # Deterministic-oracle targets (the demo-app) need no keys — the whole loop
    # closes offline. Only the model target requires a judge/compiler provider.
    needs_keys = not _ADAPTERS[args.target]().deterministic_oracle
    if needs_keys and not args.replay and not (os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY")):
        console.print("[red]OPENROUTER_API_KEY not set.[/red] Put it in purplix/.env")
        return 2

    console.print(f"[bold magenta]Purplix AI[/bold magenta] — loop iteration {args.iteration} "
                  f"against [bold]{target_name}[/bold]\n")

    try:
        st = loop.run_iteration(target_id, iteration=args.iteration, progress=on_progress,
                                criteria=ExitCriteria())
    except cache.ReplayMiss as e:
        console.print(f"\n[red]REPLAY MISS[/red] {e}")
        return 3
    except Exception as e:
        console.print(f"\n[red]{type(e).__name__}[/red]: {e}")
        return 1

    print_titer(st)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
