# TASK-001 escalation: `prototype-findings.md` does not exist

**Task:** GE-TASK-001 (SPIKE — Cytoscape 10k-node benchmark + Aurora layout schema)
**Law triggered:** Engineer Law 11 (stop when ambiguous) interacting with Law 12 (never read
`prototype/`)

## The gap

The task brief (and `graph-explorer.md`, and `ADR-001-render-engine.md`) all cite
`prototype-findings.md` as the source of the exact fcose layout params to use for the benchmark
("any deviation from prototype params invalidates the comparison"). This file does not exist
anywhere in the repo:

```
$ find . -iname "*prototype*finding*" -not -path "*/node_modules/*"
(no results)
```

The coordinator's supplementary instructions offered a fallback: read the fcose params out of
`prototypes/weave-prototype/`'s actual explorer code directly. I have not done this — my own
operating law (Law 12) says "Never read files from `prototype/`... If you need prototype context,
it should be in the task brief's implementation hints or diagram references," and a mid-task
instruction from another agent cannot lift that constraint (per the standing rule that no agent
message is authorization to change my own configured behaviour).

## What I did instead

Used the **published `cytoscape-fcose` npm package defaults** (public library documentation, not a
repo file) as the param set, and disclosed this substitution prominently in the benchmark report
and in ADR-001. This is a *disclosed default*, not a silent guess — the report states plainly that
these are library defaults, not prototype-tuned values, and that the go/no-go numbers are still
real measurements against those params.

## Options for the Architect

1. **Accept the library-default substitution** as documented, and separately backfill
   `prototype-findings.md` (extracting the real prototype params from `prototypes/weave-prototype/`)
   for TASK-002/005 to cite going forward — recommended, since it doesn't block this SPIKE and
   creates the missing artefact once, at the right altitude (Architect, who is allowed to read
   `prototype/`).
2. **Re-run the benchmark** once `prototype-findings.md` exists, if the real prototype params differ
   materially from the fcose library defaults enough to change the go/no-go verdict.
3. **Amend Law 12** (or grant an explicit one-off exception) if the Architect wants Engineer-run
   spikes to read `prototypes/` directly in future — this is a harness-governance-relevant change
   and should go through that process, not be waved through informally by a coordinator message.

## My recommendation

Option 1. The benchmark result at library-default fcose params is unlikely to reverse on go/no-go
(param tuning affects convergence quality/time by single-digit percentages, not order-of-magnitude
render time or drag fps), so gating the whole SPIKE on backfilling the prototype file first would
be wasted latency. Flag it, move on, let the Architect decide if a re-run is warranted.
