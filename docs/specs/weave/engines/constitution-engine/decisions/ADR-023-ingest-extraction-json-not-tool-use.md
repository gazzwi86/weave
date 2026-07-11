---
type: ADR
title: "ADR-023: Document extraction uses JSON+Pydantic typed output, not native tool-calling"
description: "CE-V1-TASK-013's document extractor gets typed, schema-validated output from the LLM
  by mirroring authoring/nl_parser.py's JSON-prompt + fence-strip + Pydantic-validate pattern,
  rather than extending ModelProvider with native Anthropic/Bedrock tool-calling, because no
  tool-calling infra exists in-repo and Ollama has no equivalent tool API."
tags: [constitution-engine, adr, ingest, ai, ai-agents]
status: Accepted
timestamp: 2026-07-11T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-023-ingest-extraction-json-not-tool-use.md
date: 2026-07-11
entity: constitution-engine
---

# ADR-023: Document extraction uses JSON+Pydantic typed output, not native tool-calling

## Status

Accepted (decided before CE-V1-TASK-013 RED phase, advisor-flagged + team-lead-approved escalation).

## Context

TASK-013's brief (Design Decisions table) requires the document-extraction LLM call to return
"typed tool output... Op shape, no free-text parsing layer" rather than free text an extractor
then NLP/regex-parses. The obvious literal reading is Anthropic's native tool-calling
(`tools=[...]`, `tool_use` response blocks). A repo-wide grep for `tool_use`/`tools=`/
`input_schema` under `packages/backend/src/` returned zero hits — no provider wires native
tool-calling. `ai/providers.py::ModelProvider.complete(model_id, prompt, **kwargs) -> str` is
plain text in/out across all three providers (`AnthropicProvider`, `BedrockProvider`,
`OllamaProvider`); `OllamaProvider` in particular has no equivalent tool-schema API to map onto.

## Decision

- The document extractor prompts for JSON matching the CE-WRITE-1 `Op` schema, strips a markdown
  code fence if present, `json.loads`s it, then validates strictly via Pydantic
  (`ApplyRequest`/`AddNodeOp` etc.) — the exact pattern already proven in
  `authoring/nl_parser.py::parse_operations`.
- This satisfies "typed output": Pydantic validation rejects any response that doesn't match the
  `Op` discriminated union, exactly as native tool-calling's `input_schema` would. What the brief's
  "no free-text parsing layer" rules out is NLP/regex extraction from prose — not schema-validated
  JSON parsing, which this is.
- Native tool-calling is **not** built here. Extending `ModelProvider` (used by every AI caller in
  the repo, e.g. `ai/router.py`, `authoring/nl_parser.py`) with a `complete_tool()` capability
  across 3 providers, with an unresolved Ollama story, is a cross-cutting `ModelProvider` infra
  change — out of scope for a single feature task. Logged as a follow-up by team-lead if native
  tool-calling is wanted later.

## Consequences

- Zero new dependencies, zero `ModelProvider` interface change — the extractor is a pure consumer
  of the existing `ai/router.py::route()` call, same Law F `_StubProvider` stub pattern as
  `test_authoring_nl_parser.py`.
- If a later task needs real tool-calling (e.g. multi-turn agentic extraction), it must first land
  the `ModelProvider` infra change as its own task, not bundle it into a feature task's diff.

## Alternatives Considered

- **Extend `ModelProvider` with native tool-calling now.** Rejected: cross-cutting shared-interface
  change with an unresolved Ollama story, no in-repo precedent, would absorb infra scope into a
  feature task.
- **Free-text response + regex/NLP entity extraction.** Rejected: exactly what the brief's "no
  free-text parsing layer" forbids, and strictly worse than JSON+Pydantic (silent mis-extraction
  instead of a validation error).
