# Weave Standards — base + overlay layout

Weave uses a **base + overlay** structure so each stack pays only for its own
specifics. The Init skill copies `base/` always, plus the overlay folder
matching the chosen language.

```
templates/standards/
├── base/                 # universal — ALWAYS copied
│   ├── code-style.md
│   ├── complexity.md     # Plugin Law E thresholds + per-stack tool table
│   ├── git-workflow.md   # Plugin Law D (stacked PRs) + Conventional Commits
│   ├── linting.md        # universal linting rules + auto-fix policy
│   ├── secrets-scanning.md
│   └── testing.md        # TDD, pyramid, quality rules, Law B automation
├── ts/                   # TypeScript / JavaScript overlay
│   ├── code-style.md
│   ├── linting.md        # ESLint + sonarjs
│   ├── testing.md        # Vitest + Playwright
│   └── tooling.md        # tsconfig strict, husky/lint-staged
├── python/
│   ├── linting.md        # Ruff + mypy + Bandit
│   ├── testing.md        # pytest + Testcontainers + Playwright-py
│   └── tooling.md        # uv, pre-commit, pydantic-settings
├── java/
│   ├── linting.md        # Checkstyle + PMD + SpotBugs + ErrorProne
│   ├── testing.md        # JUnit 5 + AssertJ + Testcontainers + Playwright-java
│   └── tooling.md        # Maven wrapper, Spotless, pre-commit
└── swift/                # scaffolded, deep integration deferred
    └── README.md
```

Reference: `docs/stack-equivalents.md` for the concern ↔ tool matrix.

## Init-skill copy rules

1. Always copy every file in `base/`.
2. Read `weave.stack.language` from `.claude/settings.json`.
3. Copy every file in the matching overlay directory.
4. Emit the tree to `docs/standards/` in the generated project.

If `WEAVE_STANDARDS_NONE=1` is set, Init skips this copy entirely — the
user has declared an override path.
