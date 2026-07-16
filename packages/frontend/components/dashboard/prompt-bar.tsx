"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { StreamStatus } from "@/components/dashboard/stream-status";
import type { ComponentType } from "@/components/dashboard/types";

import type { WidgetStreamState } from "@/lib/dashboard/use-widget-stream";
import { useWidgetStream } from "@/lib/dashboard/use-widget-stream";

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

function PromptBarInput({
  prompt,
  onPromptChange,
  onSubmit,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-[var(--space-2)]">
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
      <Button type="submit" disabled={!prompt.trim()}>
        Generate
      </Button>
    </form>
  );
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
  componentType,
  onComponentTypeChange,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showExamples: boolean;
  examplePrompts: ExamplePromptsResponse | null;
  onExampleSelect: (example: string) => void;
  state: WidgetStreamState;
  onRetry: () => void;
  componentType: ComponentType | null;
  onComponentTypeChange: (componentType: ComponentType) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generate a dashboard widget"
      className="fixed left-1/2 top-[20vh] w-full max-w-[560px] -translate-x-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-overlay)]"
    >
      <PromptBarInput prompt={prompt} onPromptChange={onPromptChange} onSubmit={onSubmit} />

      {showExamples && examplePrompts && (
        <ExamplePromptList prompts={examplePrompts.prompts} onSelect={onExampleSelect} />
      )}

      <div className="mt-[var(--space-3)]" aria-live="polite">
        <StreamStatus
          state={state}
          onRetry={onRetry}
          componentType={componentType}
          onComponentTypeChange={onComponentTypeChange}
        />
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
/** Owns all prompt-bar state/handlers so `PromptBar` itself stays a thin
 * render (Law E: functions <= 50 lines).
 */
function usePromptBarState(generatedCount: number, onWidgetGenerated?: () => void) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [componentType, setComponentType] = useState<ComponentType | null>(null);
  const { state, generate } = useWidgetStream();
  const examplePrompts = useExamplePrompts(open);

  useEffect(() => {
    if (state.status === "done") onWidgetGenerated?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onWidgetGenerated identity isn't the trigger, state.status is
  }, [state.status]);

  useCmdKToggle(setOpen);

  // AC-5: a fresh generation starts with no change-viz override -- the
  // streamed spec's own component_type is the starting point again.
  function startGenerate(text: string) {
    setComponentType(null);
    generate(text);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prompt.trim()) startGenerate(prompt.trim());
  }

  function handleExampleSelect(example: string) {
    setPrompt(example);
    startGenerate(example);
  }

  const showExamples =
    prompt.length === 0 &&
    state.status === "idle" &&
    examplePrompts !== null &&
    generatedCount < examplePrompts.hide_after;

  return {
    open,
    setOpen,
    prompt,
    setPrompt,
    componentType,
    setComponentType,
    state,
    examplePrompts,
    showExamples,
    handleSubmit,
    handleExampleSelect,
    onRetry: () => startGenerate(prompt.trim()),
  };
}

export function PromptBar({
  generatedCount,
  onWidgetGenerated,
}: {
  generatedCount: number;
  onWidgetGenerated?: () => void;
}) {
  const {
    open,
    setOpen,
    prompt,
    setPrompt,
    componentType,
    setComponentType,
    state,
    examplePrompts,
    showExamples,
    handleSubmit,
    handleExampleSelect,
    onRetry,
  } = usePromptBarState(generatedCount, onWidgetGenerated);

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
          onRetry={onRetry}
          componentType={componentType}
          onComponentTypeChange={setComponentType}
        />
      )}
    </>
  );
}
