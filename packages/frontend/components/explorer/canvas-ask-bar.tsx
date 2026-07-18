"use client";

import { useAskLifecycle } from "@/app/ce/query/use-ask-lifecycle";
import { AskBar } from "@/components/molecules/AskBar";
import { toAskAnswerView } from "@/lib/explorer/ask-view";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

export interface CanvasAskBarProps {
  adapter: RendererAdapter;
}

// refit-mock.html Explore screen's bottom-centre "Ask the model" bar --
// wired to the same useAskLifecycle hook /ce/query uses (POST
// /api/query/nl), not a new backend call. Feedback is a single grounded
// sentence (ask-view.ts's existing mapper); a full canvas answer overlay
// (entity chips on nodes, SPARQL disclosure) is the separate de-hairball task.
export function CanvasAskBar({ adapter }: CanvasAskBarProps) {
  const ask = useAskLifecycle();
  const feedback =
    ask.status === "success" && ask.result
      ? toAskAnswerView(ask.result, ask.question, adapter.getNodeData).sentence
      : ask.errorMessage;

  return (
    <div className="absolute bottom-[var(--space-6)] left-1/2 z-[var(--z-panel)] w-full max-w-xl -translate-x-1/2 px-[var(--space-4)]">
      <AskBar
        placeholder="Ask the model — what depends on Orders DB?"
        value={ask.question}
        loading={ask.status === "submitting"}
        onChange={ask.setQuestion}
        onSubmit={ask.ask}
      />
      {feedback && (
        <p
          role="status"
          className="mt-[var(--space-2)] text-center text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]"
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
