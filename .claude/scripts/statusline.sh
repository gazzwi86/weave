#!/usr/bin/env bash
# Custom statusLine command. Reads stdin JSON from Claude Code (cwd, model,
# session info) and prints a single line shown above the prompt.
#
# Output format (no newline): "<dir> · <branch><dirty> · <model>"

set -u

input=$(cat 2>/dev/null || true)

extract() {
  printf '%s' "$input" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
}

cwd=$(extract cwd)
[ -z "$cwd" ] && cwd="$PWD"
model=$(extract display_name)
[ -z "$model" ] && model=$(extract id)
[ -z "$model" ] && model="claude"

branch=""
dirty=""
if branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null); then
  if [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ]; then
    dirty="*"
  fi
fi

dir=$(basename "$cwd")
if [ -n "$branch" ]; then
  printf '%s · %s%s · %s' "$dir" "$branch" "$dirty" "$model"
else
  printf '%s · %s' "$dir" "$model"
fi
