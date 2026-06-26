#!/usr/bin/env bash
# Weave statusLine command. Reads JSON from Claude Code on stdin; prints one
# line above the prompt.
#
# Output format: dir · branch[*] · model · ctx:N% · phase

set -u

input=$(cat 2>/dev/null || true)

# --- JSON helpers ---
if command -v jq >/dev/null 2>&1; then
  _jqs() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null; }
else
  # Fallback: sed for top-level string fields only (skips numeric/nested paths)
  _jqs() {
    local key; key="${1##*.}"
    printf '%s' "$input" | sed -n "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
  }
fi

# --- Extract fields ---
cwd=$(_jqs '.cwd')
[ -z "$cwd" ] && cwd="$PWD"

project_dir=$(_jqs '.workspace.project_dir')
[ -z "$project_dir" ] && project_dir="${CLAUDE_PROJECT_DIR:-$cwd}"

model=$(_jqs '.model.display_name')
[ -z "$model" ] && model=$(_jqs '.model.id')
[ -z "$model" ] && model="claude"

# Context remaining % — numeric, jq only; gracefully absent before first message
ctx_pct=""
if command -v jq >/dev/null 2>&1; then
  raw=$(printf '%s' "$input" | jq -r '.context_window.remaining_percentage // empty' 2>/dev/null)
  if [ -n "$raw" ] && [ "$raw" != "null" ]; then
    ctx_pct="ctx:$(printf '%.0f' "$raw")%"
  fi
fi

# --- Git branch + dirty (--no-optional-locks avoids index.lock contention) ---
branch=""
dirty=""
if branch=$(git --no-optional-locks -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null); then
  if [ -n "$(git --no-optional-locks -C "$cwd" status --porcelain 2>/dev/null)" ]; then
    dirty="*"
  fi
fi

# --- Weave spec phase from .claude/state/progress.json ---
phase=""
progress_file="${project_dir}/.claude/state/progress.json"
if [ -f "$progress_file" ] && command -v jq >/dev/null 2>&1; then
  phase=$(jq -r '.phase // empty' "$progress_file" 2>/dev/null)
fi

# --- Assemble output ---
dir=$(basename "$cwd")
out="$dir"
[ -n "$branch" ] && out="$out · ${branch}${dirty}"
out="$out · $model"
[ -n "$ctx_pct" ] && out="$out · $ctx_pct"
[ -n "$phase" ] && out="$out · $phase"

printf '%s' "$out"
