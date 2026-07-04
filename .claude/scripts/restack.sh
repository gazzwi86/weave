#!/usr/bin/env bash
# Restack open stacked epic branches onto their merged base.
#
# When a base epic PR merges to main, its still-open children have drifted: they
# carry the base's *old* commits, not main's version (worse if the base got fixes
# after they branched). This rebases each child onto its new parent, in stack
# order, and pushes with --force-with-lease (permitted on feature/* per
# .claude/rules/git-safety.md). STOPS on the first conflict and prints the exact
# commands to finish the remaining children.
#
# Usage:
#   restack.sh                       # discover OPEN, unmerged feature/PLAT-EPIC-* PRs
#   restack.sh feature/A feature/B   # explicit stack order, bottom (nearest main) first
#
# Written for macOS stock bash 3.2 — no `declare -A`, no `mapfile`.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

git fetch origin main --quiet

# --- build the ordered branch list -----------------------------------------
branches=()
if [ "$#" -gt 0 ]; then
  for b in "$@"; do branches+=("$b"); done
else
  # Open PRs whose head is a feature/PLAT-EPIC-* branch, sorted by epic number,
  # skipping anything already merged into main.
  while IFS= read -r br; do
    [ -n "$br" ] || continue
    if git merge-base --is-ancestor "$br" origin/main 2>/dev/null; then
      echo "skip $br (already merged into main)"
      continue
    fi
    branches+=("$br")
  done < <(
    gh pr list --state open --json headRefName --jq '.[].headRefName' 2>/dev/null \
      | grep -E '^feature/PLAT-EPIC-[0-9]+$' | sort -u
  )
fi

if [ "${#branches[@]}" -eq 0 ]; then
  echo "restack: no open, unmerged feature/PLAT-EPIC-* branches — nothing to do."
  exit 0
fi

# --- capture every branch's CURRENT tip up front ---------------------------
# (parallel indexed array — bash-3.2 safe). These are the "old parent" SHAs that
# --onto needs, and they survive the rebases so conflict-recovery stays correct.
oldtips=()
for br in "${branches[@]}"; do
  oldtips+=("$(git rev-parse "$br")")
done

n="${#branches[@]}"
for ((i = 0; i < n; i++)); do
  br="${branches[$i]}"
  if [ "$i" -eq 0 ]; then
    parent="origin/main"
  else
    parent="${branches[$((i - 1))]}"       # the now-rebased previous branch
    old_parent="${oldtips[$((i - 1))]}"     # its pre-rebase tip
  fi

  echo "== restacking $br onto ${parent} =="
  git checkout "$br"

  rebase_failed=0
  if [ "$i" -eq 0 ]; then
    git rebase "$parent" || rebase_failed=1
  else
    git rebase --onto "$parent" "$old_parent" "$br" || rebase_failed=1
  fi

  if [ "$rebase_failed" -ne 0 ]; then
    {
      echo ""
      echo "CONFLICT restacking $br onto ${parent}."
      echo "1. resolve the conflicts, then:  git rebase --continue"
      echo "2. push it:                       git push --force-with-lease"
      echo "3. finish the remaining children with these EXACT commands"
      echo "   (bases/old-tips already computed — do NOT bare re-run restack.sh):"
      for ((j = i + 1; j < n; j++)); do
        echo "   git checkout ${branches[$j]} && git rebase --onto ${branches[$((j - 1))]} ${oldtips[$((j - 1))]} ${branches[$j]} && git push --force-with-lease"
      done
    } >&2
    exit 1
  fi

  git push --force-with-lease
done

echo "restack complete: ${branches[*]}"
