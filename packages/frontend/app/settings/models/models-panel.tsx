"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExplainBand } from "@/components/ui/explain-band";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { useBillingUsage } from "@/app/billing/use-billing-usage";
import { cn } from "@/lib/utils";

import { ALLOWED_MODELS, type AllowedModel } from "./allowed-models";

const CARD_TITLE_CLASS =
  "flex items-center text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]";
const SELECT_CLASS =
  "rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] disabled:cursor-not-allowed disabled:opacity-60";

interface CapResult {
  tone: "success" | "danger" | "muted";
  text: string;
}

const TONE_CLASS: Record<CapResult["tone"], string> = {
  success: "text-[var(--color-success)]",
  danger: "text-[var(--color-danger)]",
  muted: "text-[var(--color-text-muted)]",
};

const ALERT_OPTIONS = [50, 80, 90] as const;

/** Submits the workspace's monthly cap and maps the response onto the three
 * user-facing outcomes (set, exceeds parent, admin-only) plus a muted
 * catch-all. Scope is implicit -- workspace ≡ tenant (no scope picker; the
 * mock has none either), so no `workspace_id` is sent.
 */
async function putCap(valueUsd: number): Promise<CapResult> {
  let response: Response;
  try {
    response = await fetch("/api/billing/caps", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value_usd: valueUsd }),
    });
  } catch {
    return { tone: "muted", text: "Unable to set the cap." };
  }

  const body = (await response.json().catch(() => null)) as {
    detail?: { error?: string; parent_cap_usd?: number };
  } | null;

  if (response.ok) {
    return { tone: "success", text: `Cap set: $${valueUsd.toFixed(2)} per month.` };
  }
  return mapCapError(response.status, body);
}

function mapCapError(
  status: number,
  body: { detail?: { error?: string; parent_cap_usd?: number } } | null
): CapResult {
  if (status === 422 && body?.detail?.error === "cap_exceeds_parent") {
    const parent = body.detail.parent_cap_usd ?? 0;
    return { tone: "danger", text: `Cap exceeds the parent scope's cap ($${parent.toFixed(2)}).` };
  }
  if (status === 403) {
    return { tone: "danger", text: "Budget caps can only be set by workspace admins." };
  }
  return { tone: "muted", text: "Unable to set the cap." };
}

function TierSelect({ id, label, hint, models }: { id: string; label: string; hint: string; models: readonly [AllowedModel] }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={id} className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        {label}
      </label>
      {/* G13: no allowed-models endpoint exists yet, so this is a fixed
       * single-option display of CLAUDE.md's confirmed stack, not a live
       * routing control -- disabled rather than a fake picker. */}
      <select id={id} aria-label={label} className={SELECT_CLASS} value={models[0].id} disabled onChange={() => undefined}>
        {models.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{hint}</p>
    </div>
  );
}

function ModelRoutingCard() {
  return (
    <Card>
      <p className={CARD_TITLE_CLASS}>
        Model routing — two tiers
        <InfoTip
          title="Model tiers"
          body="Two tiers balance quality and cost: a high tier for judgement work (planning, architecture, review) and a mid tier for volume work (writing code, tests and documents)."
        />
      </p>
      <CardContent className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
        <TierSelect id="model-high" label="High tier — judgement work" hint="Elicitation, architecture, plan review." models={ALLOWED_MODELS.high} />
        <TierSelect id="model-mid" label="Mid tier — volume work" hint="Generation, implementation, QA." models={ALLOWED_MODELS.mid} />
      </CardContent>
      <p className="mt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Fixed until the allowed-models endpoint ships (gap G13).
      </p>
      <ExplainBand
        tone="accent"
        icon="shield"
        className="mt-[var(--space-3)]"
        body="Choices come from the validated allow-list — an unknown model halts the run rather than silently swapping."
      />
    </Card>
  );
}

function spendTone(pct: number, alertPct: number): "success" | "danger" {
  return pct >= alertPct ? "danger" : "success";
}

interface CapFormState {
  amount: string;
  setAmount: (value: string) => void;
  alertPct: number;
  setAlertPct: (value: number) => void;
  submitting: boolean;
  result: CapResult | null;
  validationMsg: string | null;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

/** Owns the cap-amount/alert-threshold form state and submit flow --
 * split out of SpendCard to keep it within the complexity budget. */
function useCapForm(): CapFormState {
  const [amount, setAmount] = useState("");
  const [alertPct, setAlertPct] = useState(80);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CapResult | null>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

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
    setResult(await putCap(valueUsd));
    setSubmitting(false);
  }

  return { amount, setAmount, alertPct, setAlertPct, submitting, result, validationMsg, onSubmit };
}

function CapFeedback({ form }: { form: CapFormState }) {
  return (
    <>
      {form.validationMsg && (
        <p role="alert" data-testid="cap-validation-error" className="text-[var(--color-danger)]">
          {form.validationMsg}
        </p>
      )}
      {form.result && (
        <p
          role={form.result.tone === "danger" ? "alert" : "status"}
          data-testid="cap-result"
          className={TONE_CLASS[form.result.tone]}
        >
          {form.result.text}
        </p>
      )}
    </>
  );
}

function CapForm({ form }: { form: CapFormState }) {
  return (
    <>
      <form onSubmit={form.onSubmit} className="flex flex-col gap-[var(--space-3)]">
        <label htmlFor="cap-amount" className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          Workspace monthly cap (USD)
        </label>
        <Input
          id="cap-amount"
          aria-label="Workspace monthly cap (USD)"
          type="number"
          min="0.01"
          step="0.01"
          value={form.amount}
          onChange={(e) => form.setAmount(e.target.value)}
        />
        <label htmlFor="alert-at" className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          Alert at
        </label>
        <select
          id="alert-at"
          aria-label="Alert at"
          className={SELECT_CLASS}
          value={form.alertPct}
          onChange={(e) => form.setAlertPct(Number(e.target.value))}
        >
          {ALERT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}% of cap
            </option>
          ))}
        </select>
        <Button type="submit" disabled={form.submitting}>
          {form.submitting ? "Setting…" : "Set cap"}
        </Button>
      </form>
      <CapFeedback form={form} />
    </>
  );
}

function SpendBar({ usage, tone }: { usage: NonNullable<ReturnType<typeof useBillingUsage>["usage"]>; tone: "success" | "danger" }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">This month</p>
      <div className="h-[var(--space-2)] w-full overflow-hidden rounded-[var(--radius-full)] bg-[var(--color-overlay)]">
        <div
          data-testid="spend-bar-fill"
          data-tone={tone}
          style={{ width: `${Math.min(usage.cap_utilisation_pct, 100)}%` }}
          className={cn(
            "h-full rounded-[var(--radius-full)]",
            tone === "danger" ? "bg-[var(--color-danger)]" : "bg-[var(--color-accent-primary)]"
          )}
        />
      </div>
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        ${usage.total_cost_usd.toFixed(2)} · {usage.period}
      </p>
    </div>
  );
}

function SpendCard() {
  const { usage, loadError } = useBillingUsage();
  const form = useCapForm();
  const tone = spendTone(usage?.cap_utilisation_pct ?? 0, form.alertPct);

  return (
    <Card>
      <p className={CARD_TITLE_CLASS}>Spend</p>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <CapForm form={form} />
        {loadError && !usage && (
          <p data-testid="usage-error" className="text-[var(--color-text-muted)]">
            Unable to load usage from the backend.
          </p>
        )}
        {usage && <SpendBar usage={usage} tone={tone} />}
      </CardContent>
    </Card>
  );
}

/** Settings -> Models & AI (admin-gated by `app/settings/models/page.tsx`):
 * the fixed two-tier routing display (G13: no allow-list endpoint yet) and
 * the spend card driving `PUT /api/billing/caps` + `useBillingUsage()`'s
 * `cap_utilisation_pct`.
 */
export function ModelsPanel() {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <ModelRoutingCard />
      <SpendCard />
    </div>
  );
}
