#!/usr/bin/env bash
# run-loop.sh — deterministic driver for the /implement loop (ADR-H1, reopened 2026-07-02).
#
# Repeatedly invokes `claude -p "/implement"` (fresh context per invocation, resuming from the
# committed .claude/state/progress.json spine) until the current phase is COMPLETE. Survives
# usage limits: on a limit error it falls back from the primary model to the fallback model;
# once both are exhausted it polls every LIMIT_SLEEP secs until the 5-hour usage window resets,
# then retries the primary model first. Limit waits do not count against the iteration ceiling.
# Halts — never auto-approves — whenever an invocation ends without advancing state (HITL gate).
#
# ADR-H4 preconditions implemented here:
#   kill switch   touch .claude/state/run-loop.stop   (checked every iteration)
#   cost ceiling  --max-iterations (default 25) on top of /goal's per-task 60-turn cap
#   AWS safety    hard-exits if AWS_PROFILE looks like a production profile
#
# Exit codes: 0 phase complete · 2 CLI error (not a limit) · 3 halted for human (HITL gate)
#             4 kill switch · 5 iteration ceiling · 6 prod AWS_PROFILE refused
#
# Usage: run-loop.sh [--model M] [--fallback M] [--max-iterations N] [--limit-sleep SECS]
#                    [--permission-mode MODE]
# Env overrides (flags win): CLAUDE_BIN, RUN_LOOP_ROOT, RUN_LOOP_MODEL, RUN_LOOP_FALLBACK,
#                            RUN_LOOP_MAX_ITERATIONS, RUN_LOOP_LIMIT_SLEEP,
#                            RUN_LOOP_PERMISSION_MODE, WEAVE_NO_NOTIFY,
#                            WEAVE_CAVEMAN (default read from settings.json env block),
#                            WEAVE_CAFFEINATE (default true — auto keep-awake on macOS)

set -euo pipefail

# Keep the Mac awake for the whole run — auto-wraps itself in caffeinate when available.
# Disable with WEAVE_CAFFEINATE=false (e.g. on a machine that must sleep on schedule).
if [ "${WEAVE_CAFFEINATE:-true}" = "true" ] && [ -z "${RUN_LOOP_CAFFEINATED:-}" ] \
   && command -v caffeinate >/dev/null 2>&1; then
  RUN_LOOP_CAFFEINATED=1 exec caffeinate -i bash "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${RUN_LOOP_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

CLAUDE_BIN="${CLAUDE_BIN:-claude}"
MODEL="${RUN_LOOP_MODEL:-claude-fable-5}"
FALLBACK_MODEL="${RUN_LOOP_FALLBACK:-claude-sonnet-5}"
MAX_ITERATIONS="${RUN_LOOP_MAX_ITERATIONS:-25}"
LIMIT_SLEEP="${RUN_LOOP_LIMIT_SLEEP:-1800}"
PERMISSION_MODE="${RUN_LOOP_PERMISSION_MODE:-acceptEdits}"

while [ $# -gt 0 ]; do
  case "$1" in
    --model)            MODEL="$2"; shift 2 ;;
    --fallback)         FALLBACK_MODEL="$2"; shift 2 ;;
    --max-iterations)   MAX_ITERATIONS="$2"; shift 2 ;;
    --limit-sleep)      LIMIT_SLEEP="$2"; shift 2 ;;
    --permission-mode)  PERMISSION_MODE="$2"; shift 2 ;;
    *) echo "run-loop.sh: unknown flag $1" >&2; exit 64 ;;
  esac
done
PRIMARY_MODEL="$MODEL"

# Caveman toggle: env var wins, else the settings.json env block (headless shells lack the var).
CAVEMAN="${WEAVE_CAVEMAN:-$(python3 -c "import json; print(json.load(open('$ROOT/.claude/settings.json')).get('env', {}).get('WEAVE_CAVEMAN', ''))" 2>/dev/null || true)}"
caveman_args=()
if [ "$CAVEMAN" = "true" ]; then
  caveman_args+=(--append-system-prompt "Talk like a caveman (caveman plugin, level full): compressed telegraphic output, drop articles/filler/pleasantries. Keep code, commits, file contents, and quoted errors normal.")
fi

KILL_SWITCH="$ROOT/.claude/state/run-loop.stop"
LIMIT_FLAG="$ROOT/.claude/state/limit-hit"
LOG="$ROOT/.claude/logs/run-loop.log"
PROGRESS="$ROOT/.claude/state/progress.json"
mkdir -p "$ROOT/.claude/state" "$ROOT/.claude/logs"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG" >&2; }

notify() {
  [ -n "${WEAVE_NO_NOTIFY:-}" ] && return 0
  osascript -e "display notification \"${1//\"/ }\" with title \"Weave run-loop\"" \
    >/dev/null 2>&1 || true
}

# Operator's pre-authenticated named profile (see .claude/memory/reference_aws_profile.md).
# Headless shells (launchd/cron) don't inherit the interactive export, so default it here.
export AWS_PROFILE="${AWS_PROFILE:-gazzwi86}"

# ADR-H4: the harness sits near AWS/Cognito/Bedrock creds — refuse to loop on a prod profile.
profile_lc="$(printf '%s' "${AWS_PROFILE:-}" | tr '[:upper:]' '[:lower:]')"
case "$profile_lc" in
  *prod*|*prd*|*live*)
    log "REFUSED: AWS_PROFILE='$AWS_PROFILE' looks like production. Unset or use a scoped non-prod profile."
    exit 6 ;;
esac

# Fingerprint of durable state: progress.json content + HEAD. Unchanged across an
# invocation = the loop is waiting on a human (HITL gate), not making progress.
fingerprint() {
  {
    [ -f "$PROGRESS" ] && cat "$PROGRESS"
    git -C "$ROOT" rev-parse HEAD 2>/dev/null || true
  } | shasum | cut -d' ' -f1
}

is_limit() {
  printf '%s' "$1" | grep -qiE 'rate.?limit|usage limit|limit (reached|exceeded)|quota|overloaded|billing'
}

phase_complete() {
  bash "$ROOT/.claude/scripts/progress.sh" phase-check 2>/dev/null | head -1 | grep -q '^COMPLETE'
}

log "start model=$MODEL fallback=$FALLBACK_MODEL max=$MAX_ITERATIONS perm=$PERMISSION_MODE"

iter=0
while :; do
  if [ -e "$KILL_SWITCH" ]; then
    log "kill switch present ($KILL_SWITCH) — stopping."
    exit 4
  fi
  iter=$((iter + 1))
  if [ "$iter" -gt "$MAX_ITERATIONS" ]; then
    log "iteration ceiling ($MAX_ITERATIONS) reached — stopping."
    notify "Iteration ceiling reached — review run-loop.log"
    exit 5
  fi
  if phase_complete; then
    log "phase COMPLETE — stopping."
    notify "Phase complete. Phase gate awaits your review."
    exit 0
  fi

  before="$(fingerprint)"
  rm -f "$LIMIT_FLAG"
  log "iteration $iter: invoking $CLAUDE_BIN -p /implement --model $MODEL"

  set +e
  # ${arr[@]+...} guard: empty-array expansion is safe under set -u on macOS bash 3.2
  out="$("$CLAUDE_BIN" -p "/implement" --model "$MODEL" \
        --permission-mode "$PERMISSION_MODE" --output-format json \
        ${caveman_args[@]+"${caveman_args[@]}"} 2>&1)"
  rc=$?
  set -e
  printf '%s\n' "$out" >>"$LOG"

  if [ -e "$LIMIT_FLAG" ] || { [ $rc -ne 0 ] && is_limit "$out"; }; then
    if [ "$MODEL" != "$FALLBACK_MODEL" ] && [ -n "$FALLBACK_MODEL" ]; then
      log "usage limit on $MODEL — falling back to $FALLBACK_MODEL."
      notify "Limit on $MODEL — continuing on $FALLBACK_MODEL"
      MODEL="$FALLBACK_MODEL"
    else
      log "usage limit on fallback too — sleeping ${LIMIT_SLEEP}s, then retrying primary."
      notify "All models limited — sleeping ${LIMIT_SLEEP}s"
      sleep "$LIMIT_SLEEP"
      # ponytail: poll every LIMIT_SLEEP rather than blind 5h sleep — resumes within one
      # poll of the window reset. Window may have reset: try primary first again.
      MODEL="$PRIMARY_MODEL"
    fi
    iter=$((iter - 1))  # limit waits don't count against the iteration ceiling
    continue
  fi

  if [ $rc -ne 0 ]; then
    log "claude exited rc=$rc (not a limit) — stopping. Tail of output above in $LOG."
    notify "run-loop stopped on CLI error rc=$rc"
    exit 2
  fi

  if [ "$(fingerprint)" = "$before" ]; then
    log "no state advanced — HITL gate or blocker needs a human. Stopping."
    notify "Run-loop halted: a gate needs you. Re-run after attending it."
    exit 3
  fi

  log "iteration $iter: progress made — continuing."
done
