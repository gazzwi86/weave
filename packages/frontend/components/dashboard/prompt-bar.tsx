"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import type { WidgetStreamState } from "@/lib/dashboard/use-widget-stream";
import { useWidgetStream } from "@/lib/dashboard/use-widget-stream";

/** m2-delta.md §6: human copy for each closed SSE error state. Only
 * `provider_503` is retryable (transient); the rest name a real gate the
 * user's prompt hit, so "Try again" would just repeat the same result.
 */
const ERROR_COPY: Record<string, string> = {
  budget_cap: "Monthly generation budget reached for this workspace.",
  provider_503: "AI provider unavailable",
  source_not_ga: "That data source isn't available yet.",
  unsatisfiable: "Couldn't match that prompt to a widget shape. Try rephrasing.",
  unavailable: "Widget generation is unavailable right now.",
};

interface ExamplePromptsResponse {
  prompts: string[];
  hide_after: number;
}

/** Lazily fetches the role-scoped, GA-filtered catalogue the first time the
 * bar opens (not on every render) -- separated out purely to keep
 * `PromptBar` under the complexity/line budget.
 */
function useExamplePrompts(open: boolean): ExamplePromptsResponse | null {
  const [examplePrompts, setExamplePrompts] = useState<ExamplePromptsResponse | null>(null);

  useEffect(() => {
    if (!open || examplePrompts) return;
    fetch("/api/dashboard/example-prompts")
      .then((response) => (response.ok ? (response.json() as Promise<ExamplePromptsResponse>) : null))
      .then((body) => setExamplePrompts(body ?? { prompts: [], hide_after: 3 }))
      .catch(() => setExamplePrompts({ prompts: [], hide_after: 3 }));
  }, [open, examplePrompts]);

  return examplePrompts;
}

function ExamplePromptList({
  prompts,
  onSelect,
}: {
  prompts: string[];
  onSelect: (prompt: string) => void;
}) {
  return (
    <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
      {prompts.map((example) => (
        <li key={example}>
          <button
            type="button"
            onClick={() => onSelect(example)}
            className="w-full rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)] text-left text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-raised)]"
          >
            {example}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Renders the streaming/done/error tail of the bar -- the only part of
 * `WidgetStreamState` this component cares about (m2-delta.md §6).
 */
function StreamStatus({ state, onRetry }: { state: WidgetStreamState; onRetry: () => void }) {
  if (state.status === "streaming" || state.status === "done") {
    return (
      <div aria-busy={state.status === "streaming"}>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {state.spec.title}
        </p>
        <p
          data-testid="prompt-bar-status"
          className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"
        >
          {state.status === "streaming" ? "Generating…" : "Done"} · {state.spec.data_source_contracts[0]}
        </p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div>
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          {ERROR_COPY[state.errorState] ?? state.reason}
        </p>
        {state.errorState === "provider_503" && (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  return null;
}

/** AC-8: "Prompt bar opens with Cmd+K" -- toggles the given setter, same
 * binding shape as `CommandPalette`'s (guarded off `/dashboard` there).
 */
function useCmdKToggle(setOpen: (updater: (prev: boolean) => boolean) => void): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
}

function PromptBarDialog({
  prompt,
  onPromptChange,
  onSubmit,
  showExamples,
  examplePrompts,
  onExampleSelect,
  state,
  onRetry,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showExamples: boolean;
  examplePrompts: ExamplePromptsResponse | null;
  onExampleSelect: (example: string) => void;
  state: WidgetStreamState;
  onRetry: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generate a dashboard widget"
      className="fixed left-1/2 top-[20vh] w-full max-w-[560px] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-overlay)]"
    >
      <form onSubmit={onSubmit}>
        <label htmlFor="prompt-bar-input" className="sr-only">
          Describe the view you want
        </label>
        <input
          id="prompt-bar-input"
          autoFocus
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe the view you want…"
          className="w-full rounded-[var(--radius-base)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] outline-none focus-visible:ring-[var(--ring-focus)]"
        />
      </form>

      {showExamples && examplePrompts && (
        <ExamplePromptList prompts={examplePrompts.prompts} onSelect={onExampleSelect} />
      )}

      <div className="mt-[var(--space-3)]" aria-live="polite">
        <StreamStatus state={state} onRetry={onRetry} />
      </div>
    </div>
  );
}

/** AC-8: Cmd+K-openable prompt bar. Streams a prompt to
 * `POST /api/dashboard/widgets/generate` via `useWidgetStream` and renders
 * the spec/data/done/error states inline; example prompts (role-tailored,
 * GA-scoped -- filtered server-side) show while empty and hide once the
 * user has generated `hide_after` widgets this session.
 *
 * `generatedCount` is owned by the caller (ponytail: session-local UI
 * nicety, not a security/billing gate -- keeping it out of this component
 * avoids sessionStorage state leaking across unrelated tests).
 */
export function PromptBar({
  generatedCount,
  onWidgetGenerated,
}: {
  generatedCount: number;
  onWidgetGenerated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const { state, generate } = useWidgetStream();
  const examplePrompts = useExamplePrompts(open);

  useEffect(() => {
    if (state.status === "done") onWidgetGenerated?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onWidgetGenerated identity isn't the trigger, state.status is
  }, [state.status]);

  useCmdKToggle(setOpen);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prompt.trim()) generate(prompt.trim());
  }

  function handleExampleSelect(example: string) {
    setPrompt(example);
    generate(example);
  }

  const showExamples =
    prompt.length === 0 &&
    state.status === "idle" &&
    examplePrompts !== null &&
    generatedCount < examplePrompts.hide_after;

  return (
    <>
      <Button data-testid="prompt-bar-trigger" onClick={() => setOpen(true)}>
        Generate a widget
      </Button>
      {open && (
        <PromptBarDialog
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={handleSubmit}
          showExamples={showExamples}
          examplePrompts={examplePrompts}
          onExampleSelect={handleExampleSelect}
          state={state}
          onRetry={() => generate(prompt.trim())}
        />
      )}
    </>
  );
}
