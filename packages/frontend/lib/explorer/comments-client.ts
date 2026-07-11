export type CommentTargetKind = "node" | "view";

export interface CommentSummary {
  comment_id: string;
  target_kind: CommentTargetKind;
  target_ref: string;
  author: string;
  body: string;
  created_at: string;
}

/** AC-6: GET /api/proxy/comments -- degrades to an empty list rather than
 * throwing (same non-fatal convention as layout-client.ts). */
export async function listComments(targetKind: CommentTargetKind, targetRef: string): Promise<CommentSummary[]> {
  const query = new URLSearchParams({ target_kind: targetKind, target_ref: targetRef }).toString();
  const res = await fetch(`/api/proxy/comments?${query}`, { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as CommentSummary[];
}

/** AC-6: POST /api/proxy/comments -- returns the created comment's id, or
 * null on any failure (empty body / bad target); caller surfaces its own
 * error state. */
export async function createComment(targetKind: CommentTargetKind, targetRef: string, body: string): Promise<string | null> {
  const res = await fetch("/api/proxy/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_kind: targetKind, target_ref: targetRef, body }),
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { comment_id: string };
  return payload.comment_id;
}
