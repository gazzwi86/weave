"use client";

import { useCallback, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { getDraftHead } from "@/lib/explorer/draft-head";
import {
  buildDeleteOps,
  commitDelete,
  commitUpdate,
  postToWriteProxy,
  type WriteProxyFn,
} from "@/lib/explorer/edit-controller";
import { fetchNodeProps as defaultFetchNodeProps, type FetchNodePropsResult, type NodeProps } from "@/lib/explorer/fetch-node-props";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import type { SidePanelState } from "./use-node-spotlight";

export interface PanelEditFormValues {
  label: string;
  /** Keyed by `KeyProperty.path` -- every value is a plain string; CE's
   * own SHACL `sh:datatype` coerces + validates on save (422 on mismatch,
   * AC-4), so the form needs no client-side per-datatype input widgets.
   * ponytail: text-input-everywhere: unlocks real date/number pickers only
   * once CE-READ-1 surfaces a `datatype` per key property. */
  properties: Record<string, string>;
}

export type PanelEditState =
  | { mode: "view" }
  | { mode: "edit"; form: PanelEditFormValues; editBase: number }
  | { mode: "conflict"; yours: PanelEditFormValues; server: PanelEditFormValues; editBase: number }
  | { mode: "saving" };

export interface UsePanelEditOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  panel: SidePanelState;
  /** AC-8 UX layer -- CE-WRITE-1 independently rejects server-side. */
  canEdit: boolean;
  onSaved?: () => void;
  onDeleted?: () => void;
  /** Test seam -- defaults to the real write proxy. */
  writeProxy?: WriteProxyFn;
  /** Test seam -- defaults to the real CE-READ-1 proxy fetch (reused for
   * AC-2's conflict re-check; delete's incident-edge set reuses the
   * already-loaded `panel.neighbours` instead, per the brief's hint). */
  fetchNodeProps?: (iri: string, timeoutMs: number) => Promise<FetchNodePropsResult>;
}

export interface UsePanelEditResult {
  edit: PanelEditState;
  violationMessages: string[];
  deleteConfirm: { incidentCount: number } | null;
  deleteFailed: boolean;
  openEdit(): void;
  cancelEdit(): void;
  setLabel(value: string): void;
  setProperty(path: string, value: string): void;
  save(): Promise<void>;
  dismissViolations(): void;
  requestDelete(): void;
  confirmDelete(): Promise<void>;
  cancelDelete(): void;
  dismissDeleteFailed(): void;
}

function formValuesFrom(data: { label: string; keyProperties: NodeProps["keyProperties"] }): PanelEditFormValues {
  const properties: Record<string, string> = {};
  for (const property of data.keyProperties) properties[property.path] = property.value;
  return { label: data.label, properties };
}

interface UseEditFormOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  panel: SidePanelState;
  canEdit: boolean;
  onSaved?: () => void;
  writeProxy: WriteProxyFn;
  fetchNodeProps: (iri: string, timeoutMs: number) => Promise<FetchNodePropsResult>;
}

/** AC-1..AC-4: edit-mode state machine + save (with the drift guard). Split
 * out of `usePanelEdit` to keep both hooks under Law E's 50-line budget. */
function useEditForm({ adapter, config, panel, canEdit, onSaved, writeProxy, fetchNodeProps }: UseEditFormOptions) {
  const [edit, setEdit] = useState<PanelEditState>({ mode: "view" });
  const [violationMessages, setViolationMessages] = useState<string[]>([]);

  const openEdit = useCallback(() => {
    if (!canEdit || panel.status !== "loaded") return;
    setViolationMessages([]);
    setEdit({ mode: "edit", form: formValuesFrom(panel), editBase: getDraftHead() });
  }, [canEdit, panel]);

  const cancelEdit = useCallback(() => {
    setViolationMessages([]);
    setEdit({ mode: "view" });
  }, []);

  const setLabel = useCallback((value: string) => {
    setEdit((current) => withEditedForm(current, (form) => ({ ...form, label: value })));
  }, []);

  const setProperty = useCallback((path: string, value: string) => {
    setEdit((current) => withEditedForm(current, (form) => ({ ...form, properties: { ...form.properties, [path]: value } })));
  }, []);

  const dismissViolations = useCallback(() => setViolationMessages([]), []);

  const save = useCallback(async () => {
    if (panel.status !== "loaded" || (edit.mode !== "edit" && edit.mode !== "conflict") || !adapter) return;
    await saveEdit({ edit, panel, adapter, config, writeProxy, fetchNodeProps, onSaved, setEdit, setViolationMessages });
  }, [adapter, config, edit, fetchNodeProps, onSaved, panel, writeProxy]);

  return { edit, violationMessages, openEdit, cancelEdit, setLabel, setProperty, save, dismissViolations };
}

interface SaveEditOptions {
  edit: EditingState;
  panel: Extract<SidePanelState, { status: "loaded" }>;
  adapter: RendererAdapter;
  config: ExplorerConfig;
  writeProxy: WriteProxyFn;
  fetchNodeProps: (iri: string, timeoutMs: number) => Promise<FetchNodePropsResult>;
  onSaved?: () => void;
  setEdit: (state: PanelEditState) => void;
  setViolationMessages: (messages: string[]) => void;
}

/** The commit half of AC-1..AC-4's save flow -- split out of `useEditForm`
 * to keep it under Law E's 50-line budget. Not a hook itself (no hook calls
 * inside), just the async body `save`'s `useCallback` delegates to. */
async function saveEdit({
  edit,
  panel,
  adapter,
  config,
  writeProxy,
  fetchNodeProps,
  onSaved,
  setEdit,
  setViolationMessages,
}: SaveEditOptions): Promise<void> {
  const form = formOf(edit);

  // AC-2/AC-3: cheap, synchronous re-check at save time (not just
  // edit-start) -- narrows the drift window vs. only capturing editBase
  // once. See draft-head.ts for why this is a local counter, not a real
  // CE version handle.
  const head = getDraftHead();
  if (head !== edit.editBase) {
    const result = await fetchNodeProps(panel.nodeId, config.ceTimeoutMs);
    if (result.type === "ok") setEdit({ mode: "conflict", yours: form, server: formValuesFrom(result.data), editBase: head });
    return;
  }

  setViolationMessages([]);
  const result = await commitUpdate({
    iri: panel.nodeId,
    properties: { label: form.label, ...form.properties },
    labelOverride: form.label,
    adapter,
    writeProxy,
    timeoutMs: config.ceTimeoutMs,
  });

  if (result.status === "ok") {
    setEdit({ mode: "view" });
    onSaved?.();
    return;
  }
  if (result.status === "violations") {
    setViolationMessages(result.messages);
    setEdit({ mode: "edit", form, editBase: getDraftHead() });
    return;
  }
  setViolationMessages(["Save failed -- retry"]);
  setEdit({ mode: "edit", form, editBase: edit.editBase });
}

interface UseDeleteFlowOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  panel: SidePanelState;
  canEdit: boolean;
  onDeleted?: () => void;
  writeProxy: WriteProxyFn;
}

/** AC-5..AC-7: delete-confirm + commit. Split out of `usePanelEdit` to keep
 * both hooks under Law E's 50-line budget. */
function useDeleteFlow({ adapter, config, panel, canEdit, onDeleted, writeProxy }: UseDeleteFlowOptions) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ incidentCount: number } | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const requestDelete = useCallback(() => {
    if (!canEdit || panel.status !== "loaded") return;
    setDeleteFailed(false);
    setDeleteConfirm({ incidentCount: panel.neighbours.length });
  }, [canEdit, panel]);

  const cancelDelete = useCallback(() => setDeleteConfirm(null), []);
  const dismissDeleteFailed = useCallback(() => setDeleteFailed(false), []);

  const confirmDelete = useCallback(async () => {
    if (panel.status !== "loaded" || !adapter) return;
    setDeleteConfirm(null);
    const ops = buildDeleteOps(panel.nodeId, panel.neighbours);
    const result = await commitDelete({ ops, adapter, writeProxy, timeoutMs: config.ceTimeoutMs });
    if (result.status === "ok") {
      onDeleted?.();
      return;
    }
    setDeleteFailed(true);
  }, [adapter, config.ceTimeoutMs, onDeleted, panel, writeProxy]);

  return { deleteConfirm, deleteFailed, requestDelete, cancelDelete, confirmDelete, dismissDeleteFailed };
}

/** TASK-024 AC-1..AC-8: side-panel property edit (with GE-side optimistic
 * drift guard, ADR-021) and delete-node/edge, both reusing TASK-023's
 * write proxy + Edit Controller. Kept out of `SidePanel` itself so the
 * presentational component stays a pure prop-forwarder. */
export function usePanelEdit({
  adapter,
  config,
  panel,
  canEdit,
  onSaved,
  onDeleted,
  writeProxy = postToWriteProxy,
  fetchNodeProps = defaultFetchNodeProps,
}: UsePanelEditOptions): UsePanelEditResult {
  const editForm = useEditForm({ adapter, config, panel, canEdit, onSaved, writeProxy, fetchNodeProps });
  const deleteFlow = useDeleteFlow({ adapter, config, panel, canEdit, onDeleted, writeProxy });
  return { ...editForm, ...deleteFlow };
}

type EditingState = Extract<PanelEditState, { mode: "edit" }> | Extract<PanelEditState, { mode: "conflict" }>;

function formOf(state: EditingState): PanelEditFormValues {
  return state.mode === "edit" ? state.form : state.yours;
}

/** Applies `mutate` to whichever field currently holds the user's pending
 * values ("form" in edit mode, "yours" once a conflict notice is showing)
 * -- a no-op outside those two modes. */
function withEditedForm(state: PanelEditState, mutate: (form: PanelEditFormValues) => PanelEditFormValues): PanelEditState {
  if (state.mode !== "edit" && state.mode !== "conflict") return state;
  const nextForm = mutate(formOf(state));
  return state.mode === "edit" ? { ...state, form: nextForm } : { ...state, yours: nextForm };
}
