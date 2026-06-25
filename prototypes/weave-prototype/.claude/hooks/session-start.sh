#!/usr/bin/env bash
# SessionStart hook: make tests and linters runnable immediately in a fresh
# (e.g. web) session by bootstrapping dependencies. Idempotent and non-fatal —
# it never blocks a session, it only prepares the workspace.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 0

log() { printf '[weave session-start] %s\n' "$1"; }

# --- Backend: venv + dev deps ------------------------------------------------
if [ -f backend/pyproject.toml ]; then
  if [ ! -x backend/.venv/bin/python ]; then
    log "creating backend venv"
    python3 -m venv backend/.venv >/dev/null 2>&1 || log "venv creation failed (skipping)"
  fi
  if [ -x backend/.venv/bin/pip ]; then
    log "installing backend deps (quiet)"
    (cd backend && .venv/bin/pip -q install -e ".[dev]" >/dev/null 2>&1) \
      || log "backend dep install failed (network?) — continuing"
  fi
fi

# --- Frontend: node deps (only once it exists) -------------------------------
if [ -f frontend/package.json ]; then
  if [ ! -d frontend/node_modules ]; then
    log "installing frontend deps (quiet)"
    (cd frontend && npm install --no-audit --no-fund >/dev/null 2>&1) \
      || log "frontend dep install failed (network?) — continuing"
  fi
fi

log "ready"
exit 0
