# CE-V1-TASK-014 blocker — TASK-015 dependency is real, not phantom

## What the dispatch note said

Dispatch instructions said CE-V1-TASK-015 "DOES NOT EXIST in progress.json (phantom
dependency — treat as satisfied)", with a fallback: "if the brief genuinely needs a TASK-015
artefact that isn't on main, STOP and report."

## What I found

TASK-015 does exist, but it was moved to the `post-v1` milestone, not `v1`:
`docs/specs/weave/engines/constitution-engine/post-v1/tasks/TASK-015.md` — "Structured Model
Import: ArchiMate Exchange Format + BPMN" (parses ArchiMate/BPMN XML into RDF, ships the
element→BPMO-kind mapping). It is not in `.claude/state/progress.json` at all (neither v1 nor
post-v1 list has an entry for it), and nothing on `main` implements an XML notation parser for
ArchiMate/BPMN.

TASK-014's brief (`docs/specs/weave/engines/constitution-engine/v1/tasks/TASK-014.md`) requires
this artefact directly, not incidentally:

- AC-003-01 requires an XML per-element-with-parent-context splitter "reusing TASK-015's
  notation parse for ArchiMate/BPMN XML" under an explicit "no second parser" rule.
- Pseudocode: `xml = TASK-015's parsed notation model`.
- Named unit test: "should split XML per element with parent context prepended (consuming a
  TASK-015 parsed-model fixture — no XML parsing in this module)".
- Dependencies section: "TASK-015 supplies the XML parse the per-element splitter consumes... a
  new XML parser [is forbidden]."
- DoR checklist item (unchecked in the brief itself): "TASK-012 + TASK-013 + TASK-015 merged".

So this is not a stale/renumbered ID slip — it is a genuine cross-milestone dependency gap: the
v1 task brief for TASK-014 was authored assuming TASK-015 would land in v1, but TASK-015 was
subsequently rescoped to post-v1 and the TASK-014 brief was never updated to match.

## Options

1. **Build a minimal/local XML parse just for the fixture, honestly labelled as a fixture, not
   production reuse.** Violates the brief's explicit "no second parser" rule and produces a fake
   TASK-015 substitute inside TASK-014's scope — exactly what the rule was written to prevent.
2. **Descope AC-003-01's XML branch from this task; ship prose splitter + fixed-window fallback
   only, and mark the XML branch as blocked-by-TASK-015 (post-v1).** This is a genuine partial
   delivery of TASK-014, consistent with the "partial-epic (019 deferred)" framing already in the
   dispatch note. All other ACs (AC-003-02 through 08) do not depend on TASK-015.
3. **Stop entirely and wait for a corrected brief / architect decision** before writing any code.

## My read

Option 2 looks right and lowest-risk: it delivers the parts of TASK-014 that are actually
unblocked (embeddings, retrieval, tenant isolation, citations, prose + fallback chunking,
lifecycle, the no-write-path CI assert) and defers only the XML-specific chunking branch, which
has a real, named, not-yet-built upstream dependency. But this is a scope decision on an
architect-owned brief, not something I should silently decide — the brief's own AC-003-01 wording
doesn't carve out "unless XML" as optional, and "unknown-format-still-chunks" is named as
release-worthy, so leaving out the ArchiMate/BPMN XML case changes what "TASK-014 done" means
without the architect having said so.

## Recommendation

Escalating per Law 11 rather than assuming. Stopped before writing any code or tests.
