"""Register a target on the Purplix platform (writes the Target row).

    python configure_target.py demo-app          # register the vulnerable app
    python configure_target.py demo-app --url http://127.0.0.1:3000
    python configure_target.py support-bot       # register the model target
    python configure_target.py --list            # show registered targets

A target is a row plus a profile: the row records which adapter drives it and
where it lives, the profile (targets/registry.py) supplies the pack, the call
mechanics, the oracle and the fallback defence. Registering here is all the loop
needs — `python demo.py --target demo-app` then runs against it.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

from core import models as M
from targets.registry import _ADAPTERS


def register(adapter: str, url: str | None) -> str:
    if adapter not in _ADAPTERS:
        raise SystemExit(f"unknown adapter {adapter!r}. Known: {', '.join(_ADAPTERS)}")
    profile = _ADAPTERS[adapter](base_url=url) if (url and adapter == "demo-app") else _ADAPTERS[adapter]()

    M.init_db()
    with M.SessionLocal() as s:
        existing = s.query(M.Target).filter(M.Target.name == profile.display_name).first()
        if existing:
            existing.pillar = profile.pillar
            existing.endpoint = profile.meta().get("base_url", profile.endpoint)
            existing.digest = profile.digest
            existing.meta = profile.meta()
            s.commit()
            print(f"updated target {existing.id} — {profile.display_name} [{profile.pillar}]")
            return existing.id
        t = M.Target(
            pillar=profile.pillar,
            name=profile.display_name,
            endpoint=profile.meta().get("base_url", profile.endpoint),
            digest=profile.digest,
            meta=profile.meta(),
        )
        s.add(t)
        s.commit()
        print(f"registered target {t.id} — {profile.display_name} [{profile.pillar}] via adapter '{adapter}'")
        return t.id


def list_targets() -> None:
    M.init_db()
    with M.SessionLocal() as s:
        rows = s.query(M.Target).all()
        if not rows:
            print("no targets registered")
            return
        for t in rows:
            print(f"  {t.id}  {t.name:<32} [{t.pillar}]  adapter={t.meta.get('adapter','?')}  {t.endpoint}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("adapter", nargs="?", help="adapter key: demo-app | support-bot")
    ap.add_argument("--url", help="base URL for HTTP targets (demo-app)")
    ap.add_argument("--list", action="store_true", help="list registered targets")
    args = ap.parse_args()

    if args.list or not args.adapter:
        list_targets()
        return 0

    tid = register(args.adapter, args.url)
    print(f"\nRun the loop:  python demo.py --target {args.adapter}")
    return 0 if tid else 1


if __name__ == "__main__":
    raise SystemExit(main())
