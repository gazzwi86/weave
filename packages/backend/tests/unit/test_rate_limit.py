"""Law 18: rate-limit middleware is mandatory on auth-bearing endpoints.
Mirrors the frontend's lib/rate-limit.ts sliding-window approach.
"""

from __future__ import annotations

from weave_backend.rate_limit import check_rate_limit

LIMIT = 5
WINDOW_SECONDS = 60.0


def test_allows_requests_up_to_the_limit() -> None:
    store: dict[str, list[float]] = {}
    now = 0.0
    for _ in range(LIMIT):
        assert check_rate_limit(store, "client-a", now, LIMIT, WINDOW_SECONDS) is True
        now += 1


def test_blocks_after_the_limit_is_reached() -> None:
    store: dict[str, list[float]] = {}
    now = 0.0
    for _ in range(LIMIT):
        check_rate_limit(store, "client-a", now, LIMIT, WINDOW_SECONDS)
        now += 0.1

    assert check_rate_limit(store, "client-a", now, LIMIT, WINDOW_SECONDS) is False


def test_allows_again_once_the_window_has_elapsed() -> None:
    store: dict[str, list[float]] = {}
    for i in range(LIMIT):
        check_rate_limit(store, "client-a", i * 0.1, LIMIT, WINDOW_SECONDS)

    assert check_rate_limit(store, "client-a", WINDOW_SECONDS + 1, LIMIT, WINDOW_SECONDS) is True


def test_tracks_separate_keys_independently() -> None:
    store: dict[str, list[float]] = {}
    for i in range(LIMIT):
        check_rate_limit(store, "client-a", i * 0.1, LIMIT, WINDOW_SECONDS)

    assert check_rate_limit(store, "client-b", 0, LIMIT, WINDOW_SECONDS) is True
