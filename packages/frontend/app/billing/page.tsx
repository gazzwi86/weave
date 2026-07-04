"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useBillingUsage, type UsageSummary } from "./use-billing-usage";

function CapUtilisationBadge({ pct }: { pct: number }) {
  if (pct >= 100) {
    return <Badge variant="danger">at cap</Badge>;
  }
  if (pct >= 80) {
    return <Badge variant="warn">near cap</Badge>;
  }
  return <Badge variant="success">under cap</Badge>;
}

function UsageCard({ usage }: { usage: UsageSummary }) {
  return (
    <Card>
      {/* Plain text, not CardTitle -- CardTitle renders an h3 and this page's
       * only heading is its own h1, so an h3 directly under it would skip h2
       * (axe heading-order), same trap dashboard/page.tsx documents. */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {usage.period}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p data-testid="total-cost">Total cost: ${usage.total_cost_usd.toFixed(2)}</p>
        <p data-testid="total-tokens">Total tokens: {usage.total_tokens}</p>
        <p data-testid="total-runs">Total runs: {usage.total_runs}</p>
        <p>
          Cap utilisation: {usage.cap_utilisation_pct.toFixed(0)}%{" "}
          <CapUtilisationBadge pct={usage.cap_utilisation_pct} />
        </p>
      </CardContent>
    </Card>
  );
}

/** PLAT-TASK-008: minimal usage dashboard. Shows the tenant's current-period
 * usage (AC-5) and a harness-only "Simulate AI call" control that drives
 * the real pre-call budget gate, so a reached cap is visible as an error
 * banner in the browser (AC-2), not only as a 429 in an API test.
 */
export default function BillingPage() {
  const { usage, loadError, capError, simulating, simulateAiCall } = useBillingUsage();
  const [workspaceId, setWorkspaceId] = useState("");

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Billing usage
      </h1>

      {capError && (
        <div
          role="alert"
          className="rounded-[var(--radius-lg)] bg-[var(--color-danger-soft)] p-[var(--space-4)] text-[var(--color-danger)]"
        >
          Budget cap reached: ${capError.consumed_usd.toFixed(2)} of $
          {capError.effective_cap_usd.toFixed(2)} used this period.
        </div>
      )}

      {loadError && !usage && (
        <p data-testid="usage-error" className="text-[var(--color-text-muted)]">
          Unable to load usage from the backend.
        </p>
      )}

      {usage && <UsageCard usage={usage} />}

      <Card>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Simulate AI call (harness)
        </p>
        <CardContent className="flex flex-col gap-[var(--space-3)]">
          <Input
            aria-label="Workspace ID"
            placeholder="workspace id"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          />
          <Button
            disabled={!workspaceId || simulating}
            onClick={() => simulateAiCall(workspaceId)}
          >
            {simulating ? "Simulating…" : "Simulate AI call"}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
