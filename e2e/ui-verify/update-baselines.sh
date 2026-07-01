#!/usr/bin/env bash
# Regenerate visual baselines inside the PINNED Playwright Docker image so dev and CI agree.
#
# WHY: committed screenshots generated on macOS will not match Linux/CI headless Chrome (font
# hinting, antialiasing, GPU vs software rendering). The DevEx council seat flagged this as the
# rot path — teams end up merging `--update-snapshots` commits to silence CI. The fix is to make
# the SAME pinned Linux image the single source of baselines. Run this script (not a local
# `--update-snapshots`) whenever the design changes, and commit the resulting __screenshots__.
#
# Requires Docker running. Pin the tag to match the @playwright/test version in package.json.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright:v1.49.0-noble"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v docker >/dev/null 2>&1 || { echo "update-baselines: docker not found" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "update-baselines: docker is not running" >&2; exit 1; }

echo "Regenerating baselines in $IMAGE ..."
docker run --rm -v "$HERE":/work -w /work "$IMAGE" \
  bash -lc "npm ci && npx playwright test --update-snapshots"
echo "Done. Review and commit e2e/ui-verify/__screenshots__/."
