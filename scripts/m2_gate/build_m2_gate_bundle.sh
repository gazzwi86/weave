#!/usr/bin/env bash
# CE-V1-TASK-030 AC-6: assembles the M2 release-gate evidence bundle at
# artefacts/m2-gate/ -- one directory, every file/subdir named in the AC
# ("isolation report, axe/Lighthouse outputs, perf traces, invariants
# result, GE-CANVAS-1 conformance report, coverage + mutation numbers").
#
# Run from the repo root, ideally after the axe-m2/lighthouse-explorer/
# perf-m2/invariants-check CI jobs (or their local equivalents) have already
# produced their own artefacts -- this script COPIES what exists rather than
# re-running docker-dependent suites itself. A piece that hasn't been run
# yet (e.g. no docker in this environment) gets a small `{"status":
# "not-run", "reason": ...}` stub instead of a fabricated number -- Law F/
# honesty over a bundle that looks complete but lies.
set -euo pipefail

cd "$(dirname "$0")/../.."
BUNDLE=artefacts/m2-gate
mkdir -p "$BUNDLE/axe" "$BUNDLE/lighthouse" "$BUNDLE/perf"

stub() {
  # $1 = target file, $2 = human reason
  printf '{"status": "not-run", "reason": %s}\n' "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")" > "$1"
}

# invariants.json (AC-5) -- no docker needed, always run for real.
python3 scripts/m2_gate/invariants_check.py --out "$BUNDLE/invariants.json"

# isolation-report.json (AC-1) -- docker-gated pytest suite. No
# pytest-json-report plugin installed (ponytail: not worth a new dependency
# for one report file) -- capture pass/fail + the raw log ourselves instead.
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  ISOLATION_LOG=$(mktemp)
  if uv run --project packages/backend pytest packages/backend/tests/integration/test_m2_release_gate.py -q \
    >"$ISOLATION_LOG" 2>&1; then
    ISOLATION_STATUS=passed
  else
    ISOLATION_STATUS=failed
  fi
  python3 - "$BUNDLE/isolation-report.json" "$ISOLATION_STATUS" "$ISOLATION_LOG" <<'PY'
import json, sys
out_path, status, log_path = sys.argv[1:4]
with open(log_path) as f:
    log = f.read()
with open(out_path, "w") as f:
    json.dump({"status": status, "log_tail": log[-4000:]}, f, indent=2)
PY
  rm -f "$ISOLATION_LOG"
else
  stub "$BUNDLE/isolation-report.json" "docker unavailable in this environment -- AC-1 suite runs in CI's integration/perf jobs, not this sandbox"
fi

# axe/lighthouse/perf -- these are CI-job outputs (need a served app +
# Postgres this script does not stand up itself). Copy in if a prior job
# already ran and left its report on disk; stub otherwise.
if [ -d packages/frontend/playwright-report ]; then
  cp -r packages/frontend/playwright-report/. "$BUNDLE/axe/"
else
  stub "$BUNDLE/axe/summary.json" "axe-m2 CI job artefact not present locally -- see .github/workflows/ci.yml axe-m2 job"
fi

if [ -d artefacts/m2-gate-lighthouse-src ]; then
  cp -r artefacts/m2-gate-lighthouse-src/. "$BUNDLE/lighthouse/"
else
  stub "$BUNDLE/lighthouse/summary.json" "lighthouse-explorer CI job artefact not present locally -- see .github/workflows/ci.yml lighthouse-explorer job"
fi

if [ -f scripts/benchmarks/ce-perf/reports/view-save-summary.json ]; then
  cp scripts/benchmarks/ce-perf/reports/view-save-summary.json "$BUNDLE/perf/"
else
  stub "$BUNDLE/perf/view-save-summary.json" "run_view_save_benchmark.py not run locally -- needs the docker-compose stack (perf-m2 CI job)"
fi

# ge-canvas-1-conformance.json (TASK-029's own reporter output).
if [ -f packages/frontend/test-results/ge-canvas-1-conformance-report.json ]; then
  cp packages/frontend/test-results/ge-canvas-1-conformance-report.json "$BUNDLE/ge-canvas-1-conformance.json"
else
  stub "$BUNDLE/ge-canvas-1-conformance.json" "ge-canvas-1-conformance.spec.ts has not been run in this environment"
fi

# coverage.xml -- real backend unit-suite coverage, no docker needed.
# --ignore the gate-bundle meta-test itself: it asserts the FINISHED bundle
# is complete, so running it mid-script (before mutation.json below exists)
# is a self-reference that fails on a bundle this script hasn't finished yet.
uv run --project packages/backend pytest packages/backend -m "not docker and not e2e" \
  --ignore=packages/backend/tests/unit/test_m2_gate_bundle.py \
  --cov=weave_backend --cov-report="xml:$BUNDLE/coverage.xml" -q || true

# mutation.json -- full mutmut run is expensive (10+ min); reuse the last
# CI-produced report if present, stub otherwise. Never fabricate a number.
if [ -f packages/backend/mutmut-report.json ]; then
  cp packages/backend/mutmut-report.json "$BUNDLE/mutation.json"
else
  stub "$BUNDLE/mutation.json" "no mutmut report on disk -- full mutation run is CI-only (mutation-strict job), not run by this script"
fi

echo "Gate bundle written to $BUNDLE/"
ls -la "$BUNDLE"
