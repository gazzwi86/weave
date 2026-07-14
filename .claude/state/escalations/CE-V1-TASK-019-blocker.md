# CE-V1-TASK-019 blocker — upstream stories missing, DoR unsatisfied

## What the task asks (in plain terms)

TASK-019 is the "close the epic" task for Import & Ingest (EPIC-012). It wants one page that
lets a user: upload a document, optionally add some context, watch a job list, then review and
accept/reject what the AI found — for **five different import types**: plain documents, BPMN/
ArchiMate diagrams, pictures of diagrams, spreadsheet-style structured data (R2RML/RML), and a
"these two things are the same, merge them" reconciliation step. It also wants a full end-to-end
browser test proving all of that works against the real backend, and it wants three CI checks
made permanent (checks that run on every future change, forever).

## What I found when I checked the ground

The task brief lists six earlier tasks it depends on (TASK-013 through TASK-018). I checked each:

- **TASK-013** (chat-based document upload) — built, shipped, working.
- **TASK-014** (storing the uploaded documents so the AI can search them later) — built, shipped, working.
- **TASK-015** (BPMN/ArchiMate diagram import), **TASK-016** (picture-to-data import),
  **TASK-017** (spreadsheet/structured-data import), **TASK-018** (merge-duplicates step) —
  **none of these exist.** No task brief file, no code, no commit, nothing. I grepped the ingest
  code directly: the only import type the backend knows how to handle is a plain document. There
  is no BPMN reader, no diagram reader, no spreadsheet reader, and the data shape returned by the
  server (`IngestProposal`) has no field to say "this is a merge — here are the two things being
  combined." The plumbing for those four features was never built.

The task brief's own pre-flight checklist ("DoR Checklist") already has this flagged — two boxes
are left unchecked: "TASK-013..018 merged" and "M1 program gate green." I'm treating those
unchecked boxes as the brief telling me not to start until they're resolved, which is what the
standing engineering rule says to do (verify the pre-flight checklist before starting).

## Why I'm stopping instead of building it anyway

If I build the page and the end-to-end test as written, three of the seven acceptance criteria
cannot pass, because the thing they test doesn't exist:
- The "review a merge proposal side-by-side" requirement has no data to render.
- The "import a BPMN file, get mapped proposals" leg of the end-to-end test has no BPMN reader to
  call.
- Marking the CI checks "permanent" and folding them into the project's permanent invariants file
  would certify five import paths as done when only one is done. That's a false record other
  people (and the phase-gate sign-off) will rely on later.

Building tests that can't pass, or that quietly test less than they claim to, isn't a shortcut —
it's a wrong result with a green checkmark on it.

## Two ways forward

**Option A — build the honest subset now, don't call the epic closed.**
Ship the import page for what's actually built: upload a plain document, optional context step,
job list, review/accept/reject (the single-card view, not side-by-side merge). Ship the two
end-to-end tests that are actually possible today (document upload → accept/reject → graph
changed; and the "ask a question, get an answer with a citation back to the uploaded document"
loop). Wire only the two CI checks whose subject exists today (no second way to change the graph;
document search never changes the graph). Skip the third CI check (about the spreadsheet-import
config) and the "epic is done" paperwork — clearly mark it as not done, pending the four missing
stories.
- *Trade-off:* forward progress now, but the epic is still open — someone has to come back and do
  it properly once TASK-015 through TASK-018 are actually written and built. Some UI (a proposal
  review table that only ever needs to handle one proposal shape) may need small rework once the
  merge/BPMN shapes exist.

**Option B — hold this task entirely** until TASK-015–018 are written up and built, then do the
real close in one pass.
- *Trade-off:* no forward progress today, but avoids touching the import page twice.

## My recommendation

Option A. It banks real, tested, working functionality now instead of sitting idle, and it does
so honestly — nothing is marked "done" that isn't. The one thing to watch: the "epic closed" /
"all five import paths covered" claims must not be made anywhere (commit message, PR title, task
status) until the missing four stories land.
