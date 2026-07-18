import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export interface ThreadMessage {
  role: "user" | "ai";
  content: ReactNode;
}

/** refit-mock.html `#sub-bld-studio` `.thread` -- message bubbles. The
 * backend has no multi-turn conversation state (each refine is a fresh
 * `POST /api/requests`, see `page.tsx`), so the AI side only ever carries
 * the *current* request's live status/reason -- older turns keep whatever
 * their final AI content was at the moment they were superseded. */
export function Thread({ messages }: { messages: ThreadMessage[] }): React.JSX.Element {
  return (
    <div data-testid="thread" className="flex flex-col gap-[var(--space-2)]">
      {messages.map((message, i) => (
        <Card
          key={i}
          className={
            message.role === "user"
              ? "ml-auto max-w-[80%] bg-[var(--color-accent-soft)]"
              : "mr-auto max-w-[80%] flex flex-col gap-[var(--space-1)]"
          }
        >
          {message.content}
        </Card>
      ))}
    </div>
  );
}
