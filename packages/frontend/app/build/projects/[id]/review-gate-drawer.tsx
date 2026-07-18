"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { DrawerPage } from "@/components/templates/DrawerPage";

interface AcceptanceCriterion {
  id: string;
  text?: string;
}

interface TaskDetail {
  brief: { acceptance_criteria?: AcceptanceCriterion[] } | null;
}

type HitlAction = "approve" | "reject" | "amend";

type SubmitState = { submitting: boolean; error: string | null };

const IDLE: SubmitState = { submitting: false, error: null };

/** No endpoint records per-run tests-passing/lint-error counts against a
 * task (gap sibling of G9/G10/G12 -- see the dashboard's gap notes). The
 * acceptance-criteria count is real (from the task brief); the other two
 * QA StatCards stay pending until that ceremony data is exposed.
 */
function QaStatRow({ acCount }: { acCount: number | null }): React.JSX.Element {
  return (
    <div className="mb-[var(--space-4)] grid grid-cols-3 gap-[var(--space-2)]">
      <StatCard value="—" label="tests passing" />
      <StatCard value="—" label="lint / type errors" />
      <StatCard value={acCount === null ? "—" : String(acCount)} label="acceptance criteria" />
    </div>
  );
}

function AcceptanceChecklist({ items }: { items: AcceptanceCriterion[] | null }): React.JSX.Element {
  if (!items || items.length === 0) {
    return (
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">
        No acceptance criteria on file for this task yet.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {items.map((ac) => (
        <li key={ac.id} className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {ac.text ?? ac.id}
        </li>
      ))}
    </ul>
  );
}

function useTaskBrief(
  projectId: string,
  taskId: string | null,
  open: boolean
): AcceptanceCriterion[] | null {
  const [criteria, setCriteria] = useState<AcceptanceCriterion[] | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    fetch(`/api/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`)
      .then((res) => (res.ok ? (res.json() as Promise<TaskDetail>) : null))
      .then((detail) => setCriteria(detail?.brief?.acceptance_criteria ?? []))
      .catch(() => setCriteria([]));
    // ponytail: no reset-to-null-on-reopen here -- the caller remounts this
    // drawer per task via `key={taskId}` (see ReviewGateDrawer usage in the
    // dashboard), so a fresh instance always starts from the initial state.
  }, [projectId, taskId, open]);

  return criteria;
}

/** Maps the drawer's three footer actions onto the backend's
 * approve/reject/amend vocabulary (`HitlActionRequest`). "Request changes"
 * becomes `amend` when the reviewer left a comment (the comment becomes the
 * required `amendment`) and `reject` otherwise -- an empty rejection needs
 * no amendment text.
 */
function resolveAction(button: "approve" | "request-changes", comment: string): { action: HitlAction; amendment?: string } {
  if (button === "approve") return { action: "approve" };
  const trimmed = comment.trim();
  return trimmed ? { action: "amend", amendment: trimmed } : { action: "reject" };
}

async function submitHitl(
  taskId: string,
  body: { action: HitlAction; amendment?: string }
): Promise<{ ok: true } | { ok: false; selfApproval: boolean }> {
  const res = await fetch(`/api/build/tasks/${encodeURIComponent(taskId)}/hitl`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  return { ok: false, selfApproval: payload?.error === "self_approval_not_permitted" };
}

export interface ReviewGateDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string | null;
}

function ReviewGateFooter({
  submitting,
  onRequestChanges,
  onLater,
  onApprove,
}: {
  submitting: boolean;
  onRequestChanges: () => void;
  onLater: () => void;
  onApprove: () => void;
}): React.JSX.Element {
  return (
    <>
      <Button variant="ghost" onClick={onRequestChanges} disabled={submitting}>
        Request changes
      </Button>
      <Button variant="secondary" onClick={onLater} disabled={submitting}>
        Later
      </Button>
      <Button onClick={onApprove} loading={submitting}>
        Approve — continue build
      </Button>
    </>
  );
}

function ReviewGateBody({
  criteria,
  error,
  comment,
  onCommentChange,
}: {
  criteria: AcceptanceCriterion[] | null;
  error: string | null;
  comment: string;
  onCommentChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <>
      <QaStatRow acCount={criteria?.length ?? null} />
      {error && (
        <p role="alert" className="mb-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <div className="mb-[var(--space-4)]">
        <label className="mb-[var(--space-2)] block text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          What QA verified
        </label>
        <AcceptanceChecklist items={criteria} />
      </div>
      <div>
        <label
          htmlFor="review-gate-comment"
          className="mb-[var(--space-2)] block text-[length:var(--text-label)] text-[var(--color-text-muted)]"
        >
          Comment (optional)
        </label>
        <textarea
          id="review-gate-comment"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Anything to change before this ships?"
          className="w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
        />
      </div>
    </>
  );
}

/** refit-mock.html `#review-drawer` -- opened by the dashboard's gate
 * ExplainBand. QA stats are a data gap (see `QaStatRow`); the action itself
 * is real: POST /api/build/tasks/{id}/hitl, with a self-approval 403
 * surfaced as an inline alert instead of a silent failure or a crash.
 * The caller remounts this per task (`key={taskId}`), so state resets on
 * open are handled by mount, not by an effect (see `useTaskBrief`).
 */
export function ReviewGateDrawer({ open, onClose, projectId, taskId }: ReviewGateDrawerProps): React.JSX.Element {
  const criteria = useTaskBrief(projectId, taskId, open);
  const [comment, setComment] = useState("");
  const [submit, setSubmit] = useState<SubmitState>(IDLE);

  const handle = useCallback(
    async (button: "approve" | "request-changes") => {
      if (!taskId) return;
      setSubmit({ submitting: true, error: null });
      const result = await submitHitl(taskId, resolveAction(button, comment));
      if (result.ok) {
        onClose();
        return;
      }
      setSubmit({
        submitting: false,
        error: result.selfApproval
          ? "You can't approve your own work — ask another reviewer to review this task."
          : "Couldn't submit the review. Try again.",
      });
    },
    [taskId, comment, onClose]
  );

  if (!taskId) return <></>;

  return (
    <DrawerPage
      open={open}
      onClose={onClose}
      icon="check"
      tone="var(--color-warn)"
      title={`Review gate — ${taskId}`}
      size="xl"
      footer={
        <ReviewGateFooter
          submitting={submit.submitting}
          onRequestChanges={() => void handle("request-changes")}
          onLater={onClose}
          onApprove={() => void handle("approve")}
        />
      }
    >
      <ReviewGateBody criteria={criteria} error={submit.error} comment={comment} onCommentChange={setComment} />
    </DrawerPage>
  );
}
