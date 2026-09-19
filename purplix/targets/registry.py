"""Target registry — resolve a Target row to the profile that drives it.

The engines used to `from targets.support_bot import ...` at module load, which
hard-wired the loop to one target. A second target row in the database would
have been attacked by sending its payloads to the support bot, and every number
on screen would have been about the wrong system while looking perfectly valid.

The registry closes that seam. A Target row stores `meta.adapter`; the loop
resolves it here to a `TargetProfile`, and everything downstream (which pack to
load, how to call the target, how to score, how to defend) comes from the
profile. Adding a target is registering an adapter, not editing the engine.
"""

from __future__ import annotations

from targets.base import TargetProfile
from targets.demo_app import DemoAppProfile
from targets.support_bot import SupportBotProfile
from targets.supportops import SupportOpsProfile

# adapter key -> profile factory
_ADAPTERS: dict[str, type[TargetProfile]] = {
    SupportBotProfile.key: SupportBotProfile,
    DemoAppProfile.key: DemoAppProfile,
    SupportOpsProfile.key: SupportOpsProfile,
}


def profile_for(target) -> TargetProfile:
    """Resolve a Target ORM row (or anything with `.meta`/`.pillar`) to a profile.

    Falls back to the pillar's default adapter when a row predates the registry
    and has no `meta.adapter` — the model pillar's default is the support bot,
    which is exactly the Sprint 0 behaviour, so old rows keep working.
    """
    meta = getattr(target, "meta", None) or {}
    adapter = meta.get("adapter")
    if adapter and adapter in _ADAPTERS:
        return _build(adapter, meta)

    pillar = getattr(target, "pillar", "model")
    default = {"model": SupportBotProfile.key, "app": DemoAppProfile.key}.get(pillar)
    if default:
        return _build(default, meta)
    raise KeyError(f"no target adapter for pillar={pillar!r} / meta={meta!r}")


def _build(adapter: str, meta: dict) -> TargetProfile:
    cls = _ADAPTERS[adapter]
    if adapter in (DemoAppProfile.key, SupportOpsProfile.key) and meta.get("base_url"):
        return cls(base_url=meta["base_url"])  # type: ignore[call-arg]
    return cls()


def available() -> list[type[TargetProfile]]:
    return list(_ADAPTERS.values())
