---
name: init
description: Scaffolds the .claude/ spec and state spine plus docs/ coding standards. Runs first when the user runs /init, before any other Weave command.
---

# Init

Scaffold the `.claude/` spec and state spine (`docs/specs/`, `.claude/state/`) plus `docs/standards/` coding standards. This is the first step before running any other Weave command.

## Trigger

- User runs `/init`
- Optional: `--stack <shortcode>` (opinionated quick path — see Step 0)
- Optional: `--advanced` (enables test-framework override prompt in MCQ flow)

## Instructions

### Step 0: Resolve Tech Stack

Resolve the tech stack **before** any file writes. Result is a `stack` object used in Step 5.

#### Option A — `--stack <shortcode>` supplied

Accept the following shortcodes as an opinionated quick path. Each shortcode maps
to a fully pre-filled `stack` object; skip the MCQ entirely.

| Shortcode | language | framework | package_manager | test_framework | e2e_framework | cloud_provider | iac |
|---|---|---|---|---|---|---|---|
| `ts-nextjs-aws` | typescript | nextjs | npm | vitest | playwright | aws | cdk-ts |
| `ts-nextjs-azure` | typescript | nextjs | npm | vitest | playwright | azure | bicep |
| `ts-express-aws` | typescript | express | npm | vitest | playwright | aws | cdk-ts |
| `python-fastapi-aws` | python | fastapi | uv | pytest | playwright-python | aws | cdk-python |
| `python-fastapi-azure` | python | fastapi | uv | pytest | playwright-python | azure | pulumi-python |
| `python-django-aws` | python | django | uv | pytest | playwright-python | aws | cdk-python |
| `java-spring-aws` | java | spring-boot | maven | junit5 | playwright-java | aws | cdk-java |
| `java-spring-azure` | java | spring-boot | maven | junit5 | playwright-java | azure | bicep |
| `swift-vapor-aws` | swift | vapor | swiftpm | xctest | xcuitest | aws | cdk-ts |

Custom stack combinations (any combo not in this table) must use Option B.

#### Option B — MCQ flow (no `--stack` argument)

Use `AskUserQuestion` for each of the following in order. Questions are sequential
(wait for each answer before asking the next).

1. **Language**
   Choices: `typescript`, `python`, `java`, `swift`, `other (exotic stack — see docs/stack-equivalents.md)`

   - If user picks `other`: prompt for free-text `language`, `framework`, and
     `package_manager`. Warn the user: "Exotic stacks are not in the Weave
     matrix. No few-shot examples or deep tooling support will be available. You
     are accepting the bus-factor risk documented in `docs/stack-equivalents.md`
     (Exotic stack escape hatch section)."
     Set `test_framework` and `e2e_framework` to `"custom"`. Skip to database
     question.

2. **Framework** (choices conditional on language — Web framework row of `docs/stack-equivalents.md`)
   - `typescript` → `nextjs`, `express`, `nestjs`, `fastify`
   - `python` → `django`, `fastapi`, `flask`
   - `java` → `spring-boot`, `quarkus`, `micronaut`
   - `swift` → `vapor`, `hummingbird`

3. **Package manager** (choices conditional on language)
   - `typescript` → `npm`, `pnpm`, `yarn`
   - `python` → `uv`, `poetry`, `pip-tools`
   - `java` → `maven`, `gradle`
   - `swift` → `swiftpm`

4. **Cloud provider**: `aws`, `azure`, `none (local-only)`

5. **Primary database**: `postgres`, `mysql`, `sqlite`, `dynamodb`, `cosmos`,
   `mongodb`, `pgvector`, `s3vectors`, `snowflake`, `databricks`

6. **IaC** (conditional — only asked when cloud_provider is `aws` or `azure`)
   - `aws` choices: `cdk-ts`, `cdk-python`, `cdk-java`, `sam`, `cloudformation`, `pulumi-ts`, `pulumi-python`, `none`
   - `azure` choices: `bicep`, `pulumi-ts`, `pulumi-python`, `none`
   - When `none (local-only)`: set `iac` to `"none"` and skip this question.

**Auto-resolve** (do not re-prompt unless `--advanced` is supplied):

| language | test_framework | e2e_framework |
|---|---|---|
| typescript | vitest | playwright |
| python | pytest | playwright-python |
| java | junit5 | playwright-java |
| swift | xctest | xcuitest |

If `--advanced` is supplied, ask `AskUserQuestion` after the IaC question:
- "Override test framework? (leave blank to accept default: `<auto-resolved value>`)"
- "Override E2E framework? (leave blank to accept default: `<auto-resolved value>`)"

### Step 1: Detect Project State

Detect the current project state:

| Condition | Path |
|-----------|------|
| `docs/specs/` exists | Already initialized → confirm reinit |
| Manifest exists (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `Gemfile`, `pom.xml`, `build.gradle`, `composer.json`) but NO `docs/specs/` | Brownfield → run discover → reconcile → optional interview → HITL gate |
| `prototype/` exists | PDD path (handled by Architect) |
| None of above | Greenfield → standard init |

**Brownfield path:** Run `${CLAUDE_PLUGIN_ROOT}/skills/dependency-check/SKILL.md` (brownfield-specific checks verify graphify is installed). Then invoke `${CLAUDE_PLUGIN_ROOT}/skills/discover/SKILL.md`, then `${CLAUDE_PLUGIN_ROOT}/skills/reconcile/SKILL.md` (mode A), then optionally `${CLAUDE_PLUGIN_ROOT}/skills/interview/SKILL.md`. Present reality-doc + graph for HITL review before continuing to Step 2.

**Already initialized:** Ask via AskUserQuestion:
- "A Weave project structure already exists. Reinitialize? This will NOT overwrite existing specs."

### Step 1.5: Detect and Coexist With Existing Agent Configs

Before creating any new context files, detect agent-context artefacts that may already exist. Never clobber. This step is idempotent — it writes `migration.lock` and becomes a no-op on subsequent runs.

**Files/dirs to detect** (at project root unless noted):

| Artefact | Purpose | Handling |
|---|---|---|
| `CLAUDE.md` | Existing Claude project memory | If content is non-template, preserve under `.legacy/<YYYY-MM-DD>/CLAUDE.md` and merge a pointer block into `.claude/CLAUDE.md` |
| `AGENTS.md` | Codex/OpenAI agent memory | Treat as canonical if present. `.claude/CLAUDE.md` becomes a one-line pointer (`@AGENTS.md`). Preserve original in place. |
| `.cursor/rules/` | Cursor rule files (`.mdc`) | Move directory contents to `.legacy/<date>/.cursor/rules/`, emit one-line mapping into `.claude/state/context/rule-candidates.md` per file for human promotion |
| `.continue/` | Continue config | Move to `.legacy/<date>/.continue/`. Flag in `MIGRATION_NOTES.md`. |
| `.github/copilot-instructions.md` | Copilot instructions | Leave in place (Copilot reads it). Reference from `.claude/CLAUDE.md`. |
| `.aider.conf.yml` | Aider config | Leave in place. No interaction. |

**Default mode is `--dry-run`.** Emit `MIGRATION_NOTES.md` at project root listing every detected file and the proposed action. Do NOT write `.claude/` or touch any detected file. Present the notes to the user via stdout and prompt via AskUserQuestion:

- **Proceed** — execute the migration; move to `.legacy/`, write `migration.lock`, continue to Step 2.
- **Cancel** — exit; no writes.
- **Customise** — present each detection and ask Preserve / Move-to-legacy / Ignore individually.

**Idempotence.** Write `migration.lock` at project root after successful migration:

```yaml
# Generated by weave init — do not edit by hand.
migrated_at: <ISO-8601>
preserved:
  - path: AGENTS.md
    action: canonical
preserved_in_legacy:
  - path: .cursor/rules/
    new_location: .legacy/<date>/.cursor/rules/
pointers_written:
  - from: .claude/CLAUDE.md
    to: AGENTS.md
```

If `migration.lock` exists, Step 1.5 skips entirely on re-runs — detections become status-only (printed, never acted upon).

**AGENTS.md canonical rule.** If AGENTS.md existed and had content:
- Write `.claude/CLAUDE.md` as a single line: `@AGENTS.md`
- AGENTS.md content gets the Weave domain-index section appended (below a `<!-- weave:managed -->` marker that delineates managed content). `reconcile` manages the region between markers; human content above/below is preserved verbatim.

**Never-delete law.** This step MUST NOT delete any file. Every original is either preserved in place (AGENTS.md, Copilot) or moved to `.legacy/<date>/`. The `.legacy/` tree is gitignored by default (add to Step 2's gitignore fragment).

### Step 2: Create Directory Structure

Create the following directories:
```
.claude/                      # Project config + spec/state spine
  specs/                      # Unified spec — docs/specs/weave/engines/<entity>.md (+ <entity>/04-arch/ files) created on demand by PO/architect skills (NOT pre-created here)
  state/
    summaries/
    escalations/
    discovery/                # Brownfield: graph.json
    context/                  # Brownfield: SME interview outputs
  _intake/                    # Gitignored: raw SME transcripts staging area
  rules/                      # Path-scoped unconditional constraints (≤60 lines each)
docs/
  standards/                  # Coding standards (base + stack overlay)
  discovery/                  # Brownfield: graph viz, reality doc, shards, index
```

Note: spec content is **entity-scoped** under `docs/specs/weave/engines/` and is created
on demand by the PO and architect skills — init only ensures the base `docs/specs/` directory
exists, never a flat `tech-spec/`/`tasks/`/`decisions/` tree. `docs/discovery/`,
`.claude/state/discovery/`, and `.claude/state/context/` are only populated during brownfield
init but are always created for structural consistency.

**Gitignore fragment** — ensure the project's `.gitignore` contains (append if missing):
```
# Weave — raw SME intake staging (scrubbed synthesis is promoted to .claude/state/context/)
.claude/_intake/
# Weave — legacy agent configs preserved by init Step 1.5
.legacy/
```

### Step 3: Copy Templates

Copy template files from the Weave plugin (`${CLAUDE_PLUGIN_ROOT}/templates/`) into the project:

**Standards — base + language overlay (skip entirely if `WEAVE_STANDARDS_NONE=1`):**

Always copy every file from `base/`:
- `${CLAUDE_PLUGIN_ROOT}/templates/standards/base/*.md` → `docs/standards/`

Then copy every file from the overlay matching `weave.stack.language`
(read from the just-written `.claude/settings.json`):
- `${CLAUDE_PLUGIN_ROOT}/templates/standards/ts/*.md` → `docs/standards/` (language `typescript`)
- `${CLAUDE_PLUGIN_ROOT}/templates/standards/python/*.md` → `docs/standards/` (language `python`)
- `${CLAUDE_PLUGIN_ROOT}/templates/standards/java/*.md` → `docs/standards/` (language `java`)
- `${CLAUDE_PLUGIN_ROOT}/templates/standards/swift/*.md` → `docs/standards/` (language `swift`)
- No overlay for `other` / exotic stacks — base only.

Overlay files with the same name as a base file **overwrite** the base file
(the overlay is the stack-specific version). See
`${CLAUDE_PLUGIN_ROOT}/templates/standards/README.md` for the full copy rules.

> **Note:** Previously this step listed individual flat paths under
> `templates/standards/`. Those files now live under `base/`. The behaviour is
> unchanged for `language=typescript` (default for `language=typescript`; for
> other languages see `docs/stack-equivalents.md`).

**Spec templates — do NOT copy at init.** Spec artefacts are entity-scoped and created on
demand: the PO and architect skills instantiate each artefact from `.claude/spec-templates/`
into `docs/specs/weave/engines/` when that entity reaches that phase. Init does not seed
a flat `brief.md`/`prd.md`/`roadmap.md`/`tech-spec/` set.

**Few-shot pointer marker:**

After standards copy, write:
- `<project>/.claude/weave-few-shot.txt` — one line:
  `plugins/weave/templates/few-shot/`

This lets engineers and agents locate stack-specific examples without
re-deriving the path.

### Step 4: Create Project Instructions

Create `.claude/CLAUDE.md` with the project name and basic conventions. This is the "schema layer" — the operational document that agents and humans co-evolve. Initial content should include:
- Project name
- Link to `docs/specs/` for requirements
- Link to `docs/standards/` for coding conventions
- If brownfield: link to `docs/discovery/graph.html` and `docs/discovery/brownfield-architecture.md`

### Step 5: Initialize State

Create `.claude/state/progress.json`:
```json
{
  "project": "",
  "phase": "init",
  "epics": [],
  "tasks": []
}
```

Create `.claude/settings.json` by merging the following structure. If the file
already exists, deep-merge (do not clobber keys not listed here):

```json
{
  "weave": {
    "version": "0.1.0",
    "stack": {
      "language": "<resolved from Step 0>",
      "framework": "<resolved from Step 0>",
      "package_manager": "<resolved from Step 0>",
      "test_framework": "<auto-resolved or overridden — default for language=typescript is vitest; for other languages see docs/stack-equivalents.md>",
      "e2e_framework": "<auto-resolved or overridden — default for language=typescript is playwright; for other languages see docs/stack-equivalents.md>",
      "iac": "<resolved from Step 0>",
      "cloud_provider": "<resolved from Step 0>",
      "database": "<resolved from Step 0>"
    },
    "linting": {
      "cyclomaticComplexity": 10,
      "cognitiveComplexity": 15
    },
    "git": {
      "commitFormat": "conventional",
      "branchPattern": "feature/TASK-{id}",
      "worktreeIsolation": true
    },
    "brownfield": {
      "scoutThresholds": {
        "totalNodes": 500,
        "topLevelClusters": 6,
        "largestClusterNodes": 150,
        "graphJsonSizeMb": 5
      },
      "freshness": {
        "sessionBannerAgeCommits": 50,
        "ruleStaleDays": 90,
        "shardStaleDays": 180,
        "adrStaleDays": 365
      },
      "coverage": {
        "minPctForDeepArtefacts": 85,
        "supportedLanguagesPath": "${CLAUDE_PLUGIN_ROOT}/templates/supported-languages.yml"
      },
      "claudeMd": {
        "rootLineCap": 60,
        "domainLineCap": 100,
        "ruleLineCap": 60,
        "shardLineCap": 200
      }
    }
  }
}
```

> **Note:** The legacy top-level `techStack` and `testing` keys are replaced by
> the `stack` block above. The `linting.eslint` and `linting.sonarjs` booleans
> are now language-determined by the stack overlay and are not hardcoded here.

### Step 6: Confirm

Display a summary:
```
Weave initialized successfully.

Created:
  docs/specs/          - Spec artifacts (brief, PRD, roadmap, tech-spec, epics, tasks)
  docs/standards/      - Coding standards (code-style, testing, git-workflow, linting)
  .claude/state/          - Progress tracking

Next steps:
  /po           - Start requirements elicitation with Product Owner
  /help         - View interactive guide
  /status       - View progress dashboard

Tip: When you reach /implement, the agent performs many autonomous
operations (file writes, git, npm, tests). For a smooth experience, start
your session with one of:
  claude --enable-auto-mode    (recommended — sandboxed auto-approve)
  claude --dangerously-skip-permissions   (no sandbox — use in trusted environments)
```

### Overwrite Rules

- Do NOT overwrite existing spec files if they already have content
- DO overwrite standards files (they are defaults, user customizes after)
- Always create `state/progress.json` fresh

## Evaluation Criteria

When testing this skill, verify:

- **Correct structure created**: All directories (specs/, specs/tech-spec/, specs/epics/, specs/tasks/, specs/decisions/, standards/, state/, discovery/, state/discovery/, state/context/) exist after init
- **No overwrites of existing specs**: If specs already have content, they are preserved; only empty templates are written to new files
- **Standards copied (base)**: All base standards files are present in `docs/standards/` when `WEAVE_STANDARDS_NONE` is unset
- **Standards copied (overlay)**: Language-specific overlay files are present in `docs/standards/` and have overwritten any same-named base files
- **Standards skipped**: When `WEAVE_STANDARDS_NONE=1`, no files are written to `docs/standards/`
- **Few-shot pointer written**: `.claude/weave-few-shot.txt` exists containing `plugins/weave/templates/few-shot/`
- **Stack shortcode path**: `--stack ts-nextjs-aws` skips MCQ and produces correct `weave.stack` block in `settings.json`
- **Stack MCQ path**: Without `--stack`, all six MCQ questions are asked in order; IaC question is skipped for `none (local-only)`
- **Exotic stack escape hatch**: Selecting `other` language shows the bus-factor warning and sets `test_framework`/`e2e_framework` to `"custom"`
- **Auto-resolved test tools**: `test_framework` and `e2e_framework` are populated without prompting (unless `--advanced`)
- **Settings stack block**: `.claude/settings.json` contains `weave.stack` with all eight fields populated
- **State initialized**: `progress.json` exists with correct initial structure (project empty, phase "init", empty arrays)
- **Project instructions created**: `.claude/CLAUDE.md` exists with project name and links to specs/standards
- **Reinitialize safety**: Running init on an existing project warns the user and does not destroy existing work
- **Confirmation displayed**: Summary output shows what was created and suggests next steps
- **Template placeholders removed**: No `{{...}}` placeholders remain in copied template files
- **Brownfield detection**: When `package.json` (or equivalent manifest) exists but `docs/specs/` does not, brownfield path is triggered
- **Brownfield discovery**: Discover skill is invoked, producing `docs/discovery/graph.html`, `docs/discovery/brownfield-architecture.md`, and shard files
- **Brownfield HITL gate**: User is presented with reality-doc for review before continuing
- **Greenfield regression**: Empty directory still takes the standard greenfield path
