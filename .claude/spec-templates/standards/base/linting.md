# Linting — universal base

**Stack-agnostic.** Use the language-appropriate linter from
`docs/stack-equivalents.md` (row: Linter). The per-stack overlay in
`templates/standards/<lang>/linting.md` names the tool and supplies a minimal
starter configuration.

## Universal requirements

Every project must enforce, in CI:

1. **Code-style lint** — the language's canonical linter with default strict settings.
2. **Complexity gates** — the metrics and thresholds in `base/complexity.md`.
3. **Security lint** — static analysis for common vulnerabilities (Bandit,
   eslint-plugin-security, SpotBugs Find-Sec-Bugs, SwiftLint security rules).
4. **Secret detection** — `gitleaks` or `trufflehog` in pre-commit and CI
   (see `base/secrets-scanning.md`).
5. **Dependency audit** — `npm audit`, `pip-audit`, `mvn dependency-check`,
   `swift package audit` run at pre-push and in CI.

## Auto-fix where safe

Apply the linter's `--fix` / `--apply-autofix` / Checkstyle's formatter-driven
fixes on commit. Type-level and semantic issues are never auto-fixed — those
require human or agent judgement.

## Handling violations

When the agent encounters lint errors:

1. **Auto-fixable** → apply fix.
2. **Complexity violation** → decompose the function (extract helpers).
3. **Type / static-analysis error** → fix the root cause; never blanket-suppress
   with `any` / `type: ignore` / `@SuppressWarnings("all")`.
4. **Cannot resolve** → log a complexity waiver with a non-empty reason
   (see `base/complexity.md`) or escalate per Engineer Law 11.

## Pre-commit pipeline (universal shape)

Pre-commit:
- auto-fix + lint on staged files only
- type-check on staged files (where supported: tsc-files, mypy, incremental compile)
- affected-tests run

Pre-push:
- full test suite
- dependency / security audit

Language-specific hook implementations live in
`templates/standards/<lang>/tooling.md`.

---

*Override per stack in `templates/standards/<lang>/linting.md`.*
