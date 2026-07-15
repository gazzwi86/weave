# Repository Anatomy

Navigable map of the codebase. Each area links to its wiki page; open that before grepping.

| Area | Purpose | Wiki |
|---|---|---|
| backend | FastAPI platform API + all four engines — auth, AI routing, RDF/SPARQL, generation, connectors | [backend](docs/wiki/backend.md) |
| frontend | Next.js App-Router SPA — auth, design system, Explorer canvas, engine surfaces | [frontend](docs/wiki/frontend.md) |
| shared | Cross-package TypeScript — onboarding content/anchors/checks consumed by the frontend | [shared](docs/wiki/shared.md) |
| infra-terraform | Terraform IaC — VPC, Aurora, Cognito, S3/CloudFront, ElastiCache, secrets; essential-only deploy gate | [infra-terraform](docs/wiki/infra-terraform.md) |
