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
//
// G19: this wrapper has no background of its own -- its horizontal padding
// (beyond the pill) and the gap above the feedback line are transparent
// canvas, but the wrapper <div> still sits over them and would swallow a
// click meant for a cytoscape node there. It opts out of pointer events;
// only the actual ask-bar pill opts back in (the feedback text stays
// pass-through -- it's read-only, not an interactive target).
export function CanvasAskBar({ adapter }: CanvasAskBarProps) {
  const ask = useAskLifecycle();
  const feedback =
    ask.status === "success" && ask.result
      ? toAskAnswerView(ask.result, ask.question, adapter.getNodeData).sentence
      : ask.errorMessage;

  return (
    <div className="pointer-events-none absolute bottom-[var(--space-6)] left-1/2 z-[var(--z-panel)] w-full max-w-xl -translate-x-1/2 px-[var(--space-4)]">
      <AskBar
        placeholder="Ask the model — what depends on Orders DB?"
        value={ask.question}
        loading={ask.status === "submitting"}
        onChange={ask.setQuestion}
        onSubmit={ask.ask}
        className="pointer-events-auto"
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
