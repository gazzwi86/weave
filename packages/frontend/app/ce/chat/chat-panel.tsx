"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { IngestPanel } from "./ingest-panel";
import { MessageText } from "./message-text";
import { useCeChat } from "./use-ce-chat";
import type { ChatMessage } from "./types";

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li
      className={
        isUser
          ? "self-end rounded-[var(--radius-base)] bg-[var(--color-accent-primary)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-bg)]"
          : "self-start rounded-[var(--radius-base)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      }
    >
      <MessageText text={message.text} />
    </li>
  );
}

function ProposalActions({
  onConfirm,
  onReject,
  busy,
}: {
  onConfirm: () => void;
  onReject: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex gap-[var(--space-2)]">
      <Button type="button" onClick={onConfirm} disabled={busy}>
        Confirm
      </Button>
      <Button type="button" variant="secondary" onClick={onReject} disabled={busy}>
        Reject
      </Button>
    </div>
  );
}

/** TASK-006 E11-S1: persistent chat panel (AC-006-01) -- propose, confirm/
 * reject, ambiguity as a clarifying question, IRI links, all backed by
 * `useCeChat`'s state machine.
 */
export function ChatPanel() {
  const { messages, pendingOperations, busy, sendMessage, confirm, reject } = useCeChat();
  const [draft, setDraft] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim()) return;
    void sendMessage(draft);
    setDraft("");
  };

  return (
    <section
      aria-label="Constitution Engine chat"
      className="flex h-full flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <ul aria-live="polite" className="flex flex-1 flex-col gap-[var(--space-2)] overflow-y-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </ul>

      {pendingOperations !== null && (
        <ProposalActions onConfirm={() => void confirm()} onReject={reject} busy={busy} />
      )}

      <IngestPanel />

      <form onSubmit={handleSubmit} className="flex gap-[var(--space-2)]">
        <label htmlFor="ce-chat-message" className="sr-only">
          Message
        </label>
        <Input
          id="ce-chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
          placeholder="Add a Process called..."
          className="flex-1"
        />
        <Button type="submit" disabled={busy}>
          Send
        </Button>
      </form>
    </section>
  );
}
