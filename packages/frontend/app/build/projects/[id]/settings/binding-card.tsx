"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { Binding } from "./binding-slots";

/** AC-7: same three systems as the stub -- managed connectors themselves
 * ship later, but the reference-binding surface (this component) is real
 * now (TASK-022, FR-010). */
export const SYSTEMS = [
  { key: "confluence", label: "Confluence" },
  { key: "jira", label: "Jira" },
  { key: "servicenow", label: "ServiceNow" },
] as const;

const HEALTH_VARIANT: Record<string, "success" | "warn" | "danger" | "info"> = {
  ok: "success",
  degraded: "warn",
  error: "danger",
  unavailable: "info",
};

/** AC-3: colour never carries meaning alone -- label always accompanies the
 * token colour (WCAG 1.4.1). `unavailable` -> info is a brief-gap inference
 * (TASK-022 GAPS section notes this isn't pinned by the design system). */
function HealthBadge({ status }: { status: string }): React.JSX.Element {
  const label = status === "ok" ? "OK" : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={HEALTH_VARIANT[status] ?? "neutral"}>{label}</Badge>;
}

function BindingCard({
  label,
  binding,
  canManage,
  onBind,
  onRemove,
}: {
  label: string;
  binding: Binding | undefined;
  canManage: boolean;
  onBind: () => void;
  onRemove: (binding: Binding) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-raised)] px-[var(--space-4)] py-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-body)] text-[var(--color-text-default)]">
          {label}
        </span>
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {binding ? binding.space_ref : "Not configured"}
        </span>
      </div>
      <div className="flex items-center gap-[var(--space-2)]">
        {binding && <HealthBadge status={binding.health.status} />}
        {canManage && !binding && (
          <Button type="button" variant="secondary" onClick={onBind}>
            Bind
          </Button>
        )}
        {canManage && binding && (
          <Button type="button" variant="secondary" onClick={() => onRemove(binding)}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export function BindingCardList({
  bindings,
  canManage,
  onBind,
  onRemove,
}: {
  bindings: Binding[] | null;
  canManage: boolean;
  onBind: (system: string) => void;
  onRemove: (binding: Binding) => void;
}): React.JSX.Element {
  return (
    <>
      {SYSTEMS.map((system) => (
        <BindingCard
          key={system.key}
          label={system.label}
          binding={bindings?.find((b) => b.system === system.key)}
          canManage={canManage}
          onBind={() => onBind(system.key)}
          onRemove={onRemove}
        />
      ))}
    </>
  );
}
