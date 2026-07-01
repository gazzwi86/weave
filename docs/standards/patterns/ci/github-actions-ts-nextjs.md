---
type: Coding Standard
title: "CI — TypeScript / Next.js 15 (github-actions)"
description: "Golden GitHub Actions workflow for the Weave Next.js 15 SPA: npm ci with cache, eslint, tsc --noEmit, vitest with coverage, playwright E2E, and next build — all on PR; any AWS step (e.g. CloudFront/S3 deploy) assumes an IAM role via OIDC (id-token: write) with least privilege — never long-lived keys."
tags: [standards, patterns, ci, github-actions]
timestamp: 2026-07-01
resource: docs/standards/patterns/ci/github-actions-ts-nextjs.md
topic: ci
stack: github-actions
verification: "python3 yaml.safe_load PASS (valid YAML, 'jobs' key present); actionlint unavailable (no go/brew) — yaml-parse is the achieved level"
---

# CI — TypeScript / Next.js 15 (github-actions)

## Intent

The CI workflow for the Weave Next.js 15 App Router SPA (TypeScript strict, npm,
Node 22 LTS). On every pull request it must: install with `npm ci` (lockfile,
cached), lint with **eslint** (`next/core-web-vitals` + `next/typescript` +
sonarjs), assert types with **`tsc --noEmit`**, run **vitest** with coverage,
build with **`next build`**, then run **playwright** E2E against the built app.
None of these need AWS credentials. Only a deploy step (CloudFront + S3) requests
an OIDC token and assumes a least-privilege role. There are **no long-lived AWS
keys** in the repo.

```yaml
# .github/workflows/ci-web.yml
name: CI (Web)

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-web-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint · Type · Unit · Build
    runs-on: ubuntu-latest
    permissions:
      contents: read   # no AWS access for lint/type/test/build
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm          # caches ~/.npm keyed on package-lock.json

      - name: Install dependencies (locked)
        run: npm ci

      # -- Lint ----------------------------------------------------------------
      - name: ESLint
        run: npm run lint -- --max-warnings=0

      # -- Type check ----------------------------------------------------------
      - name: Type-check
        run: npx tsc --noEmit

      # -- Unit / component tests ----------------------------------------------
      - name: Vitest + coverage
        run: npm run test -- --coverage --run
        env:
          CI: "true"

      # -- Build (also caches Next's compiler output) --------------------------
      - name: Next build
        run: npm run build
        env:
          NEXT_TELEMETRY_DISABLED: "1"

      - name: Cache Next build
        uses: actions/cache@v4
        with:
          path: ${{ github.workspace }}/.next/cache
          key: nextjs-${{ hashFiles('package-lock.json') }}-${{ hashFiles('**/*.[jt]s', '**/*.[jt]sx') }}
          restore-keys: |
            nextjs-${{ hashFiles('package-lock.json') }}-

  e2e:
    name: Playwright E2E
    needs: quality
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies (locked)
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run Playwright (starts app via webServer config)
        run: npx playwright test

      - name: Upload Playwright report
        if: ${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # Example: deploy the built SPA to CloudFront + S3. OIDC lives ONLY here.
  deploy:
    name: Deploy SPA
    needs: [quality, e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production   # protection rules (required reviewers) gate this
    permissions:
      id-token: write   # REQUIRED for OIDC
      contents: read
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install + build
        run: |
          npm ci
          npm run build

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}   # arn:aws:iam::<acct>:role/weave-web-deploy
          aws-region: ${{ vars.AWS_REGION }}
          role-session-name: gha-web-${{ github.run_id }}

      - name: Sync to S3 + invalidate CloudFront
        run: |
          aws s3 sync ./out "s3://${{ vars.SPA_BUCKET }}" --delete
          aws cloudfront create-invalidation \
            --distribution-id "${{ vars.CF_DISTRIBUTION_ID }}" --paths "/*"
```

**Why:** `npm ci` installs exactly the lockfile and fails on drift; `cache: npm`
in `setup-node` restores `~/.npm` keyed on `package-lock.json`, and the separate
`.next/cache` cache speeds rebuilds. `--max-warnings=0` makes lint warnings fail
the gate. `tsc --noEmit` type-checks without emitting JS. Playwright runs against
the real build (its `webServer` config boots the app), matching the Weave E2E
standard (Page Object Model, `data-testid` selectors, axe checks).

**Security:**
- **OIDC, not static keys.** The deploy job exchanges its OIDC token for a
  short-lived STS session via `configure-aws-credentials@v4`. No
  `AWS_ACCESS_KEY_ID` secret exists.
- **`id-token: write` is scoped to the deploy job only.** Default workflow
  permission is `contents: read`; lint/type/test/build/E2E cannot mint AWS creds.
- **Least-privilege role.** `AWS_DEPLOY_ROLE_ARN` grants only `s3:PutObject`/
  `DeleteObject` on the SPA bucket and `cloudfront:CreateInvalidation` on the one
  distribution; its trust policy restricts `sub` to
  `repo:<org>/<repo>:environment:production`.
- **Environment protection.** `environment: production` applies GitHub Environment
  protection rules (required reviewers, branch/wait-timer restrictions) before the
  deploy runs; combined with `if: github.ref == 'refs/heads/main'`.
- **Pinned actions.** Pinned to major version tags for readability; the **hardened
  option is full commit-SHA pinning** (e.g. `actions/checkout@<sha>  # v4.x`) so a
  re-tagged/compromised release cannot change behaviour. `NEXT_TELEMETRY_DISABLED`
  avoids leaking build metadata.

**Anti-patterns:**
- Storing AWS keys as repo/environment secrets — use OIDC.
- `id-token: write` or `contents: write` at the workflow top level — grant per job.
- `npm install` in CI instead of `npm ci` — non-deterministic, mutates the lockfile.
- Deploying without an `environment:` (skips protection rules) or without the
  `main`-branch guard.
- Skipping `--max-warnings=0` / letting `tsc` be `continue-on-error` — soft gates.
- Running Playwright against `next dev` instead of the production build — masks
  build-only failures.
- Hardcoding bucket/distribution IDs or the role ARN in the workflow — use `vars`.
