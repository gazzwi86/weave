#!/usr/bin/env bash
# Restack open stacked epic branches onto their merged base.
#
# When a base epic PR merges to main, its still-open children have drifted: they
# carry the base's *old* commits, not main's version (worse if the base got fixes
# after they branched). This rebases each child onto its new parent, in stack
# order, and pushes with --force-with-lease (permitted on feature/* per
# .claude/rules/git-safety.md). STOPS on the first conflict for resolution.
#
# Usage:
#   restack.sh                       # discover open feature/PLAT-EPIC-* branches, sorted
#   restack.sh feature/A feature/B   # explicit stack order, bottom (nearest main) first
#
# After a conflict: resolve, `git rebase --continue`, `git push --force-with-lease`,
# then re-run restack.sh with the REMAINING branches to finish the cascade.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git fetch origin main --quiet

if [ "$#" -gt 0 ]; then
  branches=("$@")
else
  # Sort by the numeric epic id so the stack order is deterministic.
  mapfile -t branches < <(
    git branch --format='%(refname:short)' \
      | grep -E '^feature/PLAT-EPIC-[0-9]+$' | sort
  )
fi

if [ "${#branches[@]}" -eq 0 ]; then
  echo "restack: no open feature/PLAT-EPIC-* branches found — nothing to do."
  exit 0
fi

# Capture each branch's current tip BEFORE any rebase: it is the "old base" that
# --onto uses to select only the child's own commits (dropping the parent's).
declare -A old_tip
for br in "${branches[@]}"; do
  old_tip["$br"]="$(git rev-parse "$br")"
done

base="origin/main"   # the first branch rebases straight onto main
prev_old=""

# Run the rebase directly (not in a subshell) so its output shows and, on
# failure, the conflict/rebase-in-progress state is preserved for resolution.
# `set -e` must not abort us on a rebase conflict — guard with `if`.
for br in "${branches[@]}"; do
  echo "== restacking $br onto ${base} =="
  git checkout "$br"

  rebase_failed=0
  if [ -z "$prev_old" ]; then
    git rebase "$base" || rebase_failed=1
  else
    # Replay only $br's own commits (those after the parent's OLD tip) onto the
    # parent's NEW tip — the standard restack move.
    git rebase --onto "$base" "$prev_old" "$br" || rebase_failed=1
  fi

  if [ "$rebase_failed" -ne 0 ]; then
    {
      echo "CONFLICT restacking $br onto ${base}."
      echo "Resolve the conflicts, then:"
      echo "  git rebase --continue"
      echo "  git push --force-with-lease"
      echo "  # then re-run restack.sh with the branches from $br onwards to finish the cascade"
    } >&2
    exit 1
  fi

  git push --force-with-lease
  prev_old="${old_tip[$br]}"
  base="$br"   # the next child stacks on this now-rebased branch
done

echo "restack complete: ${branches[*]}"
