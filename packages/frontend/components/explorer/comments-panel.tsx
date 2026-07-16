"use client";

import { RelativeTime } from "@/components/molecules/RelativeTime";
import type { CommentSummary, CommentTargetKind } from "@/lib/explorer/comments-client";
import { useComments } from "./use-comments";

export interface CommentsPanelProps {
  targetKind: CommentTargetKind;
  targetRef: string | null;
}

// ponytail (Option-2, coordinator-confirmed): no tenant member/display-name
// directory exists anywhere in this codebase, so the author token is just
// the IRI's local part (mirrors TASK-025's workspace-switch precedent).
// Server still owns real identity -- this is display-only.
function authorToken(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

function CommentRow({ comment }: { comment: CommentSummary }) {
  return (
    <li className="border-b border-[var(--color-border)] py-[var(--space-2)] last:border-none">
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {authorToken(comment.author)}
        </span>
        <RelativeTime iso={comment.created_at} />
      </div>
      <p className="mt-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]">
        {comment.body}
      </p>
    </li>
  );
}

/** TASK-026 AC-6: comment thread + composer for the spotlighted node (or a
 * saved view), mounted from side-panel.tsx. */
export function CommentsPanel({ targetKind, targetRef }: CommentsPanelProps) {
  const { comments, draft, setDraft, submit, submitting } = useComments({ targetKind, targetRef });

  return (
    <section className="mt-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-3)]">
      <h2 className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">Comments</h2>
      {comments.length > 0 && (
        <ul className="mt-[var(--space-2)]" data-testid="comments-list">
          {comments.map((comment) => (
            <CommentRow key={comment.comment_id} comment={comment} />
          ))}
        </ul>
      )}
      <form
        className="mt-[var(--space-2)] flex gap-[var(--space-2)]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="comment-draft">
          Add a comment
        </label>
        <input
          id="comment-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
        />
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-hover)] disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </section>
  );
}
