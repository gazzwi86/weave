#!/usr/bin/env bash
# PostToolUse hook: run ruff/radon on edited .py files, tsc on .ts/.tsx files.
# Reads JSON from stdin (Claude's tool_use notification), extracts file_path.
# Exit 0 = advisory (shows output to Claude); exit 2 = block with message.

set -euo pipefail

FILE_PATH=$(echo "${CLAUDE_TOOL_INPUT:-{}}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data.get('file_path', data.get('path', '')))
" 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  *.py)
    cd "$(dirname "$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || echo .)")" 2>/dev/null || true
    VENV_RUFF="backend/.venv/bin/ruff"
    if [ -f "$VENV_RUFF" ]; then
      "$VENV_RUFF" check "$FILE_PATH" --select C90,E,W --quiet 2>&1 || true
    fi
    ;;
  *.ts|*.tsx)
    ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
    if [ -f "$ROOT/frontend/tsconfig.json" ]; then
      cd "$ROOT/frontend" && npx --no-install tsc --noEmit --quiet 2>&1 || true
    fi
    ;;
esac

exit 0
