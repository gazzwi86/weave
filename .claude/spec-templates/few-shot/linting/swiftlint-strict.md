---
topic: linting
stack: swift
references:
  - docs/stack-equivalents.md
  - templates/standards/base/complexity.md
---

# SwiftLint — Plugin Law E thresholds for Swift 5.10+

.swiftlint.yml with all Plugin Law E gates. Cognitive complexity is partial
in SwiftLint — use cyclomatic_complexity as the primary gate.

```yaml
# .swiftlint.yml
disabled_rules:
  - trailing_whitespace   # handled by swift-format

opt_in_rules:
  - cyclomatic_complexity
  - function_body_length
  - file_length
  - function_parameter_count
  - nesting
  - closure_body_length
  - force_try
  - force_cast
  - empty_count
  - contains_over_filter_count
  - first_where
  - redundant_nil_coalescing
  - sorted_imports

# -- Plugin Law E: cyclomatic complexity (≤ 10) ------------------------------
cyclomatic_complexity:
  warning: 8
  error:   10
  ignores_case_statements: false   # count switch arms

# -- Plugin Law E: cognitive complexity (partial — SwiftLint 0.55+) ----------
# Note: SwiftLint's cognitive_complexity is an approximation of Sonar's scale.
# Enable when available in your SwiftLint version.
# cognitive_complexity:
#   warning: 12
#   error:   15

# -- Plugin Law E: function body length (≤ 50 lines) -------------------------
function_body_length:
  warning: 40
  error:   50

# -- Plugin Law E: file length (≤ 300 lines) ----------------------------------
file_length:
  warning: 250
  error:   300
  ignore_comment_only_lines: true

# -- Plugin Law E: parameters (≤ 5) ------------------------------------------
function_parameter_count:
  warning: 4
  error:   5
  ignores_default_parameters: false

# -- Plugin Law E: nesting (≤ 4) ---------------------------------------------
nesting:
  type_level:
    warning: 2
    error:   3
  function_level:
    warning: 3
    error:   4

# -- Closure body length (bonus gate) ----------------------------------------
closure_body_length:
  warning: 30
  error:   40

# -- Paths -------------------------------------------------------------------
included:
  - Sources
  - Tests

excluded:
  - .build
  - Packages
  - "**/*.generated.swift"

# -- Reporter ---------------------------------------------------------------
reporter: xcode   # Xcode inline annotations; use 'github-actions-logging' in CI
```

```bash
# Install
brew install swiftlint
# or via SwiftPM plugin in Package.swift

# Run
swiftlint lint --strict               # non-zero exit on any violation
swiftlint lint --reporter json        # JSON for tooling
swiftlint autocorrect                 # fix auto-correctable violations
```

```swift
// Waiver syntax (Plugin Law E)
// swiftlint:disable:next cyclomatic_complexity
// weave: allow-complex reason="exhaustive switch on Codable error kind; splitting loses context"
func classify(_ err: Error) -> ErrorCategory {
    switch err {
    // ...10+ arms
    default: return .unknown
    }
}
```

**Why:** Warning thresholds set below error thresholds give engineers early
feedback before CI fails. `ignores_case_statements: false` counts each `case`
arm — consistent with the other stacks' definitions of cyclomatic complexity.
