"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface GovernanceValues {
  modelTier: string;
  costCap: string;
}

const MODEL_TIERS = ["standard", "fast", "premium", "experimental"] as const;

function ModelTierField({
  value,
  source,
  canManage,
  onChange,
}: {
  value: string;
  source: string;
  canManage: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Model tier
        </span>
        <select
          value={value}
          disabled={!canManage}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] disabled:opacity-50"
        >
          {MODEL_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </label>
      <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Resolved from: {source}
      </span>
    </div>
  );
}

function CostCapField({
  value,
  source,
  canManage,
  onChange,
}: {
  value: string;
  source: string | null;
  canManage: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Cost cap (USD)
        </span>
        <Input
          type="number"
          value={value}
          disabled={!canManage}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Resolved from: {source ?? "unset"}
      </span>
    </div>
  );
}

/** AC-2/AC-3/AC-4: the governance form itself -- split out of
 * `ProjectSettingsPanel` to stay under the Law E 50-line budget. Read-only
 * (`canManage=false`) disables both fields and hides Save entirely, per
 * AC-4 -- an editor can see the resolved cascade but never mutate it. */
export function GovernanceForm({
  values,
  source,
  canManage,
  saving,
  onChange,
  onSave,
}: {
  values: GovernanceValues;
  source: { modelTier: string; costCap: string | null };
  canManage: boolean;
  saving: boolean;
  onChange: (values: GovernanceValues) => void;
  onSave: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <ModelTierField
        value={values.modelTier}
        source={source.modelTier}
        canManage={canManage}
        onChange={(modelTier) => onChange({ ...values, modelTier })}
      />
      <CostCapField
        value={values.costCap}
        source={source.costCap}
        canManage={canManage}
        onChange={(costCap) => onChange({ ...values, costCap })}
      />
      {canManage && (
        <Button type="button" disabled={saving} onClick={onSave} className="w-fit">
          Save
        </Button>
      )}
    </div>
  );
}
