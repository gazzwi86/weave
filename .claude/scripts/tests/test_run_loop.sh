#!/usr/bin/env bash
# Self-check for run-loop.sh + the stop-failure hook. No frameworks: stubbed `claude`
# binary + sandbox RUN_LOOP_ROOT, asserts on exit codes and recorded model args.
# Run: bash .claude/scripts/tests/test_run_loop.sh
set -euo pipefail

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_LOOP="$SCRIPTS/run-loop.sh"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

export WEAVE_NO_NOTIFY=1
export RUN_LOOP_ROOT="$SANDBOX"
export RUN_LOOP_LIMIT_SLEEP=0
export CLAUDE_BIN="$SANDBOX/bin/claude"
unset AWS_PROFILE || true

mkdir -p "$SANDBOX/bin" "$SANDBOX/.claude/state" "$SANDBOX/.claude/logs" "$SANDBOX/.claude/scripts"
echo '{}' >"$SANDBOX/.claude/state/progress.json"
echo '{"env": {"WEAVE_CAVEMAN": "true"}}' >"$SANDBOX/.claude/settings.json"
unset WEAVE_CAVEMAN || true  # force the settings.json fallback path

# Stub progress.sh: INCOMPLETE until a marker file appears.
cat >"$SANDBOX/.claude/scripts/progress.sh" <<'EOF'
#!/usr/bin/env bash
if [ -e "$(dirname "$0")/../state/done-marker" ]; then echo "COMPLETE"; else echo "INCOMPLETE: 1 remaining"; fi
EOF

# Stub claude: records the --model it was called with; behaviour driven by $SANDBOX files.
cat >"$SANDBOX/bin/claude" <<EOF
#!/usr/bin/env bash
echo "\$@" >>"$SANDBOX/calls.log"
mode=\$(cat "$SANDBOX/stub-mode" 2>/dev/null || echo ok)
case "\$mode" in
  limit-on-fable)
    if echo "\$@" | grep -q fable; then echo "Error: weekly usage limit reached"; exit 1; fi
    echo '{"result":"ok"}'; exit 0 ;;
  limit-twice)
    n=\$(cat "$SANDBOX/count" 2>/dev/null || echo 0); n=\$((n+1)); echo "\$n" >"$SANDBOX/count"
    if [ "\$n" -le 2 ]; then echo "Error: usage limit reached"; exit 1; fi
    echo '{"result":"ok"}'; exit 0 ;;
  hard-error) echo "Error: something unrelated broke"; exit 1 ;;
  *) echo '{"result":"ok"}'; exit 0 ;;
esac
EOF
chmod +x "$SANDBOX/bin/claude" "$SANDBOX/.claude/scripts/progress.sh"

fails=0
expect_exit() { # expected_code description command...
  local want="$1" desc="$2"; shift 2
  local got=0
  "$@" >/dev/null 2>&1 || got=$?
  if [ "$got" -eq "$want" ]; then echo "PASS: $desc"; else echo "FAIL: $desc (want $want got $got)"; fails=$((fails+1)); fi
}

# 1. Prod AWS_PROFILE refused before any invocation.
expect_exit 6 "prod AWS_PROFILE refused" env AWS_PROFILE=corp-Prod bash "$RUN_LOOP"

# 2. Kill switch stops the loop.
touch "$SANDBOX/.claude/state/run-loop.stop"
expect_exit 4 "kill switch honoured" bash "$RUN_LOOP"
rm -f "$SANDBOX/.claude/state/run-loop.stop"

# 3. COMPLETE phase exits 0 without invoking claude.
touch "$SANDBOX/.claude/state/done-marker"
expect_exit 0 "complete phase exits clean" bash "$RUN_LOOP"
[ -e "$SANDBOX/calls.log" ] && { echo "FAIL: claude invoked despite COMPLETE"; fails=$((fails+1)); } || echo "PASS: claude not invoked when COMPLETE"
rm -f "$SANDBOX/.claude/state/done-marker"

# 4. Limit on primary → falls back to opus; fallback run advances nothing → halts for human (3).
echo limit-on-fable >"$SANDBOX/stub-mode"
expect_exit 3 "limit falls back then halts at gate" bash "$RUN_LOOP"
grep -q "claude-opus-4-8" "$SANDBOX/calls.log" && echo "PASS: fallback model used" || { echo "FAIL: fallback model never invoked"; fails=$((fails+1)); }
grep -q "caveman" "$SANDBOX/calls.log" && echo "PASS: caveman system prompt passed" || { echo "FAIL: caveman system prompt missing"; fails=$((fails+1)); }

# 4b. Both models limited → sleeps window, retries primary again, limit waits don't burn
# the iteration ceiling (ceiling=1: without the iter decrement this exits 5, not 3).
echo limit-twice >"$SANDBOX/stub-mode"
rm -f "$SANDBOX/count"; : >"$SANDBOX/calls.log"
expect_exit 3 "limit wait restores primary within ceiling" env RUN_LOOP_MAX_ITERATIONS=1 bash "$RUN_LOOP"
[ "$(wc -l <"$SANDBOX/calls.log" | tr -d ' ')" -eq 3 ] && sed -n '3p' "$SANDBOX/calls.log" | grep -q fable \
  && echo "PASS: primary retried after window sleep" \
  || { echo "FAIL: primary not retried after window sleep"; fails=$((fails+1)); }

# 5. Non-limit CLI error stops with 2 (no spin). Also: env WEAVE_CAVEMAN=false overrides settings.json.
echo hard-error >"$SANDBOX/stub-mode"
: >"$SANDBOX/calls.log"
expect_exit 2 "hard CLI error stops loop" env WEAVE_CAVEMAN=false bash "$RUN_LOOP"
grep -q "caveman" "$SANDBOX/calls.log" && { echo "FAIL: caveman passed despite WEAVE_CAVEMAN=false"; fails=$((fails+1)); } || echo "PASS: caveman off when env override false"

# 6. stop-failure hook writes the limit flag (run against the real repo, then clean up).
REPO_ROOT="$(cd "$SCRIPTS/../.." && pwd)"
FLAG="$REPO_ROOT/.claude/state/limit-hit"
rm -f "$FLAG"
echo '{"reason":"rate_limit"}' | (cd "$SCRIPTS" && CLAUDE_PROJECT_DIR="$REPO_ROOT" python3 hooks.py stop-failure) 2>/dev/null
[ -f "$FLAG" ] && echo "PASS: stop-failure hook writes limit flag" || { echo "FAIL: limit flag not written"; fails=$((fails+1)); }
rm -f "$FLAG"

[ "$fails" -eq 0 ] && echo "ALL PASS" || { echo "$fails FAILURE(S)"; exit 1; }
