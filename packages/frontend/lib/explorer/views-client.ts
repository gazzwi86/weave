import type { SavedViewDefinition, ViewSaveBody } from "./saved-view-state";

export interface ViewSummary {
  view_id: string;
  name: string;
  created_by: string;
  pinned: boolean;
  updated_at: string;
  /** AC-2: openView(view) reads this straight off the list row -- see
   * TASK-026's ViewOut.definition backend fix (list SQL now selects it). */
  definition: SavedViewDefinition;
}

export type SaveViewResult =
  | { status: "created"; view_id: string }
  | { status: "collision"; existing_view_id: string }
  | { status: "error"; error: string };

/** AC-1: POST /api/proxy/views -- a 409 name-collision is a normal outcome
 * (the save dialog prompts overwrite/rename), never thrown. */
export async function saveView(body: ViewSaveBody): Promise<SaveViewResult> {
  const res = await fetch("/api/proxy/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as { view_id?: string; existing_view_id?: string; error?: string };
  if (res.status === 201 && payload.view_id) return { status: "created", view_id: payload.view_id };
  if (res.status === 409 && payload.existing_view_id) return { status: "collision", existing_view_id: payload.existing_view_id };
  return { status: "error", error: payload.error ?? "unknown_error" };
}

/** AC-4: GET /api/proxy/views -- degrades to an empty list rather than
 * throwing, same non-fatal-degrade convention as layout-client.ts. */
export async function listViews(): Promise<ViewSummary[]> {
  const res = await fetch("/api/proxy/views", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as ViewSummary[];
}

/** AC-4: DELETE /api/proxy/views/{id} -- true on success, false on any
 * failure (403/404/network); caller surfaces its own error toast. */
export async function deleteView(viewId: string): Promise<boolean> {
  const res = await fetch(`/api/proxy/views/${encodeURIComponent(viewId)}`, { method: "DELETE" });
  return res.ok;
}

export interface ShareResult {
  notified: number;
  excluded: number;
}

/** AC-5: POST /api/proxy/views/{id}/share -- eligibility is server-decided,
 * response is counts only. */
export async function shareView(viewId: string, recipients: string[]): Promise<ShareResult | null> {
  const res = await fetch(`/api/proxy/views/${encodeURIComponent(viewId)}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipients }),
  });
  if (!res.ok) return null;
  return (await res.json()) as ShareResult;
}
