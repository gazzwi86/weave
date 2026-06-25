---
topic: ci
stack: ts
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — Deploy AWS CDK with OIDC (no long-lived keys)

OIDC federation: GitHub Actions assumes an IAM role — no AWS_ACCESS_KEY_ID stored
as a secret. cdk-nag runs at synth time; manual approval gates prod deploys.

```yaml
# .github/workflows/deploy-cdk.yml
name: Deploy CDK

on:
  push:
    branches: [main]
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
    name: CDK Deploy (${{ github.event.inputs.environment || 'dev' }})
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment || 'dev' }}   # env protection rules gate prod

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Install dependencies
        run: npm ci

      # OIDC: exchange GitHub token for short-lived AWS credentials
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}   # arn:aws:iam::123456789:role/GitHubActionsDeployRole
          aws-region:     ${{ vars.AWS_REGION || 'ap-southeast-2' }}
          role-session-name: github-${{ github.run_id }}

      # Synth runs cdk-nag (baked into bin/app.ts)
      - name: CDK synth + nag
        run: npx cdk synth
        env:
          CDK_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_REGION:  ${{ vars.AWS_REGION || 'ap-southeast-2' }}
          NODE_ENV:    ${{ github.event.inputs.environment || 'dev' }}

      # Diff for visibility (non-blocking)
      - name: CDK diff
        run: npx cdk diff --app cdk.out
        continue-on-error: true

      # Deploy — for prod the GitHub environment requires a reviewer approval
      - name: CDK deploy
        run: npx cdk deploy --app cdk.out --require-approval never --all
        env:
          CDK_ACCOUNT: ${{ vars.AWS_ACCOUNT_ID }}
          CDK_REGION:  ${{ vars.AWS_REGION || 'ap-southeast-2' }}
```

```hcl
# Terraform snippet: OIDC trust policy for the IAM role
# (or create via CDK/CFN — shown for completeness)
data "aws_iam_policy_document" "github_oidc_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals { type = "Federated"; identifiers = [aws_iam_openid_connect_provider.github.arn] }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:myorg/myrepo:*"]
    }
  }
}
```

**Why:** OIDC eliminates static credentials — the AWS session is scoped to
`github.run_id` and expires in 1 hour. GitHub Environments (`environment: prod`)
require a configured reviewer before the deploy step runs, providing the manual
approval gate without a separate workflow.
