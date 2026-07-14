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

/** TASK-031 AC-8: quick-start template chips -- one click sends the
 * template text through the unchanged `sendMessage` mechanics.
 */
function QuickStartChips({
  templates,
  onPick,
  disabled,
}: {
  templates: string[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-[var(--space-2)]">
      {templates.map((template) => (
        <Button key={template} type="button" variant="secondary" disabled={disabled} onClick={() => onPick(template)}>
          {template}
        </Button>
      ))}
    </div>
  );
}

export interface ChatPanelProps {
  /** AC-8: quick-start template chips rendered above the message list. */
  quickStartTemplates?: string[];
  /** AC-8: shows a clear-history action that resets the conversation. */
  showClearHistory?: boolean;
}

/** AC-8's header row -- quick-start chips + clear-history, split out to
 * keep `ChatPanel` under the Law E function-length budget.
 */
function ChatPanelHeader({
  quickStartTemplates,
  showClearHistory,
  onPickTemplate,
  onClearHistory,
  busy,
}: ChatPanelProps & { onPickTemplate: (text: string) => void; onClearHistory: () => void; busy: boolean }) {
  if (!quickStartTemplates && !showClearHistory) return null;
  return (
    <div className="flex items-start justify-between gap-[var(--space-2)]">
      {quickStartTemplates && (
        <QuickStartChips templates={quickStartTemplates} onPick={onPickTemplate} disabled={busy} />
      )}
      {showClearHistory && (
        <Button type="button" variant="secondary" onClick={onClearHistory}>
          Clear history
        </Button>
      )}
    </div>
  );
}

/** TASK-006 E11-S1: persistent chat panel (AC-006-01) -- propose, confirm/
 * reject, ambiguity as a clarifying question, IRI links, all backed by
 * `useCeChat`'s state machine. TASK-031 AC-8 adds optional quick-start
 * chips and a clear-history action for the glass chat aside.
 */
export function ChatPanel({ quickStartTemplates, showClearHistory }: ChatPanelProps = {}) {
  const { messages, pendingOperations, busy, sendMessage, confirm, reject, clearHistory } = useCeChat();
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
      <ChatPanelHeader
        quickStartTemplates={quickStartTemplates}
        showClearHistory={showClearHistory}
        onPickTemplate={(text) => void sendMessage(text)}
        onClearHistory={clearHistory}
        busy={busy}
      />

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
