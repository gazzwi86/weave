"use client";

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Triple {
  subject: string;
  predicate: string;
  object: string;
}

interface Modification {
  subject: string;
  predicate: string;
  before: string;
  after: string;
}

interface PinDiffResponse {
  from_version_iri: string;
  to_version_iri: string;
  added: Triple[];
  removed: Triple[];
  modified: Modification[];
  versions: { version_iri: string; breaking: boolean }[];
}

type DiffState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; diff: PinDiffResponse };

async function fetchDiff(projectId: string): Promise<DiffState> {
  try {
    const res = await fetch(`/api/build/projects/${projectId}/pin-diff`);
    if (!res.ok) return { phase: "error" };
    return { phase: "ready", diff: (await res.json()) as PinDiffResponse };
  } catch {
    return { phase: "error" };
  }
}

/** AC-1/AC-2/AC-3: diff rows -- semantic colour + text label pairing, never
 * colour alone (WCAG 1.4.1). */
function DiffRows({ diff }: { diff: PinDiffResponse }): React.JSX.Element {
  return (
    <ul className="flex max-h-64 flex-col gap-[var(--space-2)] overflow-y-auto">
      {diff.added.map((t, i) => (
        <li key={`added-${i}`} className="flex items-center gap-[var(--space-2)]">
          <Badge variant="success">Added</Badge>
          <span className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">
            {t.subject} {t.predicate} {t.object}
          </span>
        </li>
      ))}
      {diff.removed.map((t, i) => (
        <li key={`removed-${i}`} className="flex items-center gap-[var(--space-2)]">
          <Badge variant="danger">Removed</Badge>
          <span className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">
            {t.subject} {t.predicate} {t.object}
          </span>
        </li>
      ))}
      {diff.modified.map((m, i) => (
        <li key={`modified-${i}`} className="flex items-center gap-[var(--space-2)]">
          <Badge variant="warn">Changed</Badge>
          <span className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">
            {m.subject} {m.predicate}: {m.before} -&gt; {m.after}
          </span>
        </li>
      ))}
    </ul>
  );
}

function isEmptyDiff(diff: PinDiffResponse): boolean {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0;
}

/** AC-5: breaking span needs a second, explicit acknowledgement -- confirm
 * stays disabled (not just visually inert) until checked. */
function BreakingAck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-[var(--space-2)] rounded-[var(--radius-sm)] bg-[var(--color-warn)]/10 p-[var(--space-3)]">
      <Badge variant="warn">Breaking</Badge>
      <label className="flex items-center gap-[var(--space-2)] text-[length:var(--text-body-sm)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-label="I acknowledge this is a breaking change"
        />
        This upgrade includes breaking changes -- I understand
      </label>
    </div>
  );
}

function DiffBody({
  state,
  ack,
  setAck,
}: {
  state: DiffState;
  ack: boolean;
  setAck: (v: boolean) => void;
}): React.JSX.Element {
  if (state.phase === "loading") {
    return <p className="text-[var(--color-text-muted)]">Loading diff...</p>;
  }
  if (state.phase === "error") {
    return (
      <p role="alert" className="text-[var(--color-danger)]">
        The ontology diff is temporarily unavailable -- try again shortly.
      </p>
    );
  }
  const { diff } = state;
  if (isEmptyDiff(diff)) {
    return <p className="text-[var(--color-text-muted)]">This project is already up to date.</p>;
  }
  const breaking = diff.versions.some((v) => v.breaking);
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <DiffRows diff={diff} />
      {breaking && <BreakingAck checked={ack} onChange={setAck} />}
    </div>
  );
}

interface ConfirmState {
  confirming: boolean;
  conflict: boolean;
  success: string | null;
}

const IDLE_CONFIRM: ConfirmState = { confirming: false, conflict: false, success: null };

/** POSTs the confirm; on 409 (AC-3) re-fetches the diff instead of
 * blindly applying a stale confirm. */
async function confirmUpgrade(
  projectId: string,
  confirmVersionIri: string
): Promise<{ ok: true; pinned: string } | { ok: false; conflict: boolean }> {
  const res = await fetch(`/api/build/projects/${projectId}/pin-upgrade`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm_version_iri: confirmVersionIri }),
  });
  if (res.status === 409) return { ok: false, conflict: true };
  if (!res.ok) return { ok: false, conflict: false };
  const body = (await res.json()) as { pinned_graph_version_iri: string };
  return { ok: true, pinned: body.pinned_graph_version_iri };
}

function isBreaking(state: DiffState): boolean {
  return state.phase === "ready" && state.diff.versions.some((v) => v.breaking);
}

function isConfirmDisabled(state: DiffState, confirm: ConfirmState, ack: boolean): boolean {
  if (state.phase !== "ready" || confirm.confirming) return true;
  if (isEmptyDiff(state.diff)) return true;
  return isBreaking(state) && !ack;
}

/** Owns the dialog's data + confirm flow, split out of `PinUpgradeSection`
 * to keep both under the function-length/complexity budget (Law E). */
function usePinUpgradeDialog(projectId: string): {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  state: DiffState;
  ack: boolean;
  setAck: (v: boolean) => void;
  confirm: ConfirmState;
  open: () => Promise<void>;
  submit: () => Promise<void>;
} {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<DiffState>({ phase: "loading" });
  const [ack, setAck] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(IDLE_CONFIRM);

  const open = useCallback(async () => {
    setState({ phase: "loading" });
    setAck(false);
    setConfirm(IDLE_CONFIRM);
    dialogRef.current?.showModal();
    setState(await fetchDiff(projectId));
  }, [projectId]);

  const submit = useCallback(async () => {
    if (state.phase !== "ready") return;
    setConfirm({ ...IDLE_CONFIRM, confirming: true });
    const result = await confirmUpgrade(projectId, state.diff.to_version_iri);
    if (result.ok) {
      setConfirm({ ...IDLE_CONFIRM, success: result.pinned });
      return;
    }
    if (result.conflict) {
      setAck(false);
      setConfirm({ ...IDLE_CONFIRM, conflict: true });
      setState(await fetchDiff(projectId));
      return;
    }
    setConfirm(IDLE_CONFIRM);
    setState({ phase: "error" });
  }, [projectId, state]);

  return { dialogRef, state, ack, setAck, confirm, open, submit };
}

function DialogFooter({
  confirm,
  disabled,
  onCancel,
  onConfirm,
}: {
  confirm: ConfirmState;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  return (
    <div className="mt-[var(--space-6)] flex justify-end gap-[var(--space-2)]">
      <Button variant="secondary" onClick={onCancel}>
        {confirm.success ? "Close" : "Cancel"}
      </Button>
      {!confirm.success && (
        <Button onClick={onConfirm} disabled={disabled} aria-busy={confirm.confirming}>
          Confirm upgrade
        </Button>
      )}
    </div>
  );
}

function UpgradeStatusMessages({ confirm }: { confirm: ConfirmState }): React.JSX.Element | null {
  if (confirm.conflict) {
    return (
      <p role="alert" className="mt-[var(--space-3)] text-[var(--color-danger)]">
        The ontology changed again while you were reviewing -- showing the latest diff.
      </p>
    );
  }
  if (confirm.success) {
    return (
      <p role="status" className="mt-[var(--space-3)] text-[var(--color-success)]">
        Upgraded to {confirm.success}.
      </p>
    );
  }
  return null;
}

/** TASK-016 (FR-012): "Review upgrade" trigger + explicit-confirm dialog for
 * pinning a project to the latest published ontology version. Hidden for
 * non-admins (AC-6) -- the server's 403 on `pin-upgrade` is the real
 * boundary, this only shapes the control's visibility. */
export function PinUpgradeSection({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}): React.JSX.Element | null {
  const { dialogRef, state, ack, setAck, confirm, open, submit } = usePinUpgradeDialog(projectId);

  if (!canManage) return null;

  return (
    <>
      <Button onClick={open} className="w-fit">
        Review upgrade
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="pin-upgrade-title"
        aria-busy={state.phase === "loading"}
        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-6)] backdrop:bg-[var(--color-overlay)]"
      >
        <h2 id="pin-upgrade-title" className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)]">
          Review ontology upgrade
        </h2>
        <div className="mt-[var(--space-4)]">
          <DiffBody state={state} ack={ack} setAck={setAck} />
          <UpgradeStatusMessages confirm={confirm} />
        </div>
        <DialogFooter
          confirm={confirm}
          disabled={isConfirmDisabled(state, confirm, ack)}
          onCancel={() => dialogRef.current?.close()}
          onConfirm={submit}
        />
      </dialog>
    </>
  );
}
