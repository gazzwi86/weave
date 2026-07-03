"""Law 18: rate-limit middleware on auth-bearing endpoints.

ponytail: in-memory dict, single dev process -- swap for slowapi/Redis
once there's more than one instance.
"""

from __future__ import annotations


def check_rate_limit(
    store: dict[str, list[float]],
    key: str,
    now: float,
    limit: int = 5,
    window_seconds: float = 60.0,
) -> bool:
    """Sliding-window check: returns True (and records `now`) if `key` has
    made fewer than `limit` requests within the last `window_seconds`.
    """
    window_start = now - window_seconds
    recent = [t for t in store.get(key, []) if t > window_start]
    if len(recent) >= limit:
        store[key] = recent
        return False
    recent.append(now)
    store[key] = recent
    return True
