# Swift — overlay (scaffolded, deferred)

Full Swift integration is deferred from the current overnight suite due to
iOS toolchain weight. This directory is scaffolded so Init skill's copy path
doesn't break when a future project selects `--stack swift-*`.

Minimum viable overlay will cover:

- `linting.md` — SwiftLint config (cyclomatic_complexity, cognitive_complexity,
  function_body_length, file_length, function_parameter_count, nesting).
- `testing.md` — XCTest / swift-testing layout, XCUITest browser-like automation.
- `tooling.md` — SwiftPM, swift-format, swift-log + swift-distributed-tracing.

Until authored, Swift projects fall back to the `base/` universals and must
enumerate their own stack-specific tools in the tech-spec `infrastructure.md`
shard, per the exotic-stack escape hatch in `docs/stack-equivalents.md`.
