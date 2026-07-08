---
name: Never delete descoped task briefs
description: Tasks/epics moved to post-v1 keep their brief files — relocate to post-v1/tasks/, never delete
type: feedback
created: 2026-07-08
---

When a task or epic is descoped to post-v1 (or any later milestone), its task-brief file is
**moved** to the engine's `post-v1/tasks/` directory — never deleted.

**Why:** user instruction 2026-07-08 ("don't delete them and lose them, they will be useful") —
descoped briefs carry elicited scope, ACs, and design decisions that get re-used when the item is
picked back up.

**How to apply:** any milestone re-scope, spec merge, or roadmap ruthless-cut: `git mv` the brief
into `post-v1/tasks/`, annotate its frontmatter (milestone: post-v1 + one-line reason), keep it out
of progress.json active phases. Applies to the 2026-07-08 m2→v1 merge and all future cuts.
