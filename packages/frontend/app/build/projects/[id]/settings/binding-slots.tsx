"use client";

import { useCallback, useEffect, useState } from "react";

import { BindingCardList } from "./binding-card";
import { BindingDialogs } from "./bind-dialog";

export interface BindingHealth {
  status: string;
  last_sync: string | null;
  last_error: string | null;
  error_count: number;
  skipped_count: number;
}

export interface Binding {
  binding_id: string;
  system: string;
  connector_ref: string;
  space_ref: string;
  created_by: string;
  created_at: string;
  health: BindingHealth;
}

/** Maps a PUT failure body to a user-facing conflict message -- AC-2
 * (unknown connector instance) and AC-4 (duplicate binding) each get a
 * specific message; anything else falls back to a generic write-failure. */
function bindErrorMessage(body: unknown): string {
  const detail = body as { error?: string; available?: string[]; system?: string; space_ref?: string };
  if (detail.error === "unknown_instance") {
    return `Unknown connector instance. Available: ${(detail.available ?? []).join(", ") || "none"}.`;
  }
  if (detail.error === "duplicate_binding") {
    return `${detail.space_ref} is already bound to ${detail.system}.`;
  }
  return "Couldn't save the binding. Try again shortly.";
}

/** Fetches the binding list whenever `version` changes -- same
 * refetch-on-version-bump shape as `contributors-tab.tsx`'s
 * `useContributorList`, plus a load-error surface it doesn't need. */
function useBindings(
  projectId: string,
  version: number
): { bindings: Binding[] | null; loadError: string | null } {
  const [bindings, setBindings] = useState<Binding[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/build/projects/${projectId}/bindings`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json() as Promise<{ items: Binding[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted) setBindings(body.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadError("Couldn't load bindings. Try again shortly.");
        }
      });
    return () => controller.abort();
  }, [projectId, version]);

  return { bindings, loadError };
}

/** Bundles the two write paths + their dialog-scoped error state -- split
 * out of `BindingSlots` to keep it under the function-length budget.
 * `onSaved`/`onRemoved` run only after the request actually succeeds. */
function useBindingActions(
  projectId: string,
  onSaved: () => void,
  onRemoved: () => void
): {
  save: (system: string, connectorRef: string, spaceRef: string) => void;
  remove: (binding: Binding) => void;
  bindError: string | null;
  removeError: string | null;
  resetBindError: () => void;
  resetRemoveError: () => void;
} {
  const [bindError, setBindError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const save = useCallback(
    (system: string, connectorRef: string, spaceRef: string) => {
      setBindError(null);
      fetch(`/api/build/projects/${projectId}/bindings`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ system, connector_ref: connectorRef, space_ref: spaceRef }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(bindErrorMessage(await res.json().catch(() => ({}))));
          onSaved();
        })
        .catch((err: Error) => setBindError(err.message));
    },
    [projectId, onSaved]
  );

  const remove = useCallback(
    (binding: Binding) => {
      setRemoveError(null);
      fetch(`/api/build/projects/${projectId}/bindings/${binding.binding_id}`, {
        method: "DELETE",
      })
        .then(onRemoved)
        .catch(() => setRemoveError("Couldn't remove the binding. Try again shortly."));
    },
    [projectId, onRemoved]
  );

  return {
    save,
    remove,
    bindError,
    removeError,
    resetBindError: () => setBindError(null),
    resetRemoveError: () => setRemoveError(null),
  };
}

/** Owns every piece of UI state (dialog open/target, save-success flag,
 * refetch version) -- split out so `BindingSlots` itself is pure JSX
 * assembly, under the function-length budget. */
function useBindingSlotsState(projectId: string) {
  const [version, setVersion] = useState(0);
  const { bindings, loadError } = useBindings(projectId, version);
  const [openSystem, setOpenSystem] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Binding | null>(null);
  const [saved, setSaved] = useState(false);
  const { save, remove, bindError, removeError, resetBindError, resetRemoveError } =
    useBindingActions(
      projectId,
      useCallback(() => {
        setOpenSystem(null);
        setSaved(true);
        setVersion((v) => v + 1);
      }, []),
      useCallback(() => {
        setRemoveTarget(null);
        setVersion((v) => v + 1);
      }, [])
    );

  return {
    bindings,
    loadError,
    saved,
    bindError,
    removeError,
    openSystem,
    removeTarget,
    onBind: (system: string) => {
      resetBindError();
      setSaved(false);
      setOpenSystem(system);
    },
    onRemoveRequest: (binding: Binding) => {
      resetRemoveError();
      setRemoveTarget(binding);
    },
    onSave: (connectorRef: string, spaceRef: string) => {
      if (openSystem) save(openSystem, connectorRef, spaceRef);
    },
    onCancelBind: () => setOpenSystem(null),
    onConfirmRemove: () => {
      if (removeTarget) remove(removeTarget);
    },
    onCancelRemove: () => setRemoveTarget(null),
  };
}

/** TASK-022 (FR-010): real per-system binding cards over
 * `.../projects/{id}/bindings` (TASK-010's `pm/bindings.py`, guarded
 * admin-only server-side by `require_project_role(ProjectAction.BINDINGS)`
 * -- `canManage` here only hides controls, matching `ContributorsTab`'s
 * convention). No "edit": `put()` is insert-only (whole-key unique), so
 * changing a binding is remove-then-rebind, not an update.
 */
export function BindingSlots({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}): React.JSX.Element {
  const state = useBindingSlotsState(projectId);

  if (!state.bindings && !state.loadError) {
    return <p className="text-[var(--color-text-muted)]">Loading bindings…</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {state.loadError && (
        <p role="alert" className="text-[var(--color-danger)]">
          {state.loadError}
        </p>
      )}
      {state.saved && (
        <p role="status" className="text-[var(--color-success)]">
          Saved.
        </p>
      )}
      <BindingCardList
        bindings={state.bindings}
        canManage={canManage}
        onBind={state.onBind}
        onRemove={state.onRemoveRequest}
      />
      <BindingDialogs
        openSystem={state.openSystem}
        bindError={state.bindError}
        removeTarget={state.removeTarget}
        removeError={state.removeError}
        onSave={state.onSave}
        onCancelBind={state.onCancelBind}
        onConfirmRemove={state.onConfirmRemove}
        onCancelRemove={state.onCancelRemove}
      />
    </div>
  );
}
