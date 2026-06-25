---
name: prototype
description: Manages rapid prototypes via the Prototyper agent, each an independent project in prototype/{name}/ with its own dependencies and tech stack. Runs when the user runs /prototype or mentions prototyping, a spike, or a proof of concept.
---

# Prototype

Manage rapid prototypes using the Prototyper agent. Each prototype is an independent project in `prototype/{name}/` with its own dependencies and tech stack.

## Trigger

- User runs `/prototype`
- PO agent suggests after PRD approval
- Architect agent suggests after tech spec approval
- User mentions prototyping, spike, or proof of concept

## Instructions

### Step 1: Present Options

Every invocation asks via AskUserQuestion:

- **Start new prototype** — creates a new prototype project
- **Continue existing** — resumes work on an existing prototype
- **List prototypes** — shows all prototype projects and their status
- **Extract artefacts** — redirects to `/architect` which runs extraction

### Step 2a: Start New Prototype

Ask via AskUserQuestion:
1. **Name:** What should this prototype be called? (e.g., frontend-nextjs, api-express, infra-cdk)
2. **Type:** What kind? (Frontend UI / API / Infrastructure / Data model / Other)
3. **Tech stack:** What tech? (Next.js / Vite+React / Express / CDK / Terraform / Serverless Framework / Other)

Then:
1. Create `prototype/{name}/` directory
2. Scaffold based on type:
   - **Frontend:** Atomic Design structure (atoms/, molecules/, organisms/, pages/, flows/) + package.json
   - **API:** src/ + openapi.yaml placeholder + package.json
   - **Infrastructure:** appropriate config file (cdk.json / terraform/ / serverless.yml)
   - **Data model:** migrations/ + seed/
3. Create empty `prototype/{name}/DECISIONS.md` from template
4. Launch Prototyper agent in a worktree for `prototype/{name}/`

### Step 2b: Continue Existing Prototype

1. List prototype projects in `prototype/` directory
2. Present as options via AskUserQuestion
3. Launch Prototyper agent in a worktree for the selected project

### Step 2c: List Prototypes

Scan `prototype/` directory and display:

```
Prototype Projects:
  frontend-nextjs/    [Frontend, Next.js]     DECISIONS.md: yes    E2E tests: 3 files
  frontend-vite/      [Frontend, Vite+React]  DECISIONS.md: no     E2E tests: 0 files
  api/                [API, Express]          DECISIONS.md: yes    OpenAPI: yes
  infra-cdk/          [Infrastructure, CDK]   DECISIONS.md: no     Config: cdk.json
```

### Step 2d: Extract Artefacts

Tell the user: "Extraction is handled by the Architect. Run `/architect` — it will detect your prototypes and extract artefacts into the tech spec."

### Agent Communication

When launching the Prototyper, remind the user of the value proposition:

> "Prototyping lets you explore approaches quickly. You can build competing approaches,
> put flows in front of users for testing, and experiment risk-free.
> When ready, tell me to write E2E tests, generate OpenAPI specs, or update DECISIONS.md.
> The prototype is disposable — the value is in what we learn and extract."

### Worktree Isolation

Each prototype project gets its own git worktree. The Prototyper agent works in isolation for that project without affecting other prototype projects or the main codebase.

## Evaluation Criteria

- Presents 4 options on every invocation (new/continue/list/extract)
- New prototype creates correct directory structure for the type
- DECISIONS.md template created for new prototypes
- Prototyper agent launched in worktree for the correct project
- List shows all prototype projects with accurate status
- Extract redirects to Architect (doesn't do extraction itself)
- Agent communication includes value proposition
