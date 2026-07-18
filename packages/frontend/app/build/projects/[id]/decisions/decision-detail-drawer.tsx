"use client";

import { Badge } from "@/components/ui/badge";
import { DrawerPage } from "@/components/templates/DrawerPage";

import { actorLabel, KIND_CHIP } from "./decision-log-format";
import type { DecisionEntry } from "./use-decision-log";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-[var(--space-4)]">
      <div className="mb-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{value}</div>
    </div>
  );
}

/** refit-mock.html #sub-bld-decisions: the mock's static question/why-
 * blocked/options-A-B-C content has no backing model -- PLAT-AUDIT-1 records
 * the escalation as a `decision`-kind row (event_type only), not the
 * escalation itself (gap G14). This note names that gap on the drawer
 * instead of inventing fields the backend doesn't return.
 */
function WorkflowGapNote(): React.JSX.Element {
  return (
    <p
      data-testid="decision-workflow-gap"
      className="mb-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]"
    >
      This row is a decision-kind audit event. The question, why-blocked reason, and options that
      led to it aren&apos;t captured by the audit log yet -- only the event itself is.
    </p>
  );
}

export interface DecisionDetailDrawerProps {
  entry: DecisionEntry | null;
  onClose: () => void;
}

/** refit-mock.html #sub-bld-decisions row-detail drawer -- every field shown
 * is a real `DecisionEntry` field from PLAT-AUDIT-1 (TASK-020), never mock
 * content invented for the shape (see `WorkflowGapNote`).
 */
export function DecisionDetailDrawer({ entry, onClose }: DecisionDetailDrawerProps): React.JSX.Element {
  const open = entry !== null;
  const chip = entry ? KIND_CHIP[entry.kind] : null;

  return (
    <DrawerPage open={open} onClose={onClose} icon="scroll" tone="var(--color-info)" title="Decision detail">
      {entry && (
        <>
          <Field label="When" value={entry.ts} />
          <Field label="Actor" value={`${actorLabel(entry.actor_principal_iri)} — ${entry.actor_principal_iri}`} />
          <div className="mb-[var(--space-4)]">
            <div className="mb-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
              Kind
            </div>
            {chip && <Badge variant={chip.variant}>{chip.label}</Badge>}
          </div>
          <Field label="Event" value={entry.event_type} />
          <Field label="Target" value={entry.target_iri} />
          {entry.kind === "decision" && <WorkflowGapNote />}
        </>
      )}
    </DrawerPage>
  );
}
