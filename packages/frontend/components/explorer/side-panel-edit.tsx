import * as Dialog from "@radix-ui/react-dialog";

import { toEdgeRows } from "@/lib/explorer/inspector-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { EntityEditDrawer } from "@/components/organisms/EntityEditDrawer";
import { RelationshipsEditor } from "@/components/molecules/RelationshipsEditor";

import type { UsePanelEditResult } from "./use-panel-edit";
import type { SidePanelState } from "./use-node-spotlight";

// TASK-024's key properties don't carry a "this is the description" flag --
// rdfs:comment is the one CE convention every fixture in this codebase
// already uses for it (see fetch-node-props.ts's own test fixtures), so
// it's the field the drawer's universal Description input reads/writes.
const DESCRIPTION_PATH = "rdfs:comment";

// ponytail: edge add/remove already lives on the canvas (TASK-023/024's
// draw-edge gestures + context menu), not duplicated in this drawer -- the
// relationships list here is a read-only prefill, so onAdd/onRemove are
// deliberate no-ops.
function noopAdd(): void {}
function noopRemove(): void {}

/** AC-1: opens the edit form; AC-5: opens the delete confirm. Hidden
 * entirely when canEdit is false (AC-8). */
export function EditDeleteButtons({ panelEdit, canEdit }: { panelEdit: UsePanelEditResult; canEdit: boolean }) {
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

interface KindFieldsProps {
  properties: Extract<SidePanelState, { status: "loaded" }>["keyProperties"];
  form: Extract<UsePanelEditResult["edit"], { mode: "edit" }>["form"];
  panelEdit: UsePanelEditResult;
}

/** The remaining key properties (everything but the drawer's universal
 * Description field) -- split out to keep PanelEditDrawer under Law E's
 * complexity budget. */
function KindFields({ properties, form, panelEdit }: KindFieldsProps) {
  const rest = properties.filter((property) => property.path !== DESCRIPTION_PATH);
  if (rest.length === 0 && panelEdit.violationMessages.length === 0) return null;
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      {rest.map((property) => (
        <Input
          key={property.path}
          aria-label={property.label}
          value={form.properties[property.path] ?? ""}
          onChange={(event) => panelEdit.setProperty(property.path, event.target.value)}
        />
      ))}
      {panelEdit.violationMessages.map((message) => (
        <p key={message} className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          {message}
        </p>
      ))}
    </div>
  );
}

/** AC-1/AC-3/AC-4: the property edit drawer -- refit onto the shared
 * EntityEditDrawer organism (mock's `#edit-drawer`) instead of the earlier
 * inline form. Label + rdfs:comment are the drawer's universal fields, the
 * remaining key properties become kindFields, and the node's edges render
 * as a read-only RelationshipsEditor prefill. */
export function PanelEditDrawer({
  state,
  panelEdit,
}: {
  state: Extract<SidePanelState, { status: "loaded" }>;
  panelEdit: UsePanelEditResult;
}) {
  if (panelEdit.edit.mode !== "edit") return null;
  const { form } = panelEdit.edit;
  const rels = toEdgeRows(state.neighbours).map((edge) => ({ predicate: edge.predicateLabel, target: edge.targetLabel }));

  return (
    <EntityEditDrawer
      open
      onClose={panelEdit.cancelEdit}
      onSave={panelEdit.save}
      icon="pencil"
      tone="var(--color-accent-primary)"
      title={state.label}
      label={form.label}
      onLabelChange={panelEdit.setLabel}
      description={form.properties[DESCRIPTION_PATH] ?? ""}
      onDescriptionChange={(value) => panelEdit.setProperty(DESCRIPTION_PATH, value)}
      kindFields={<KindFields properties={state.keyProperties} form={form} panelEdit={panelEdit} />}
      relationships={rels.length > 0 ? <RelationshipsEditor rels={rels} onAdd={noopAdd} onRemove={noopRemove} hideLabel /> : undefined}
    />
  );
}

/** AC-2: another writer committed since edit started -- shows both values
 * and lets the user overwrite (re-running save(), which re-checks the
 * drift head and this time commits) or discard their own edits. */
export function ConflictNotice({ panelEdit }: { panelEdit: UsePanelEditResult }) {
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
export function DeleteConfirmDialog({ panelEdit }: { panelEdit: UsePanelEditResult }) {
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
export function DeleteFailedToast({ panelEdit }: { panelEdit: UsePanelEditResult }) {
  if (!panelEdit.deleteFailed) return null;
  return <Toast message="Delete failed -- canvas unchanged. Try again." onDismiss={panelEdit.dismissDeleteFailed} />;
}
