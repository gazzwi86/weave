"use client";

import { useCallback, useEffect, useState } from "react";

import {
  createComment as defaultCreateComment,
  listComments as defaultListComments,
  type CommentSummary,
  type CommentTargetKind,
} from "@/lib/explorer/comments-client";

export interface UseCommentsOptions {
  targetKind: CommentTargetKind;
  /** null when there's nothing to comment on yet (panel closed / no view
   * saved) -- the hook simply doesn't fetch until a ref is set. */
  targetRef: string | null;
  listComments?: (targetKind: CommentTargetKind, targetRef: string) => Promise<CommentSummary[]>;
  createComment?: (targetKind: CommentTargetKind, targetRef: string, body: string) => Promise<string | null>;
}

export interface UseCommentsResult {
  comments: CommentSummary[];
  draft: string;
  setDraft: (value: string) => void;
  submit: () => Promise<void>;
  submitting: boolean;
}

/** TASK-026 AC-6: comment list + composer for one target (node or view). */
export function useComments({
  targetKind,
  targetRef,
  listComments = defaultListComments,
  createComment = defaultCreateComment,
}: UseCommentsOptions): UseCommentsResult {
  const [comments, setComments] = useState<CommentSummary[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetRef) {
      setComments([]);
      return;
    }
    setComments(await listComments(targetKind, targetRef));
  }, [targetKind, targetRef, listComments]);

  useEffect(() => {
    let cancelled = false;
    const nextComments = targetRef ? listComments(targetKind, targetRef) : Promise.resolve([]);
    nextComments.then((result) => {
      if (!cancelled) setComments(result);
    });
    return () => {
      cancelled = true;
    };
  }, [targetKind, targetRef, listComments]);

  const submit = useCallback(async () => {
    if (!targetRef || !draft.trim()) return;
    setSubmitting(true);
    const commentId = await createComment(targetKind, targetRef, draft.trim());
    setSubmitting(false);
    if (commentId) {
      setDraft("");
      await refresh();
    }
  }, [targetKind, targetRef, draft, createComment, refresh]);

  return { comments, draft, setDraft, submit, submitting };
}
