---
name: project-memory
description: Project-scoped memory for the weave repo. Invoke when the user states a team convention, technical decision, project state, external-system pointer, or any fact about *this codebase / this team / this initiative*. Also invoke for `/remember` and when about to save something but unsure whether it belongs in project or user memory. Skip for personal preferences (those go to user-level memory).
---

# Project memory

This skill governs writes to `.claude/memory/` — the team-shared, committed-to-git memory layer for this repo. It works alongside the user-level auto-memory at `~/.claude/projects/*/memory/`. Both load every session; on conflict for this repo, project memory wins.

## Routing — the discriminator

Before writing, classify the fact. **Project memory** if the fact is about:
- This codebase: architectural decisions, why a library was chosen, why a constraint exists
- This team: conventions specific to this repo, agreed-upon patterns, who owns what
- This initiative: ongoing work, deadlines, milestones, incidents, blockers
- External systems this project uses: Linear projects, Grafana boards, channels, dashboards, runbook locations

**User memory** (defer to `~/.claude/CLAUDE.md` "auto memory" rules — write nothing here) if the fact is about:
- Gareth's role, expertise, knowledge level, learning goals
- Personal preferences for style, tooling, response format
- Behaviors to repeat or avoid that aren't repo-specific

**Both** if the fact has a personal half and a project half — split it. Write the project half here, defer the personal half to user memory.

## Types

Every memory file declares one type in frontmatter. Pick exactly one.

- **project** — initiatives, deadlines, ongoing work, who's doing what, incidents. Decays fast. Always include `expires` if you can estimate one.
- **decision** — technical or architectural decisions and their rationale. The why behind code that grep won't reveal. Long-lived.
- **feedback** — team conventions and corrections specific to this codebase. Distinct from user-level personal feedback. Long-lived.
- **reference** — pointers to external systems (Linear, Grafana, Slack channels, runbooks, dashboards). Long-lived.

If a fact doesn't fit any of these, it probably doesn't belong in memory.

## What NOT to save

Hard exclusions, even when the user asks. If the fact is already covered by one of these, refuse and explain:

- **Code conventions** → already in `.claude/rules/code-style.md`, `testing.md`, `security.md`
- **File paths, project structure, exports, dependencies** → derivable from `ANATOMY.md` and `docs/wiki/`
- **Git history, recent changes, who-changed-what** → `git log` / `git blame`
- **Build commands, top-level layout, conventions** → already in top-level `CLAUDE.md`
- **Per-package conventions** → already in per-package `CLAUDE.md` files
- **Debugging recipes / fix solutions** → the fix is in the code; the commit message has the why
- **Ephemeral state** — current task, in-progress thinking, conversation context

Before saving, do a quick mental check: would a teammate find this in CLAUDE.md, rules, ANATOMY, or git? If yes, do not save.

## Write protocol

Two steps, mirroring the user-level auto-memory pattern.

**Step 1** — write the memory to its own file at `.claude/memory/<type>_<topic>.md`:

```markdown
---
name: {{short title, sentence case}}
description: {{one line, specific — used for relevance matching in future sessions}}
type: {{project | decision | feedback | reference}}
created: {{YYYY-MM-DD}}
expires: {{YYYY-MM-DD, optional — only for type: project}}
---

{{Lead with the fact or rule.}}

**Why:** {{the motivation — constraint, deadline, stakeholder ask, past incident}}
**How to apply:** {{when this should shape suggestions, what files / decisions it touches}}
```

**Step 2** — add a one-line pointer to `.claude/memory/MEMORY.md` under the `## Index` heading:

```
- [{{Title}}]({{file.md}}) — {{one-line hook, under 100 chars}}
```

Keep `MEMORY.md` under 200 lines total — it loads at SessionStart in full. If it grows past that, prune expired `project` entries first.

## File naming

`<type>_<short_topic>.md` — lowercase, underscores, no dates in filename. Examples:

- `decision_audio_engine.md` — why Web Audio API over Tone.js
- `decision_loop_id_format.md` — ulid vs uuid
- `project_demo_milestones.md` — dates for the May 2026 demo
- `feedback_no_session_storage.md` — team agreed not to use sessionStorage for audio buffers
- `reference_dynamodb_local_seed.md` — where the seed script lives and what it does

## Updating and pruning

- If a new fact contradicts an existing memory, update the existing file rather than writing a new one. Update `created` to today.
- On SessionStart, scan for `expires` dates in the past. Remove those memories and their index entries.
- If a memory is wrong or outdated, remove it — both the file and the index line.
- Never duplicate. Before writing, grep `.claude/memory/` for the topic.

## Triggers

You should consider invoking this skill when:

- The user says "we decided", "the team prefers", "always X in this repo", "from now on for this project"
- The user invokes `/remember <fact>`
- A technical decision was just made and the rationale would be lost otherwise
- An external-system pointer is mentioned ("the dashboard at...", "tracked in Linear project X")
- The user corrects you in a way that's specific to this repo, not personal style

You should NOT invoke this skill for:

- Personal preferences ("I like terse responses") — those go to user memory
- Things the user is just thinking aloud about
- Anything in the do-not-save list above

## Confirmation

After writing, state in one line what you saved and where. Example: "Saved: `.claude/memory/decision_loop_id_format.md` and indexed in `MEMORY.md`." Do not summarise the content back to the user.
