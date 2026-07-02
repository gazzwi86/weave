#!/usr/bin/env bash
set -euo pipefail

# Install the Weave harness git hooks.
#   - point core.hooksPath at this directory (stored repo-relative, so it is
#     portable across clones)
#   - make the hook scripts executable
# Idempotent: safe to run repeatedly. Invoked from the /implement scaffolding
# step (see .claude/skills/implement/SKILL.md) so a fresh clone gets the gates.

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$HOOKS_DIR" rev-parse --show-toplevel)"
REL_HOOKS_DIR="$(python3 -c 'import os,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))' "$HOOKS_DIR" "$REPO_ROOT")"

git -C "$REPO_ROOT" config core.hooksPath "$REL_HOOKS_DIR"
chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-push" 2>/dev/null || true

echo "harness git hooks installed: core.hooksPath -> $REL_HOOKS_DIR"
