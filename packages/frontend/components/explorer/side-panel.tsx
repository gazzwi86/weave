import * as Dialog from "@radix-ui/react-dialog";

import { ceEditingSurface } from "@/lib/explorer/ce-editing-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";

import { CommentsPanel } from "./comments-panel";
import type { UsePanelEditResult } from "./use-panel-edit";
import type { SidePanelState } from "./use-node-spotlight";

export interface SidePanelProps {
  state: SidePanelState;
  onClose: () => void;
  onRetry: () => void;
  /** TASK-027 AC-5: soft dependency on TASK-023/024's edge-draw controller
   * -- feature-detected. undefined (the M1 default, since those tasks are
   * absent) falls back to a CE-surface link instead. */
  onEditGap?: (nodeId: string, predicateIri: string) => void;
  /** TASK-024 AC-1..AC-8: property edit + delete -- feature-detected same
   * as onEditGap. undefined hides all edit/delete affordances (read-only
   * panel). */
  panelEdit?: UsePanelEditResult;
  /** AC-8: UX-only gate -- hides Edit/Delete buttons for viewers and while
   * pinned to a read-only version. CE-WRITE-1 rejects server-side anyway. */
  canEdit?: boolean;
}

const PANEL_CLASSES =
  "absolute right-[var(--space-4)] top-[var(--space-4)] z-[var(--z-panel)] w-80 max-w-[calc(100%-var(--space-8))] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-panel)]";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
    >
      Close
    </button>
  );
}

function Heading({ label, typeLabel, onClose }: { label: string; typeLabel: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-[var(--space-2)]">
      <div>
        <p className="break-words text-[length:var(--text-h4)] text-[var(--color-text-default)]">{label}</p>
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{typeLabel}</p>
      </div>
      <CloseButton onClose={onClose} />
    </div>
  );
}

// AC-2: the raw IRI is only ever rendered inside this disclosure, and only
// when the proxy route decided to send one (rawIri !== null -> ontologist).
function AdvancedDisclosure({ rawIri }: { rawIri: string | null }) {
  if (rawIri === null) return null;
  return (
    <details className="mt-[var(--space-3)]">
      <summary className="cursor-pointer text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Advanced / technical details
      </summary>
      <p className="mt-[var(--space-1)] break-all font-[var(--font-mono)] text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)]">
        {rawIri}
      </p>
    </details>
  );
}

interface MissingLinksProps {
  nodeId: string;
  gaps: NonNullable<Extract<SidePanelState, { status: "loaded" }>["gaps"]>;
  onEditGap?: (nodeId: string, predicateIri: string) => void;
}

// TASK-027 AC-4/AC-5: the accessible surface for a gap-flagged node's
// missing links -- humanised labels only (never a raw predicate IRI), each
// with an inline edge-draw shortcut when TASK-023/024's edit controller is
// available, else a link into the existing CE editing surface.
function MissingLinks({ nodeId, gaps, onEditGap }: MissingLinksProps) {
  if (gaps.length === 0) return null;
  return (
    <div className="mt-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-2)]">
      <h2 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Missing links</h2>
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {gaps.map((gap) =>
          onEditGap ? (
            <li key={gap.missingLink}>
              <button
                type="button"
                onClick={() => onEditGap(nodeId, gap.missingLink)}
                className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:text-[var(--color-accent-primary)]"
              >
                Add {gap.label}…
              </button>
            </li>
          ) : (
            <li key={gap.missingLink}>
              <a
                href={ceEditingSurface(nodeId)}
                className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:text-[var(--color-accent-primary)]"
              >
                {gap.label}
              </a>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

/** AC-1: opens the edit form; AC-5: opens the delete confirm. Hidden
 * entirely when panelEdit is absent (M1 read-only callers) or canEdit is
 * false (AC-8). */
function EditDeleteButtons({ panelEdit, canEdit }: { panelEdit: UsePanelEditResult; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="mt-[var(--space-2)] flex gap-[var(--space-2)]">
      <Button type="button" variant="secondary" onClick={panelEdit.openEdit}>
        Edit
      </Button>
      <Button type="button" variant="danger" onClick={panelEdit.requestDelete}>
        Delete
      </Button>
    </div>
  );
}

/** AC-1/AC-3/AC-4: the property edit form -- label + each key property as a
 * plain-text input (CE's SHACL datatype coercion validates server-side, see
 * use-panel-edit.ts). */
function EditForm({ state, panelEdit }: { state: Extract<SidePanelState, { status: "loaded" }>; panelEdit: UsePanelEditResult }) {
  if (panelEdit.edit.mode !== "edit") return null;
  const { form } = panelEdit.edit;
  return (
    <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
      <Input aria-label="Label" value={form.label} onChange={(e) => panelEdit.setLabel(e.target.value)} />
      {state.keyProperties.map((property) => (
        <Input
          key={property.path}
          aria-label={property.label}
          value={form.properties[property.path] ?? ""}
          onChange={(e) => panelEdit.setProperty(property.path, e.target.value)}
        />
      ))}
      {panelEdit.violationMessages.map((message) => (
        <p key={message} className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          {message}
        </p>
      ))}
      <div className="flex gap-[var(--space-2)]">
        <Button type="button" variant="primary" onClick={panelEdit.save}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={panelEdit.cancelEdit}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** AC-2: another writer committed since edit started -- shows both values
 * and lets the user overwrite (re-running save(), which re-checks the
 * drift head and this time commits) or discard their own edits. */
function ConflictNotice({ panelEdit }: { panelEdit: UsePanelEditResult }) {
  if (panelEdit.edit.mode !== "conflict") return null;
  const { yours, server } = panelEdit.edit;
  return (
    <div className="mt-[var(--space-3)] rounded-[var(--radius-sm)] border border-[var(--color-danger)] p-[var(--space-3)]">
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
        This node changed since you started editing.
      </p>
      <p className="mt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Your label</p>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{yours.label}</p>
      <p className="mt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Current label</p>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{server.label}</p>
      <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
        <Button type="button" variant="primary" onClick={panelEdit.save}>
          Save anyway
        </Button>
        <Button type="button" variant="secondary" onClick={panelEdit.cancelEdit}>
          Discard my changes
        </Button>
      </div>
    </div>
  );
}

const DELETE_DIALOG_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

/** AC-5: shows the full incident-edge batch count (edges + the node itself)
 * before committing a delete -- straight confirm, no reference warning
 * (edges have no referential integrity to protect, per the task brief). */
function DeleteConfirmDialog({ panelEdit }: { panelEdit: UsePanelEditResult }) {
  const open = panelEdit.deleteConfirm !== null;
  const incidentCount = panelEdit.deleteConfirm?.incidentCount ?? 0;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) panelEdit.cancelDelete(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label="Confirm delete" className={DELETE_DIALOG_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Delete this node?
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            This removes the node and its {incidentCount} connected edge{incidentCount === 1 ? "" : "s"}.
          </Dialog.Description>
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={panelEdit.cancelDelete}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={panelEdit.confirmDelete}>
              Delete
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** AC-6/AC-7: delete failed (timeout/error) -- canvas was left untouched
 * (commitDelete only calls adapter.removeElements on a 201), so this is
 * just a dismissable notice, not a rollback. */
function DeleteFailedToast({ panelEdit }: { panelEdit: UsePanelEditResult }) {
  if (!panelEdit.deleteFailed) return null;
  return <Toast message="Delete failed -- canvas unchanged. Try again." onDismiss={panelEdit.dismissDeleteFailed} />;
}

interface LoadedPanelBodyProps {
  state: Extract<SidePanelState, { status: "loaded" }>;
  onEditGap?: (nodeId: string, predicateIri: string) => void;
  panelEdit?: UsePanelEditResult;
  canEdit: boolean;
}

/** The `status === "loaded"` branch's body -- split out of `SidePanel` to
 * keep it under Law E's complexity + line budgets. */
function LoadedPanelBody({ state, onEditGap, panelEdit, canEdit }: LoadedPanelBodyProps) {
  return (
    <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
      {(!panelEdit || panelEdit.edit.mode === "view") &&
        state.keyProperties.map((property) => (
          <div key={property.path}>
            <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{property.label}</p>
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">{property.value}</p>
          </div>
        ))}
      {panelEdit && panelEdit.edit.mode === "view" && <EditDeleteButtons panelEdit={panelEdit} canEdit={canEdit} />}
      {panelEdit && <EditForm state={state} panelEdit={panelEdit} />}
      {panelEdit && <ConflictNotice panelEdit={panelEdit} />}
      <AdvancedDisclosure rawIri={state.rawIri} />
      <CommentsPanel targetKind="node" targetRef={state.nodeId} />
      <MissingLinks nodeId={state.nodeId} gaps={state.gaps ?? []} onEditGap={onEditGap} />
    </div>
  );
}

export function SidePanel({ state, onClose, onRetry, onEditGap, panelEdit, canEdit = false }: SidePanelProps) {
  if (state.status === "closed") return null;

  if (state.status === "not-found") {
    return (
      <div className={PANEL_CLASSES} data-testid="explorer-side-panel">
        <div className="flex items-center justify-between">
          <p className="text-[length:var(--text-body)] text-[var(--color-text-default)]">Not found</p>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className={PANEL_CLASSES} data-testid="explorer-side-panel">
      <Heading label={state.label} typeLabel={state.typeLabel} onClose={onClose} />

      {state.status === "loading" && (
        <p className="mt-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-subtle)]">Loading…</p>
      )}

      {state.status === "error" && (
        <div className="mt-[var(--space-3)]">
          <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">Details unavailable — retry</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)]"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "loaded" && (
        <LoadedPanelBody state={state} onEditGap={onEditGap} panelEdit={panelEdit} canEdit={canEdit} />
      )}
      {panelEdit && <DeleteConfirmDialog panelEdit={panelEdit} />}
      {panelEdit && <DeleteFailedToast panelEdit={panelEdit} />}
    </div>
  );
}
