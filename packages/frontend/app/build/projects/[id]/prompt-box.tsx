"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { usePromptStatus } from "./use-prompt-status";

const FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

/** Run status + error region, split out to keep `PromptBox` under the
 * function-length budget (Law E). */
function PromptRunFeedback({
  error,
  runId,
  phase,
}: {
  error: string | null;
  runId: string | null;
  phase: string | null;
}): React.JSX.Element {
  return (
    <>
      {error && (
        <p role="alert" className="text-[var(--color-status-danger)]">
          {error}
        </p>
      )}
      {runId && (
        <p data-testid="prompt-run-status">
          Run {runId}: {phase}
        </p>
      )}
    </>
  );
}

/** BE-V1-TASK-021 (FR-065): the Dashboard's direct-project-prompt box.
 * Visible to everyone (UX mirror, Design Decisions table) but disabled
 * with an explanatory tooltip for readers -- the server 403 is the real
 * boundary (AC-2), this only shapes discoverability. Text-only input,
 * no mic/voice affordance (Implementation Hints -- do not reintroduce). */
export function PromptBox({
  projectId,
  canPrompt,
}: {
  projectId: string;
  canPrompt: boolean;
}): React.JSX.Element {
  const [text, setText] = useState("");
  const { runId, phase, submitting, error, submit } = usePromptStatus(projectId);

  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <label
          htmlFor="dashboard-prompt"
          className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
        >
          Prompt
        </label>
        <textarea
          id="dashboard-prompt"
          aria-label="Prompt"
          rows={3}
          value={text}
          disabled={!canPrompt || submitting}
          title={canPrompt ? undefined : "Only editors and admins can submit a prompt."}
          onChange={(e) => setText(e.target.value)}
          className={FIELD_CLASS}
        />
        {!canPrompt && (
          <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
            Only editors and admins can submit a prompt.
          </p>
        )}
        <Button
          type="button"
          disabled={!canPrompt || submitting || !text.trim()}
          onClick={() => submit(text)}
        >
          Submit prompt
        </Button>
        <PromptRunFeedback error={error} runId={runId} phase={phase} />
      </CardContent>
    </Card>
  );
}
