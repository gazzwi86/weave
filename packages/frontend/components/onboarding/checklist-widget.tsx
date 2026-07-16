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
  role_path: "business" | "technical" | "compliance" | "admin";
  checklist_dismissed_at: string | null;
  checklist_completed_at: string | null;
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

/** Exercise ids still worth (re)checking: those backing an incomplete
 * checklist item for this role. The backend ASK is idempotent, so this is a
 * safe "did they do it yet?" poll -- returns [] outside a sandbox (no graph
 * to check) so it never fires for non-demo users. Exported for its unit test. */
export function pendingExerciseChecks(state: BootstrapState): string[] {
  if (!state.sandbox_forked_at) return [];
  const done = new Set(state.exercise_completions.map((c) => c.exercise_id));
  const ids = CHECKLIST_ITEMS.filter(
    (item) =>
      item.autoCompleteOn === "exercise_complete" &&
      item.paths.includes(state.role_path) &&
      !(item.signalRefs ?? []).some((ref) => done.has(ref))
  ).flatMap((item) => item.signalRefs ?? []);
  return [...new Set(ids)];
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

  // XT-ONB010-1: records the true completion moment once, server-side, so
  // the auto-dismiss window anchors on it (not on tour completion, which
  // can predate finishing the whole checklist).
  const handleMarkCompleted = useCallback(async () => {
    await fetch("/api/onboarding/state", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checklist_completed_at: new Date().toISOString() }),
    });
    await refresh();
  }, [refresh]);

  // ONB-TASK-009 wiring: when in the demo sandbox, opportunistically re-check
  // the hands-on exercises (inspect-a-node / run-a-query / edit-an-instance).
  // The user does the exercise on its screen, then returns here -- this mount
  // pass verifies it via the backend ASK and records completion. Fires only
  // in a sandbox with pending exercises, so it never runs for non-demo users.
  useEffect(() => {
    if (!state) return;
    const pending = pendingExerciseChecks(state);
    if (pending.length === 0) return;
    let cancelled = false;
    Promise.all(
      pending.map((id) =>
        fetch(`/api/onboarding/exercises/${id}/check`, { method: "POST" })
          .then((r) => (r.ok ? (r.json() as Promise<{ verified?: boolean }>) : null))
          .catch(() => null)
      )
    ).then((results) => {
      // Refresh only on a NEW verification -- otherwise a not-yet-done
      // exercise (verified:false) would refresh -> re-run -> loop forever.
      if (!cancelled && results.some((r) => r?.verified)) void refresh();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one pass per state settle; refresh is stable
  }, [state]);

  // ponytail: skip derivation once dismissed -- a dismissed bootstrap
  // payload isn't guaranteed to carry the full signal shape.
  // AC-010-01: only the items configured for this user's role_path.
  const derived =
    state && !state.checklist_dismissed_at
      ? deriveChecklist(
          CHECKLIST_ITEMS.filter((item) => item.paths.includes(state.role_path)),
          toSignals(state)
        )
      : null;

  useEffect(() => {
    if (!state || !derived || state.checklist_dismissed_at || !derived.allComplete) return;
    if (!state.checklist_completed_at) {
      void handleMarkCompleted();
      return;
    }
    if (shouldAutoDismiss(state.checklist_completed_at, new Date(), state.checklist_auto_dismiss_days)) {
      void handleDismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per state change, handlers are stable
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
