"""m2-delta.md §1: Engine-Availability Registry -- the single source of
GA-ness for AC-6's `source_not_ga` gate and AC-8's example-prompt filtering
(TASK-016/017 import this same module -- "single availability registry
module" invariant, m2-delta.md §10). Static config map at M2: no DB table,
no service endpoint, no membership check -- an engine flips GA by editing
this file, not by a runtime write (YAGNI until that's untrue).
"""

from __future__ import annotations

#: source engine name -> GA status. Only `ce` (Constitution Engine) ships at
#: M2; the other three engines are on the roadmap but dark.
_ENGINE_AVAILABILITY: dict[str, bool] = {
    "ce": True,
    "build": False,
    "events": False,
    "explorer": False,
}

#: contract id prefix (`CE-METRICS-1` -> `CE`) -> owning engine key. Every
#: `data_source_contracts` entry on a `WidgetSpec` is expected to match one
#: of these prefixes (contracts.md is the canonical contract registry).
_CONTRACT_PREFIX_TO_ENGINE: dict[str, str] = {
    "CE": "ce",
    "BUILD": "build",
    "EVENTS": "events",
    "EXPLORER": "explorer",
}


def is_ga(source_engine: str) -> bool:
    """Unknown engine names default to *not* GA -- fail closed."""
    return _ENGINE_AVAILABILITY.get(source_engine, False)


def _engine_of_contract(contract_id: str) -> str:
    prefix = contract_id.split("-", 1)[0]
    return _CONTRACT_PREFIX_TO_ENGINE.get(prefix, prefix)


def source_available(contract_ids: list[str]) -> bool:
    """True only if every named contract's owning engine is GA."""
    return all(is_ga(_engine_of_contract(cid)) for cid in contract_ids)
