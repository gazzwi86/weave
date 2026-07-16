"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const ROUTING_ROWS = [
  {
    tier: "fable",
    model: "claude-fable-5",
    work: "judgement-heavy work (elicitation, product ownership, architecture)",
  },
  {
    tier: "sonnet",
    model: "claude-sonnet-5",
    work: "volume work (generation, implementation, QA, validation)",
  },
] as const;

const CARD_TITLE_CLASS =
  "text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]";

interface CapResult {
  tone: "success" | "danger" | "muted";
  text: string;
}

const TONE_CLASS: Record<CapResult["tone"], string> = {
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
  muted: "text-[var(--color-text-muted)]",
};

/** Submits the cap to the proxy and maps the response onto the three
 * user-facing outcomes (set, exceeds parent, admin-only) plus a muted
 * catch-all for anything else. Scope IRI is built server-side.
 */
async function putCap(valueUsd: number, workspaceId: string): Promise<CapResult> {
  let response: Response;
  try {
    response = await fetch("/api/billing/caps", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value_usd: valueUsd,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      }),
    });
  } catch {
    return { tone: "muted", text: "Unable to set the cap." };
  }

  const body = (await response.json().catch(() => null)) as {
    detail?: { error?: string; parent_cap_usd?: number };
  } | null;

  if (response.ok) {
    const scope = workspaceId ? `workspace ${workspaceId}` : "the company-wide scope";
    return { tone: "success", text: `Cap set: $${valueUsd.toFixed(2)} on ${scope}` };
  }
  return mapCapError(response.status, body);
}

/** Maps a non-OK caps response onto a user-facing outcome. Split out of putCap
 * to keep that function within the complexity budget. */
function mapCapError(
  status: number,
  body: { detail?: { error?: string; parent_cap_usd?: number } } | null,
): CapResult {
  if (status === 422 && body?.detail?.error === "cap_exceeds_parent") {
    const parent = body.detail.parent_cap_usd ?? 0;
    return {
      tone: "danger",
      text: `Cap exceeds the parent scope's cap ($${parent.toFixed(2)}).`,
    };
  }
  if (status === 403) {
    return { tone: "danger", text: "Budget caps can only be set by workspace admins." };
  }
  return { tone: "muted", text: "Unable to set the cap." };
}

function ModelRoutingCard() {
  return (
    <Card>
      <p className={CARD_TITLE_CLASS}>Model routing</p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        {ROUTING_ROWS.map((row) => (
          <p key={row.tier} data-testid={`routing-${row.tier}`}>
            {row.tier} &rarr; {row.model} &mdash; {row.work}
          </p>
        ))}
        <p className="text-[var(--color-text-muted)]">
          Routing is fixed two-tier for M1; per-workspace overrides land later.
        </p>
      </CardContent>
    </Card>
  );
}

interface WorkspaceOption {
  id: string;
  display_name: string;
}

/** Scope choices for the cap: company-wide, or any workspace the tenant
 * has (fetched from the provisioning API). A load failure degrades to the
 * company-wide option only. */
function useWorkspaceOptions(): WorkspaceOption[] {
  const [options, setOptions] = useState<WorkspaceOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/tenancy/workspaces")
      .then((response) => (response.ok ? response.json() : []))
      .then((list: WorkspaceOption[]) => {
        if (!cancelled && Array.isArray(list)) setOptions(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return options;
}

const SELECT_CLASS =
  "rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]";

function BudgetCapCard() {
  const [amount, setAmount] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CapResult | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const workspaces = useWorkspaceOptions();

  const valueUsd = Number(amount);
  const valid = amount !== "" && Number.isFinite(valueUsd) && valueUsd > 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!valid) {
      setValidationMsg("Enter an amount greater than $0.00.");
      return;
    }
    if (submitting) return;
    setValidationMsg(null);
    setSubmitting(true);
    setResult(await putCap(valueUsd, workspaceId.trim()));
    setSubmitting(false);
  }

  return (
    <Card>
      <p className={CARD_TITLE_CLASS}>Budget cap</p>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-[var(--space-3)]">
          <Input
            aria-label="Cap amount (USD)"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="amount in USD"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            aria-label="Cap scope"
            className={SELECT_CLASS}
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            {/* TASK-030 AC-7/R7: company-scope wording only (R7 copy sweep). */}
            <option value="">Company-wide</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                Workspace: {workspace.display_name}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Setting…" : "Set cap"}
          </Button>
        </form>
        {validationMsg && (
          <p role="alert" data-testid="cap-validation-error" className="text-[var(--color-danger)]">
            {validationMsg}
          </p>
        )}
        {result && (
          <p
            role={result.tone === "danger" ? "alert" : "status"}
            data-testid="cap-result"
            className={TONE_CLASS[result.tone]}
          >
            {result.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Settings -> Models & AI: the fixed two-tier model routing (informational
 * for M1) and the budget-cap form driving `PUT /api/billing/caps`.
 */
export default function SettingsModelsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      {/* Plain text card titles, not CardTitle -- same heading-order trap
       * app/billing/page.tsx documents (h3 directly under the page h1). */}
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Models &amp; AI
      </h1>
      <ModelRoutingCard />
      <BudgetCapCard />
    </main>
  );
}
