---
topic: ci
stack: ts
references:
  - docs/stack-equivalents.md
---

# GitHub Actions — Pact Contract Testing: Consumer Publish + Provider Verify + can-i-deploy

Consumer publishes pacts on main merge. Provider verifies on every PR.
`can-i-deploy` gates deployment — only deploys if all providers have verified.

```yaml
# .github/workflows/pact-consumer.yml  — runs on consumer repo/service
name: Consumer — Pact publish

on:
  push:
    branches: [main]

jobs:
  publish-pacts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci

      # Generate pacts by running consumer tests
      - name: Run consumer tests (generate pacts)
        run: npm test -- --reporter=verbose
        env: { CI: true }

      # Publish to Pact Broker
      - name: Publish pacts
        run: |
          npx pact-broker publish ./pacts \
            --broker-base-url "$PACT_BROKER_URL" \
            --broker-token    "$PACT_BROKER_TOKEN" \
            --consumer-app-version "${{ github.sha }}" \
            --branch          main \
            --tag             main
        env:
          PACT_BROKER_URL:   ${{ vars.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

```yaml
# .github/workflows/pact-provider.yml  — runs on provider repo/service
name: Provider — Pact verify

on:
  pull_request:
  workflow_dispatch:

jobs:
  verify-pacts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci

      # Spin up the provider service
      - name: Start provider
        run: npm run start:test &
        env: { PORT: "3001", NODE_ENV: test }

      - name: Wait for provider to be ready
        run: npx wait-on http://localhost:3001/health --timeout 30000

      # Verify all consumer pacts against this provider version
      - name: Verify pacts
        run: npm run test:pact:provider
        env:
          PACT_BROKER_URL:            ${{ vars.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN:          ${{ secrets.PACT_BROKER_TOKEN }}
          PACT_PROVIDER_VERSION:      ${{ github.sha }}
          PACT_PROVIDER_BRANCH:       ${{ github.head_ref }}
          PACT_PUBLISH_VERIFICATION:  "true"

  # can-i-deploy gate — only proceed if all verifications pass
  can-i-deploy:
    needs: verify-pacts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci

      - name: can-i-deploy
        run: |
          npx pact-broker can-i-deploy \
            --broker-base-url "$PACT_BROKER_URL" \
            --broker-token    "$PACT_BROKER_TOKEN" \
            --pacticipant     order-service \
            --version         "${{ github.sha }}" \
            --to-environment  production
        env:
          PACT_BROKER_URL:   ${{ vars.PACT_BROKER_URL }}
          PACT_BROKER_TOKEN: ${{ secrets.PACT_BROKER_TOKEN }}
```

```ts
// Consumer pact test (Vitest + @pact-foundation/pact)
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import { describe, it, expect } from "vitest";

const provider = new PactV3({ consumer: "order-service", provider: "product-service" });

describe("product-service contract", () => {
  it("returns product by id", () =>
    provider
      .uponReceiving("a request for product SKU-001")
      .withRequest({ method: "GET", path: "/products/SKU-001" })
      .willRespondWith({ status: 200, body: { id: MatchersV3.string("SKU-001"), price: MatchersV3.number(9.99) } })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/products/SKU-001`);
        expect(res.status).toBe(200);
      }));
});
```

**Why:** `can-i-deploy` checks the Pact Broker's compatibility matrix — it blocks
deployment when the provider hasn't verified the current consumer version,
even if the local tests pass. Publishing with `--branch` enables branch-scoped
verification.
