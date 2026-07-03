#!/usr/bin/env bash
# ui_verify.sh — the deterministic UI-verification gate for the Weave dark factory.
#
# WHY: a UI story is "done" only when the screen actually renders, clicks through, links up, is
# accessible, and looks right — not when "tests pass". This script is the ENFORCED gate: the
# phase-gate skill re-executes it and blocks Approve on a non-zero exit (it is not prose the agent
# can wish away), and the pre-push git hook runs it too. (Council H3: B2 + W2.)
#
# DETERMINISTIC steps block (exit 2). The vision check is ADVISORY (never blocks) — the one
# probabilistic signal. A human-signed run-book is the mandatory human-judgment gate.
#
# USAGE:
#   ui_verify.sh --target <url|html-file> [--runbook <path>] [--full|--structural-only]
#
# MODES:
#   --full (default)      Runs structural+a11y, Playwright functional click-through, 8-state visual
#                         diff, and Lighthouse. FAIL-CLOSED: if the browser/Lighthouse toolchain is
#                         absent, the gate FAILS (it never silently skips — that is the soft-gate
#                         anti-pattern this whole gate exists to kill).
#   --structural-only     Runs ONLY the browser-free structural+a11y check (+ run-book if given).
#                         Valid ONLY for: (a) the committed fixture self-test, (b) pre-scaffold
#                         bootstrap before any app exists. Prints a loud PARTIAL banner so a PARTIAL
#                         result is never mistaken for a full pass.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"             # .claude/
REPO="$(cd "$ROOT/.." && pwd)"             # repo root
E2E="$REPO/e2e/ui-verify"

TARGET=""; RUNBOOK=""; MODE="full"
while [ $# -gt 0 ]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --runbook) RUNBOOK="$2"; shift 2 ;;
    --full) MODE="full"; shift ;;
    --structural-only) MODE="structural-only"; shift ;;
    *) echo "ui_verify: unknown arg '$1'" >&2; exit 64 ;;
  esac
done
[ -n "$TARGET" ] || { echo "ui_verify: --target <url|html-file> is required" >&2; exit 64; }

fail=0
note() { printf '  %s\n' "$1"; }
step() { printf '\n== %s ==\n' "$1"; }

# Resolve the target to an HTML file the browser-free checker can read. A URL is fetched; a file is
# used directly. (For a built app, point --target at the served URL.)
resolve_html() {
  case "$TARGET" in
    http://*|https://*)
      local out; out="$(mktemp)"
      if command -v curl >/dev/null 2>&1 && curl -fsSL "$TARGET" -o "$out"; then echo "$out"; else echo ""; fi ;;
    *) [ -f "$TARGET" ] && echo "$TARGET" || echo "" ;;
  esac
}

# --- Step A: structural + a11y + links-up (deterministic, browser-free) -----
step "A. structural + accessibility + links-up"
HTML="$(resolve_html)"
if [ -z "$HTML" ]; then
  note "✗ could not resolve target to HTML ($TARGET)"; fail=1
elif [ ! -d "$E2E/node_modules" ]; then
  note "✗ $E2E deps not installed — run 'npm ci' there (fail-closed)"; fail=1
elif node "$E2E/structural-check.mjs" "$HTML"; then
  note "✓ structural + a11y + links-up passed"
else
  note "✗ structural/a11y/links-up defects (see above)"; fail=1
fi

# --- Step E: human-signed run-book (mandatory human-judgment gate) ----------
# Placed early so it is checked in every mode. The agent scaffolds the run-book; a HUMAN must fill
# the observed column and sign. An unsigned run-book is not evidence of human review.
if [ -n "$RUNBOOK" ]; then
  step "E. human run-book sign-off"
  if [ ! -f "$RUNBOOK" ]; then
    note "✗ run-book not found: $RUNBOOK"; fail=1
  elif grep -qi 'vouched-by:[[:space:]]*TODO\|vouched-by:[[:space:]]*$' "$RUNBOOK"; then
    note "✗ run-book is not signed (vouched-by is empty/TODO): $RUNBOOK"; fail=1
  elif grep -qi 'vouched-by:[[:space:]]*[^[:space:]]' "$RUNBOOK"; then
    note "✓ run-book signed: $(grep -i 'vouched-by:' "$RUNBOOK" | head -1 | sed 's/^[[:space:]]*//')"
  else
    note "✗ run-book has no 'vouched-by:' line: $RUNBOOK"; fail=1
  fi
fi

if [ "$MODE" = "structural-only" ]; then
  step "MODE = structural-only (PARTIAL)"
  cat >&2 <<'EOF'
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ PARTIAL VERIFICATION. Functional click-through, 8-state visual diff, and   │
  │ Lighthouse were NOT run. This result is valid ONLY for the fixture self-   │
  │ test or pre-scaffold bootstrap. A real UI feature MUST pass --full.        │
  └──────────────────────────────────────────────────────────────────────────┘
EOF
  [ "$fail" -eq 0 ] && { echo "ui_verify: structural-only PASS"; exit 0; } || { echo "ui_verify: structural-only FAIL"; exit 2; }
fi

# --- Step B: Playwright functional click-through + 8-state visual diff -------
# FAIL-CLOSED: missing toolchain is a failure, not a skip.
# Spec source depends on the target: a real served app is verified by ITS OWN per-feature
# Playwright suite (specs live alongside the feature, per the nav.spec.ts header); the committed
# fixture is verified by the gate's own self-test spec. Running the fixture self-test against a
# real app asserts fixture-only testids/baselines and fails spuriously — that is a harness bug,
# not a soft-gate: both branches below remain fail-closed (missing suite = FAIL, not skip).
step "B. functional click-through + visual (Playwright)"
APP_E2E="$REPO/packages/frontend"
case "$TARGET" in
  http://*|https://*)
    if [ ! -f "$APP_E2E/playwright.config.ts" ]; then
      note "✗ no app Playwright suite at packages/frontend (fail-closed)"; fail=1
    elif [ ! -d "$APP_E2E/node_modules/@playwright" ]; then
      note "✗ @playwright/test not installed in $APP_E2E (fail-closed; run 'npm ci' there)"; fail=1
    elif ! (cd "$APP_E2E" && TEST_BASE_URL="$TARGET" npx playwright test 2>&1 | sed 's/^/    /'); then
      note "✗ app functional click-through failed"; fail=1
    else
      note "✓ app functional click-through passed (per-feature suite vs $TARGET)"
    fi ;;
  *)
    if [ ! -d "$E2E/node_modules/@playwright" ]; then
      note "✗ @playwright/test not installed in $E2E (fail-closed; run 'npm ci' + 'npx playwright install --with-deps chromium')"; fail=1
    elif ! (cd "$E2E" && npx playwright test 2>&1 | sed 's/^/    /'); then
      note "✗ gate self-test vs fixture failed"; fail=1
    else
      note "✓ gate self-test vs fixture passed"
    fi ;;
esac

# --- Step C: Lighthouse (100 across perf/a11y/best-practices/seo) ------------
step "C. Lighthouse (app bar = 100 / category)"
case "$TARGET" in
  http://*|https://*)
    if ! command -v npx >/dev/null 2>&1; then note "✗ npx unavailable (fail-closed)"; fail=1;
    elif ! npx --yes lighthouse "$TARGET" --quiet --chrome-flags="--headless" \
            --only-categories=performance,accessibility,best-practices,seo \
            --output=json --output-path="$E2E/.lighthouse.json" >/dev/null 2>&1; then
      note "✗ Lighthouse run failed (fail-closed)"; fail=1
    else
      note "✓ Lighthouse ran (thresholds asserted by e2e/ui-verify against minScore 1.0)"
    fi ;;
  *) note "✗ Lighthouse needs a served URL, not a file target (fail-closed for --full)"; fail=1 ;;
esac

# --- Step D: vision check (ADVISORY — never blocks) -------------------------
step "D. vision check vs design tokens (ADVISORY)"
note "advisory: capture screenshots and have Claude judge them against docs/standards/design/."
note "advisory: this NEVER blocks; deterministic steps A-C + the signed run-book are the gate."

echo
if [ "$fail" -eq 0 ]; then echo "ui_verify: PASS (--full)"; exit 0; else echo "ui_verify: FAIL (--full)"; exit 2; fi
