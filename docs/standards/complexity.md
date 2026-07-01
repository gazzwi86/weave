---
type: Coding Standard
title: Complexity Gates — Coding Standard
description: "Cyclomatic and cognitive complexity budgets enforced across the codebase."
tags: [standards, complexity]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/complexity.md
---

# Complexity gates — universal base

**Plugin Law E: complexity as a budget.** Every Weave-generated project
enforces the gates below. Waivers are permitted only with a non-empty reason
string logged to `.claude/state/complexity-waivers.md` for human audit.

The goal is **human comprehension debt management.** Code a machine can parse
but a human cannot is a failure mode — large functions, deep nesting, many
parameters, long files. These gates keep the surface understandable.

## Universal thresholds

| Metric | Threshold | Rationale |
|---|---|---|
| Cyclomatic complexity per function | ≤ 10 | McCabe's classic boundary; above this, paths become unmanageable |
| Cognitive complexity per function | ≤ 15 | Sonar's scale; tracks *felt* difficulty, not just branches |
| Function length | ≤ 50 lines | Forces single-responsibility |
| File length | ≤ 300 lines | Forces module decomposition |
| Max function parameters | ≤ 5 | Above this, use an object / struct / record arg |
| Max nesting depth | ≤ 4 | Deeper = extract a helper |

## Per-stack enforcement

| Stack | Cyclomatic | Cognitive | Fn length | File length | Params | Nesting |
|---|---|---|---|---|---|---|
| TS / JS | `eslint-plugin-sonarjs` `cyclomatic-complexity` | `eslint-plugin-sonarjs` `cognitive-complexity` | `max-lines-per-function` | `max-lines` | `max-params` | `max-depth` |
| Python | Ruff `C901` (mccabe) / Radon `cc` | `flake8-cognitive-complexity` / lizard CCN | Ruff `PLR0915` / `max-statements` | Ruff / pyproject `per-file-ignores` | Ruff `PLR0913` | Ruff `PLR1702` |
| Java | Checkstyle `CyclomaticComplexity` | SonarQube cognitive | Checkstyle `MethodLength` | Checkstyle `FileLength` | Checkstyle `ParameterNumber` | Checkstyle `NestedIfDepth` |
| Swift | SwiftLint `cyclomatic_complexity` | SwiftLint `cognitive_complexity` (partial) | SwiftLint `function_body_length` | SwiftLint `file_length` | SwiftLint `function_parameter_count` | SwiftLint `nesting` |

## CI enforcement

CI fails if any metric is exceeded without a waiver comment carrying a
non-empty reason. Example waiver syntax per stack:

**TypeScript**
```ts
// eslint-disable-next-line sonarjs/cognitive-complexity -- weave: allow-complex reason="parser table for legacy format, unrolling hurts readability"
function parseLegacyPayload(input: string) { ... }
```

**Python**
```python
# noqa: C901 -- weave: allow-complex reason="dispatch on 9-variant enum, splitting obscures control flow"
def handle(event): ...
```

**Java**
```java
@SuppressWarnings("CyclomaticComplexity") // weave: allow-complex reason="state-machine transition — 11 arms by design"
int transition(State s, Event e) { ... }
```

**Swift**
```swift
// swiftlint:disable:next cyclomatic_complexity - weave: allow-complex reason="exhaustive switch on Codable error kind"
func classify(_ err: Error) -> Category { ... }
```

## Waiver log

Every waiver is mirrored to `.claude/state/complexity-waivers.md` during CI:

```markdown
## {{YYYY-MM-DD}} — {{commit sha}}

- `src/parser.ts:42` cognitive-complexity
  - Reason: "parser table for legacy format, unrolling hurts readability"
  - Author: {{git committer}}
- `app/state_machine.py:88` C901
  - Reason: "dispatch on 9-variant enum, splitting obscures control flow"
  - Author: {{git committer}}
```

QA reviews this log as part of Category 11 (Complexity). Patterns repeated
across multiple files are flagged for refactor in the QA report.

## Why ranges, not precise values

These are **soft floors** for human comprehension, not objective truth. A
function at cyclomatic 9 is not universally "easier" than one at 11. Use the
gates to catch 30+ cyclomatic gremlins, not to moralise about 10 vs 11. The
waiver mechanism exists precisely so honest edge cases get through with a
written justification instead of via disabled rules scattered across the repo.

---

*Universal base. Tool configuration per stack: [`tooling-ts.md`](tooling-ts.md), [`tooling-py.md`](tooling-py.md).*
