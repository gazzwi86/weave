---
topic: ci
stack: ts
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — TypeScript Monorepo: Turbo + pnpm + Node Matrix + Affected-only

Turborepo caching, pnpm 9, Node 20/22 matrix. On PRs only affected packages
run lint+test; full build on merge to main.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: CI (${{ matrix.node }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: ["20", "22"]

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2   # needed for turbo --affected

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Turbo remote cache — set TURBO_TOKEN + TURBO_TEAM in repo secrets
      - name: Lint (affected)
        run: pnpm turbo lint --filter="...[HEAD^1]" --concurrency=4
        env:
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM:  ${{ vars.TURBO_TEAM }}

      - name: Type-check (affected)
        run: pnpm turbo typecheck --filter="...[HEAD^1]"

      - name: Test (affected)
        run: pnpm turbo test --filter="...[HEAD^1]" -- --reporter=verbose
        env:
          CI: true

      - name: Build (all — main only)
        if: github.ref == 'refs/heads/main'
        run: pnpm turbo build

      - name: Upload coverage
        if: matrix.node == '20'
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: '**/coverage/lcov.info'
          retention-days: 7

  # Separate job: post coverage comment on PR
  coverage-comment:
    needs: ci
    if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/download-artifact@v4
        with: { name: coverage }
      - uses: romeovs/lcov-reporter-action@v0.4.0
        with:
          lcov-file: ./packages/*/coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Why:** `--filter="...[HEAD^1]"` is Turbo's affected-packages filter — only
packages changed since the last commit are built/tested, keeping PRs fast.
`cancel-in-progress` prevents queue pile-up on rapid pushes. Node matrix
catches version regressions before merge.
