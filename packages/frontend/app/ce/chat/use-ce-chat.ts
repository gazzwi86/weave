"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useCeChatActions } from "./use-ce-chat-actions";
import { loadHistory, saveHistory } from "./storage";
import type { ChatMessage, KindEntry, Op } from "./types";

interface LastApplied {
  operations: Op[];
  refMap: Record<string, string>;
}

interface ApplyResponseBody {
  ref_map?: Record<string, string>;
  violations?: { message: string }[];
}

export interface UseCeChatResult {
  messages: ChatMessage[];
  pendingOperations: Op[] | null;
  busy: boolean;
  sendMessage: (text: string) => Promise<void>;
  confirm: () => Promise<void>;
  reject: () => void;
}

function newMessage(
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return { id: crypto.randomUUID(), role, text, ...extra };
}

/** Messages state + localStorage persistence, split out to keep
 * `useCeChat`'s own body under the Law E function-length budget.
 */
function useChatMessages(): [ChatMessage[], (message: ChatMessage) => void] {
  // History hydrates AFTER mount: reading localStorage inside the useState
  // initialiser makes the client's first render differ from the SSR HTML
  // (React hydration mismatch). `hydrated` also gates the save effect so
  // the initial empty render can't wipe the stored history.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // SSR hydration: localStorage is browser-only, so history loads post-mount
    // (reading it in the useState initialiser would diverge from the SSR HTML).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  return [messages, append];
}

function routeCommand(
  text: string,
  actions: ReturnType<typeof useCeChatActions>
): Promise<void> | void {
  if (/^undo\b/i.test(text)) return actions.handleUndo();
  if (/^why\??$/i.test(text)) return actions.handleWhy();
  if (/^(consequences|what happens|what are the consequences)\??$/i.test(text)) {
    return actions.handleConsequences();
  }
  return actions.handleParse(text);
}

/** TASK-006 AC-006-03: dispatches the confirmed batch to CE-WRITE-1 and
 * turns its 201/422 response into the chat message to append.
 */
async function applyPending(operations: Op[]): Promise<{ message: ChatMessage; applied: LastApplied | null }> {
  const res = await fetch("/api/operations/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations }),
  });
  const body = (await res.json()) as ApplyResponseBody;
  if (res.status === 201) {
    const refMap = body.ref_map ?? {};
    const iri = Object.values(refMap)[0];
    const message = newMessage("assistant", iri ? `Done -- created ${iri}.` : "Done.", {
      resultIri: iri,
      status: "confirmed",
    });
    return { message, applied: { operations, refMap } };
  }
  const reasons = body.violations?.map((v) => v.message).join(" ") ?? "That change was rejected.";
  return { message: newMessage("assistant", reasons), applied: null };
}

/** TASK-006 E11-S1/E11-S3: chat state machine -- `{pending_operations,
 * conversation_history}` per the task brief's implementation hints.
 * Nothing reaches CE-WRITE-1 until `confirm()` is called explicitly.
 */
export function useCeChat(): UseCeChatResult {
  const [messages, append] = useChatMessages();
  const [pendingOperations, setPendingOperations] = useState<Op[] | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSourceTextRef = useRef<string | undefined>(undefined);
  const lastAppliedRef = useRef<LastApplied | null>(null);
  const kindsCacheRef = useRef<KindEntry[]>([]);

  const actions = useCeChatActions({
    append,
    messages,
    pendingOperations,
    setPendingOperations,
    lastSourceTextRef,
    lastAppliedRef,
    kindsCacheRef,
  });

  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;
      append(newMessage("user", text));
      setBusy(true);
      try {
        await routeCommand(text, actions);
      } finally {
        setBusy(false);
      }
    },
    [busy, append, actions]
  );

  const confirm = useCallback(async () => {
    if (!pendingOperations) return;
    setBusy(true);
    try {
      const { message, applied } = await applyPending(pendingOperations);
      lastAppliedRef.current = applied ?? lastAppliedRef.current;
      append(message);
    } finally {
      setPendingOperations(null);
      setBusy(false);
    }
  }, [pendingOperations, append]);

  const reject = useCallback(() => {
    setPendingOperations(null);
    append(newMessage("assistant", "Okay, discarded."));
  }, [append]);

  return { messages, pendingOperations, busy, sendMessage, confirm, reject };
}
