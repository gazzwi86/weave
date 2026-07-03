#!/usr/bin/env bash
# ============================================================================
# DEV/TEST-ONLY -- NOT A DEPLOY PATH. Real deploy uses Terraform + real
# Cognito/OIDC (see docs/specs/weave/dev-environment.md); this script only
# exists so ui_verify.sh can measure a real production build locally.
# Generates a fresh AUTH_SECRET every run and defaults to a throwaway
# OIDC client secret -- never point this at a real tenant or real secrets.
# ============================================================================
#
# ui_verify Law #2 fix: dev-mode (`next dev`) performance never represents the
# shipped app (~0.85 vs 0.99-1.0 built). Serves the PRODUCTION build so
# `ui_verify.sh --full --target http://localhost:3000` measures the real
# artifact. Same env-var shape as playwright.config.ts's FRONTEND_ENV (mock
# OIDC issuer, dev-only client secret -- never a real Cognito secret).
#
# Usage: ./scripts/serve-prod.sh
# Then, in another terminal: .claude/scripts/ui_verify.sh --full --target http://localhost:3000
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

: "${OIDC_ISSUER_URL:=http://localhost:9001}"
: "${OIDC_CLIENT_ID:=weave-dev}"
: "${OIDC_CLIENT_SECRET:=dev-secret}"
: "${BACKEND_API_URL:=http://localhost:8000}"
# NextAuth v5 rejects any Host header it doesn't recognise once NODE_ENV=production
# (Vercel sets this trust automatically at the platform layer; self-hosted needs it
# explicit). Same trust boundary, just declared rather than platform-implied.
: "${AUTH_TRUST_HOST:=true}"
AUTH_SECRET_DEFAULT="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
: "${AUTH_SECRET:=$AUTH_SECRET_DEFAULT}"
export OIDC_ISSUER_URL OIDC_CLIENT_ID OIDC_CLIENT_SECRET BACKEND_API_URL AUTH_TRUST_HOST AUTH_SECRET

echo "WARNING: serve-prod.sh uses ephemeral dev secrets (fresh AUTH_SECRET, dev-secret OIDC client). Test harness only -- not a deploy path." >&2

npm run build
npm run start
