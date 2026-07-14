"use client";

import { useCallback, useState } from "react";

import { useAutoRefresh, type RefreshResult } from "@/lib/dashboard/use-auto-refresh";

import { LibraryPanel } from "./library-panel";
import type { LibraryItemOut, WidgetOut } from "./types";
import { WidgetGrid } from "./widget-grid";

async function postJson(path: string, body?: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** TASK-014 AC-1/AC-2/AC-6: pin promotes a suggested widget or persists an
 * explicit pin; response body is the new `scope='user'` row. */
async function pinWidget(id: string): Promise<WidgetOut | null> {
  const response = await postJson(`/api/dashboard/widgets/${id}/pin`);
  return response.ok ? ((await response.json()) as WidgetOut) : null;
}

async function unpinWidget(id: string): Promise<boolean> {
  const response = await fetch(`/api/dashboard/widgets/${id}`, { method: "DELETE" });
  return response.ok;
}

async function reorderWidgets(idsInOrder: string[]): Promise<boolean> {
  const response = await fetch("/api/dashboard/widgets/order", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids_in_order: idsInOrder }),
  });
  return response.ok;
}

async function fetchRefresh(id: string): Promise<RefreshResult> {
  const response = await postJson(`/api/dashboard/widgets/${id}/refresh`);
  if (!response.ok) return { status: "unavailable", fetched_at: null };
  return (await response.json()) as RefreshResult;
}

// ponytail: two `window.prompt()` calls stand in for a publish form/modal --
// swap for a real dialog if product wants richer input (multi-line
// description, validation feedback) than the browser prompt gives.
function askPublishDetails(): { name: string; description: string | null } | null {
  const name = window.prompt("Name this library widget:");
  if (!name) return null;
  const description = window.prompt("Optional description:");
  return { name, description: description || null };
}

async function publishWidget(id: string): Promise<LibraryItemOut | null> {
  const details = askPublishDetails();
  if (!details) return null;
  const response = await postJson("/api/dashboard/library", { widget_id: id, ...details });
  return response.ok ? ((await response.json()) as LibraryItemOut) : null;
}

async function addLibraryItem(id: string): Promise<WidgetOut | null> {
  const response = await postJson(`/api/dashboard/library/${id}/add`);
  return response.ok ? ((await response.json()) as WidgetOut) : null;
}

export interface DashboardClientProps {
  initialWidgets: WidgetOut[];
  initialLibraryItems: LibraryItemOut[];
}

/** Owns merged widget state for the interactive dashboard grid (TASK-014:
 * pin/unpin/reorder/auto-refresh) plus the tenant widget library
 * (TASK-015: publish/add) -- `WidgetGrid`/`WidgetTile` stay presentational,
 * all backend calls live here.
 */
/** Extracted from `DashboardClient` to keep the component itself under the
 * function-length budget (Law E) -- all state-mutating handlers live here. */
function useDashboardActions(
  setWidgets: (updater: (prev: WidgetOut[]) => WidgetOut[]) => void,
  setLibraryItems: (updater: (prev: LibraryItemOut[]) => LibraryItemOut[]) => void
) {
  const handlePin = useCallback(async (id: string) => {
    const pinned = await pinWidget(id);
    if (pinned) setWidgets((prev) => [...prev.filter((w) => w.id !== id), pinned]);
  }, [setWidgets]);

  const handleUnpin = useCallback(async (id: string) => {
    if (await unpinWidget(id)) setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, [setWidgets]);

  const handleReorder = useCallback(async (idsInOrder: string[]) => {
    if (!(await reorderWidgets(idsInOrder))) return;
    const order = new Map(idsInOrder.map((id, index) => [id, index]));
    setWidgets((prev) => prev.map((w) => (order.has(w.id) ? { ...w, position: order.get(w.id) as number } : w)));
  }, [setWidgets]);

  const handlePublish = useCallback(async (id: string) => {
    const item = await publishWidget(id);
    if (item) setLibraryItems((prev) => [item, ...prev]);
  }, [setLibraryItems]);

  const handleAdd = useCallback(async (id: string) => {
    const copy = await addLibraryItem(id);
    if (copy) setWidgets((prev) => [...prev, copy]);
  }, [setWidgets]);

  const handleRefreshed = useCallback(
    (id: string, result: RefreshResult) => setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...result } : w))),
    [setWidgets]
  );

  return { handlePin, handleUnpin, handleReorder, handlePublish, handleAdd, handleRefreshed };
}

export function DashboardClient({ initialWidgets, initialLibraryItems }: DashboardClientProps) {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [libraryItems, setLibraryItems] = useState(initialLibraryItems);
  const { handlePin, handleUnpin, handleReorder, handlePublish, handleAdd, handleRefreshed } =
    useDashboardActions(setWidgets, setLibraryItems);

  useAutoRefresh(widgets, fetchRefresh, handleRefreshed);

  return (
    <>
      <WidgetGrid
        widgets={widgets}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onReorder={handleReorder}
        onPublish={handlePublish}
      />
      <LibraryPanel items={libraryItems} onAdd={handleAdd} />
    </>
  );
}
