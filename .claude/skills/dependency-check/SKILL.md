---
name: dependency-check
description: Verify required system dependencies and credentials before scaffolding or at the start of each new phase. Invoked by /implement before scaffolding and at each phase boundary, or standalone via /dependency-check.
---

# Dependency Check

Verify required system dependencies and credentials before scaffolding or at the start of each new phase.

## Trigger

- Called by `/implement` before scaffolding (first run) and at each phase boundary
- Can be invoked standalone: `/dependency-check`

## Instructions

### Step 1: Read Requirements

Read `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` and `.claude/settings.json` to determine required dependencies. Also check for a `dependencies` section in the roadmap for phase-specific requirements.

### Step 2: Check System Dependencies

Check for each required dependency and report status:

```bash
# Core (always required)
node --version        # Node.js
npm --version         # npm
git --version         # Git

# Framework-specific (from tech spec)
npx --version         # npx (for create-next-app, husky, etc.)
command -v uv          # uv (required for Python packages repo-wide)

# Optional / phase-specific (from roadmap)
gh --version          # GitHub CLI (for PR creation)
docker --version      # Docker (if containerised deployment)
aws --version         # AWS CLI (if AWS deployment)
terraform --version   # Terraform (if IaC required)
```

### Step 3: Report Status

Present findings to the user:

```
Dependency Check:

  Required:
    ✓ node v20.11.0
    ✓ npm v10.2.4
    ✓ git v2.43.0
    ✓ npx v10.2.4
    ✗ gh (GitHub CLI) — NOT FOUND

  Phase-specific:
    ○ docker — not required this phase
    ○ aws — not required this phase

  Missing: 1 dependency
```

### Step 4: Prompt for Resolution

For each missing dependency, ask via AskUserQuestion:

- **"Install it for me"** — Agent runs the install command (e.g., `brew install gh`)
- **"I'll install it myself"** — Agent pauses and waits for user to confirm when done
- **"Skip (not needed)"** — Agent continues without it (only for optional dependencies)

### Step 5: Check Credentials

Check for required credentials based on tech spec and deployment targets. Credentials should NEVER be stored in code or passed directly — only environment variable references.

```
Credentials Check:

  Required:
    ✓ GITHUB_TOKEN — set in environment
    ✗ AWS_ACCESS_KEY_ID — NOT SET
    ✗ AWS_SECRET_ACCESS_KEY — NOT SET

  Action needed: 2 credentials missing
```

For each missing credential, ask via AskUserQuestion:

- **"I'll set them now"** — Instruct user: `export AWS_ACCESS_KEY_ID=your-key` (do NOT ask for the value)
- **"I'll add to .env"** — Instruct user to add to `.env` file (ensure `.env` is in `.gitignore`)
- **"Skip (not needed yet)"** — Continue without (only for optional/future-phase credentials)

### Security Rules (ESSENTIAL)

- **NEVER** ask the user for credential values directly
- **NEVER** store secrets in code, config files, or progress.json
- **ALWAYS** reference credentials via environment variable names only
- **ALWAYS** ensure `.env` is in `.gitignore` before suggesting .env usage
- **ALWAYS** use `${VAR_NAME}` references in config, never literal values
- Agent sees variable names, not values: `process.env.DATABASE_URL`

### Step 6: Confirm Ready

When all required dependencies and credentials are available:

```
All dependencies satisfied. Ready to proceed.
```

If critical items are still missing, STOP and do not proceed to scaffolding.

## Evaluation Criteria

- All required dependencies checked (node, npm, git at minimum)
- Missing dependencies clearly reported with install options
- Credentials checked without ever asking for secret values
- Environment variable approach enforced (no hardcoded secrets)
- .env added to .gitignore check present
- Phase-specific dependencies identified from roadmap
- Agent does not proceed when critical dependencies are missing
- User has clear choice: agent installs, user installs, or skip
