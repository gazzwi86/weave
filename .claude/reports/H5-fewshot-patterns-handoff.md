# H5 — Pattern-library refinement: resume handoff

**Status (2026-07-01):** DRAFT+VERIFY complete; council + finalization pending. Branch `fewshot-refine`
(off `harness-refine`), worktree `../weave-fewshot`. WIP commit `f3518a7`. No PR opened yet.

## Done
23/23 stack-specific golden patterns authored under `docs/standards/patterns/` and **mechanically
verified** (each stamps `verification:`):
- **Verified-now** (17): api/fastapi-router, api/cognito-jwt-auth, api/nextjs-route-handler,
  frontend/nextjs-shadcn-component, data/sqlalchemy-async, data/redis-elasticache, semantic-web/{shacl-shape,
  sparql-query-update, owl-turtle-ontology, prov-o-provenance}, infra/{terraform-aws-lambda-aurora,
  terraform-cloudfront-s3-spa, docker-compose-local-dev}, ci/{python-uv, ts-nextjs, terraform},
  linting/{ruff-strict, eslint-sonarjs-strict}, observability/{otel-adot-python, otel-adot-node}.
  Levels: Python=py_compile+ruff clean · TS=esbuild syntax · SHACL=pyshacl constraint-proof (conforming
  passes / bad fails) + rdflib parse · Terraform=`terraform validate` OK · CI/compose=yaml-parse.
- **UNVERIFIED (docs-only, fast-moving)** (3): ai-agents/anthropic-agent-sdk, ai-agents/bedrock-guardrails,
  data/s3-vectors — authored from primary docs (context7 + AWS), sources cited, per-file Confidence.

## Known gaps to feed the council
- Frontend TS verified at **syntax level only** (esbuild); no `tsc --strict` type-check (no project tsconfig). Frontend lens should eyeball types.
- The 3 AI/AWS files are UNVERIFIED — AI lens rates confidence, checks against primary docs, does NOT bless as runnable.
- ruff/eslint configs claim the Law E budgets — backend/frontend lenses confirm the numbers match `code-style.md`.

## REMAINING STEPS (in order)
1. **Council** — 4 lenses (Security per-tech · Backend Py/FastAPI/SQLAlchemy/Terraform · Frontend Next15/TS/shadcn ·
   Semantic-web+AI) review all 23 at `docs/standards/patterns/`. Each returns ranked findings + a security
   sub-assessment. Spawn as background agents (see prior council pattern in H3).
2. **Reconcile** council findings → apply fixes to the pattern files.
3. **Repoint references** from `.claude/spec-templates/few-shot/` → `docs/standards/patterns/` in:
   `.claude/skills/arch-openapi` (api/fastapi-router), `arch-data-model` (data/sqlalchemy-async + Data Law 5),
   `arch-infra` (infra/ + observability/), `arch-cicd` (ci/), `implement` (Step 2c router refs),
   `.claude/agents/engineer.md` (the `templates/few-shot/<topic>/<stack>.md` pointer), `.claude/skills/init`
   (the `.claude/weave-few-shot.txt` pointer it writes), and `.claude/spec-templates/architecture/infrastructure.md`
   (`{{iac_few_shot_file}}` / `{{observability_few_shot_file}}`). New topics added: `frontend/`, `semantic-web/`,
   `ai-agents/`; agnostic topics culled (django/express/nestjs/spring/cosmos/dynamo/cdk/bicep/pulumi/maven/etc.).
4. **Delete** `.claude/spec-templates/few-shot/` entirely.
5. **okf-validate** — run on `docs/standards/patterns/` (+ bundle); frontmatter already mirrors the
   6-key Coding-Standard block (`type: Coding Standard`, tags lead `standards`, timestamp, resource) + extras
   (topic/stack/verification[/sources]). Fix any hard errors.
6. **Commit + push `fewshot-refine`; open PR with base = `harness-refine`** (stacked; review in isolation).

## Notes
- Placement decision was docs/standards (visible, human-refined, OKF). Coverage = full stack incl. semantic-web + AI.
- `claude-sonnet-5` used in the AI pattern (consistent with the harness upgrade on harness-refine).
- Parallel agent is on `spec/weave-arch-m1`; `docs/standards/patterns/*` are new files → low conflict.
