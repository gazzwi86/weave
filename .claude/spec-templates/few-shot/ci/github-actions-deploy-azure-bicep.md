---
topic: ci
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — Deploy Azure Bicep with OIDC Workload Identity

Workload Identity Federation (OIDC): no client secrets stored in GitHub.
`bicep build` validates; `az deployment group what-if` shows the diff before apply.

```yaml
# .github/workflows/deploy-bicep.yml
name: Deploy Bicep

on:
  push:
    branches: [main]
    paths: ["infra/**"]
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment
        type: choice
        options: [dev, staging, prod]
        default: dev

permissions:
  id-token: write    # required for OIDC
  contents: read

jobs:
  deploy:
    name: Bicep Deploy (${{ github.event.inputs.environment || 'dev' }})
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'dev' }}   # reviewer gate for prod

    env:
      AZURE_SUBSCRIPTION_ID: ${{ vars.AZURE_SUBSCRIPTION_ID }}
      AZURE_RG:               ${{ vars.AZURE_RESOURCE_GROUP }}
      ENV_NAME:               ${{ github.event.inputs.environment || 'dev' }}

    steps:
      - uses: actions/checkout@v4

      # OIDC: exchange GitHub token for short-lived Azure credentials
      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id:       ${{ vars.AZURE_CLIENT_ID }}         # no secret — OIDC
          tenant-id:       ${{ vars.AZURE_TENANT_ID }}
          subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}

      # Validate Bicep compiles without errors
      - name: Bicep build (lint)
        run: az bicep build --file infra/main.bicep

      # What-if: show changes without applying (non-blocking, comment on PR if needed)
      - name: What-if
        run: |
          az deployment group what-if \
            --resource-group "$AZURE_RG" \
            --template-file   infra/main.bicep \
            --parameters      infra/params/$ENV_NAME.bicepparam \
            --mode            Incremental

      # Apply — prod requires reviewer via GitHub Environment protection
      - name: Deploy
        run: |
          az deployment group create \
            --resource-group "$AZURE_RG" \
            --template-file   infra/main.bicep \
            --parameters      infra/params/$ENV_NAME.bicepparam \
            --mode            Incremental \
            --name            "deploy-${{ github.run_id }}"
```

```json
// infra/params/dev.bicepparam (Bicep parameter file)
using '../main.bicep'
param env = 'dev'
param location = 'australiaeast'
```

```bash
# Azure setup: create federated credential on the app registration
az ad app federated-credential create \
  --id <app-object-id> \
  --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:myorg/myrepo:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

**Why:** Workload Identity Federation avoids rotating client secrets.
`--mode Incremental` is safer than Complete — it won't delete resources not in
the template. `.bicepparam` files separate environment config from template
logic, keeping `main.bicep` environment-agnostic.
