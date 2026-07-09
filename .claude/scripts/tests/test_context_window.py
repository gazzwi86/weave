#!/usr/bin/env python3
"""Unit test for stop.py's context-window resolver.

Dependency-free — run with: python3 .claude/scripts/tests/test_context_window.py
(exits non-zero on failure). Covers the pure resolution logic only: env
override, the model-ID registry, legacy back-compat, and the safe default.
"""

import os
import sys
from pathlib import Path

# Import the module under test (…/.claude/scripts on sys.path).
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from modules import stop  # noqa: E402


def _clear_env():
    for var in ("CLAUDE_CONTEXT_WINDOW", "CLAUDE_CONTEXT_TOKENS"):
        os.environ.pop(var, None)


def run():
    # --- _window_for_model: only non-default tiers resolve; base/unknown -> None
    assert stop._window_for_model("claude-sonnet-5[1m]") == 1_000_000
    assert stop._window_for_model("claude-opus-4-8-1m") == 1_000_000
    assert stop._window_for_model("CLAUDE-OPUS-4-8[1M]") == 1_000_000  # case-insensitive
    assert stop._window_for_model("claude-opus-4-8") is None           # base -> default path
    assert stop._window_for_model("claude-sonnet-5") is None            # base -> default path
    assert stop._window_for_model("some-future-model") is None
    assert stop._window_for_model("") is None

    # --- _resolve_context_window priority order
    _clear_env()

    # 1. explicit env override wins over everything
    os.environ["CLAUDE_CONTEXT_WINDOW"] = "500000"
    assert stop._resolve_context_window({"model": "claude-opus-4-8[1m]"}, None) == 500_000
    os.environ["CLAUDE_CONTEXT_WINDOW"] = "not-a-number"  # invalid -> ignored
    assert stop._resolve_context_window({"model": "claude-opus-4-8[1m]"}, None) == 1_000_000
    _clear_env()

    # 2. model-ID registry (from payload) resolves a 1M variant
    assert stop._resolve_context_window({"model": "claude-sonnet-5[1m]"}, None) == 1_000_000

    # 3. base model with no env -> default
    assert stop._resolve_context_window({"model": "claude-opus-4-8"}, None) == stop._CONTEXT_WINDOW_DEFAULT

    # 3b. base model + legacy env -> legacy wins over default (back-compat)
    os.environ["CLAUDE_CONTEXT_TOKENS"] = "131072"
    assert stop._resolve_context_window({"model": "claude-opus-4-8"}, None) == 131_072
    # but a recognised 1M variant still beats the legacy env
    assert stop._resolve_context_window({"model": "claude-opus-4-8[1m]"}, None) == 1_000_000
    _clear_env()

    # 4. no model, no env -> safe default
    assert stop._resolve_context_window({}, None) == stop._CONTEXT_WINDOW_DEFAULT

    print("test_context_window: all assertions passed")


if __name__ == "__main__":
    run()
