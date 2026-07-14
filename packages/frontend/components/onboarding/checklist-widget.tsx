"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/onboarding/i18n";

import {
  CHECKLIST_ITEMS,
} from "../../../shared/onboarding/content/checklist";
import {
  deriveChecklist,
  shouldAutoDismiss,
  type ChecklistSignals,
  type DerivedChecklistItem,
} from "../../../shared/onboarding/derive-checklist";

interface BootstrapState {
  checklist_dismissed_at: string | null;
  checklist_auto_dismiss_days: number;
  sandbox_workspace_id: string | null;
  sandbox_forked_at: string | null;
  tours: { tour_id: string; completed_at: string | null }[];
  exercise_completions: { exercise_id: string; completed_at: string }[];
  activations: { milestone_id: string; activated_at: string; source: string }[];
}

function toSignals(body: BootstrapState): ChecklistSignals {
  return {
    sandboxWorkspaceId: body.sandbox_workspace_id,
    sandboxForkedAt: body.sandbox_forked_at,
    tours: body.tours,
    exerciseCompletions: body.exercise_completions,
    activations: body.activations,
  };
}

/** TASK-010: fetches bootstrap state once and derives checklist completion
 * client-side (AC-010-02) -- no separate "is this done" round trip, matches
 * the codebase's existing bootstrap-once precedent (use-dismissals.ts). */
function useChecklistState(): {
  loading: boolean;
  state: BootstrapState | null;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<BootstrapState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/onboarding/state");
    const body = (await res.json()) as BootstrapState;
    setState(body);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding/state")
      .then((res) => res.json())
      .then((body: BootstrapState) => {
        if (!cancelled) setState(body);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, state, refresh };
}

function ItemAction({
  derived,
  onSelfMark,
}: {
  derived: DerivedChecklistItem;
  onSelfMark: (itemId: string) => void;
}): React.JSX.Element | null {
  const { item, checked, locked } = derived;
  if (locked) {
    return (
      <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        {t("onboarding.checklist.locked.coming-soon")}
      </span>
    );
  }
  if (item.autoCompleteOn === "manual" && !checked) {
    return (
      <Button variant="secondary" onClick={() => onSelfMark(item.itemId)} className="w-fit">
        {t("onboarding.checklist.mark-done")}
      </Button>
    );
  }
  return null;
}

function ItemRow({
  derived,
  onSelfMark,
}: {
  derived: DerivedChecklistItem;
  onSelfMark: (itemId: string) => void;
}): React.JSX.Element {
  const { item, checked, locked, badge } = derived;
  const label = t(item.labelKey);
  const labelClassName = checked
    ? "text-[var(--color-text-muted)] line-through"
    : "text-[var(--color-text-default)]";
  const isLinkable = !locked && item.autoCompleteOn !== "manual";

  return (
    <li className="flex items-start gap-[var(--space-3)] py-[var(--space-2)]">
      <input
        type="checkbox"
        checked={checked}
        readOnly
        aria-label={label}
        disabled={locked}
        className="mt-[var(--space-1)] h-[var(--space-4)] w-[var(--space-4)] accent-[var(--color-accent-primary)]"
      />
      <div className="flex flex-1 flex-col gap-[var(--space-1)]">
        <div className="flex items-center gap-[var(--space-2)]">
          {isLinkable ? (
            <a href={item.deepLink} className={labelClassName}>
              {label}
            </a>
          ) : (
            <span className={labelClassName}>{label}</span>
          )}
          {badge ? (
            <Badge variant="warn">{t("onboarding.checklist.badge.pending-platform-signal")}</Badge>
          ) : null}
        </div>
        <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {t(item.whyKey)}
        </span>
        <ItemAction derived={derived} onSelfMark={onSelfMark} />
      </div>
    </li>
  );
}

// Manual-only items self-mark against this allowlisted milestone id (mirrors
// the backend's MANUAL_ONLY_MILESTONE_IDS -- only invite-admin ships in M1).
const SELF_MARK_MILESTONE_ID: Record<string, string> = { "invite-admin": "invite_admin" };

// ponytail: falls back to "now" when no completion timestamp is derivable --
// the auto-dismiss window then starts counting from this render, not from
// the true completion moment.
function completionAnchor(state: BootstrapState): string {
  const completedAt = state.tours
    .map((tour) => tour.completed_at)
    .filter((v): v is string => v !== null)
    .sort()
    .at(-1);
  return completedAt ?? new Date().toISOString();
}

/** TASK-010: Platform Dashboard checklist widget. Derives completion from
 * bootstrap signals (AC-010-02), shows locked/manual items (AC-010-03),
 * celebrates + auto-dismisses at 100% (AC-010-04), and persists/restores
 * dismissal (AC-010-05). */
export function ChecklistWidget(): React.JSX.Element | null {
  const { loading, state, refresh } = useChecklistState();

  const handleSelfMark = useCallback(
    async (itemId: string) => {
      const milestoneId = SELF_MARK_MILESTONE_ID[itemId];
      if (!milestoneId) return;
      await fetch(`/api/onboarding/milestones/${milestoneId}/self-mark`, { method: "POST" });
      await refresh();
    },
    [refresh]
  );

  const handleDismiss = useCallback(async () => {
    await fetch("/api/onboarding/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checklist_dismissed_at: new Date().toISOString() }),
    });
    await refresh();
  }, [refresh]);

  // ponytail: skip derivation once dismissed -- a dismissed bootstrap
  // payload isn't guaranteed to carry the full signal shape.
  const derived =
    state && !state.checklist_dismissed_at ? deriveChecklist(CHECKLIST_ITEMS, toSignals(state)) : null;

  useEffect(() => {
    if (!state || !derived || state.checklist_dismissed_at || !derived.allComplete) return;
    const anchor = completionAnchor(state);
    if (shouldAutoDismiss(anchor, new Date(), state.checklist_auto_dismiss_days)) {
      void handleDismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per state change, handleDismiss is stable
  }, [state, derived]);

  if (loading || !state || !derived || state.checklist_dismissed_at) return null;

  return (
    <Card>
      <CardTitle>
        {derived.allComplete ? t("onboarding.checklist.title.celebrate") : t("onboarding.checklist.title")}
      </CardTitle>
      <CardContent>
        {derived.allComplete ? <p>{t("onboarding.checklist.celebrate.body")}</p> : null}
        <ul>
          {derived.items.map((d) => (
            <ItemRow key={d.item.itemId} derived={d} onSelfMark={handleSelfMark} />
          ))}
        </ul>
        <Button variant="ghost" onClick={handleDismiss} className="mt-[var(--space-2)]">
          {t("onboarding.checklist.dismiss")}
        </Button>
      </CardContent>
    </Card>
  );
}
