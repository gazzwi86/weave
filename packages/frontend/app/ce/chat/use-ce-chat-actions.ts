import { useCallback, type RefObject } from "react";

import { buildConsequencesExplanation, buildProposalExplanation, buildWhyExplanation } from "./explain";
import { invertOperations } from "./invert";
import type { ChatMessage, KindEntry, Op } from "./types";

interface LastApplied {
  operations: Op[];
  refMap: Record<string, string>;
}

interface NlPreviewBody {
  operations?: Op[];
  message?: string;
}

function newMessage(
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return { id: crypto.randomUUID(), role, text, ...extra };
}

/** AC-006-06: ambiguous/unparseable intent asks a clarifying question
 * rather than guessing -- never silently dispatches a guess.
 */
async function parseIntent(text: string): Promise<ChatMessage> {
  const res = await fetch("/api/ontology/authoring/nl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, known_class_iris: {}, preview: true }),
  });
  const body = (await res.json()) as NlPreviewBody;
  if (!res.ok || !body.operations || body.operations.length === 0) {
    return newMessage(
      "assistant",
      body.message ?? "I'm not sure what you mean -- could you rephrase that more specifically?"
    );
  }
  return newMessage("assistant", buildProposalExplanation(body.operations), {
    operations: body.operations,
    status: "proposed",
  });
}

function buildUndoProposal(lastApplied: LastApplied | null): ChatMessage {
  if (!lastApplied) {
    return newMessage("assistant", "There's nothing to undo yet.");
  }
  const inverse = invertOperations(lastApplied.operations, lastApplied.refMap);
  if (inverse.length === 0) {
    return newMessage("assistant", "The most recent change can't be automatically undone.");
  }
  return newMessage("assistant", `Undo: ${buildProposalExplanation(inverse)}`, {
    operations: inverse,
    status: "proposed",
  });
}

async function fetchKinds(cache: RefObject<KindEntry[]>): Promise<KindEntry[]> {
  if (cache.current.length > 0) return cache.current;
  const res = await fetch("/api/ontology/types");
  if (!res.ok) return [];
  const body = (await res.json()) as { kinds: KindEntry[] };
  cache.current = body.kinds;
  return body.kinds;
}

interface UseCeChatActionsArgs {
  append: (message: ChatMessage) => void;
  messages: ChatMessage[];
  pendingOperations: Op[] | null;
  setPendingOperations: (operations: Op[] | null) => void;
  lastSourceTextRef: RefObject<string | undefined>;
  lastAppliedRef: RefObject<LastApplied | null>;
  kindsCacheRef: RefObject<KindEntry[]>;
}

/** TASK-006 E11-S1/E11-S3 keyword-routed chat commands, split out of
 * `useCeChat` to keep every function under the complexity budget
 * (Law E, function <=50 lines) -- the actual fetch/compute logic lives in
 * the plain functions above; these are thin `useCallback` wrappers.
 */
export function useCeChatActions({
  append,
  messages,
  pendingOperations,
  setPendingOperations,
  lastSourceTextRef,
  lastAppliedRef,
  kindsCacheRef,
}: UseCeChatActionsArgs) {
  const handleParse = useCallback(
    async (text: string) => {
      lastSourceTextRef.current = text;
      const message = await parseIntent(text);
      if (message.operations) setPendingOperations(message.operations);
      append(message);
    },
    [append, setPendingOperations, lastSourceTextRef]
  );

  const handleUndo = useCallback(() => {
    const message = buildUndoProposal(lastAppliedRef.current);
    if (message.operations) setPendingOperations(message.operations);
    append(message);
  }, [append, setPendingOperations, lastAppliedRef]);

  const handleWhy = useCallback(() => {
    const lastProposal = [...messages].reverse().find((m) => m.operations && m.role === "assistant");
    const ops = lastProposal?.operations ?? pendingOperations ?? [];
    append(newMessage("assistant", buildWhyExplanation(lastSourceTextRef.current, ops)));
  }, [append, messages, pendingOperations, lastSourceTextRef]);

  const handleConsequences = useCallback(async () => {
    const kinds = await fetchKinds(kindsCacheRef);
    append(newMessage("assistant", buildConsequencesExplanation(pendingOperations ?? [], kinds)));
  }, [append, pendingOperations, kindsCacheRef]);

  return { handleParse, handleUndo, handleWhy, handleConsequences };
}
