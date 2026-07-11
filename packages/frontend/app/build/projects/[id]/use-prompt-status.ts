import { useCallback, useEffect, useState } from "react";

const POLL_INTERVAL_MS = 2_000;
// ponytail: same fixed ~5-minute cap as use-request-status.ts's MAX_POLLS.
const MAX_POLLS = 150;
const TERMINAL_PHASES = new Set(["done", "halted"]);

export interface PromptRunState {
  runId: string | null;
  phase: string | null;
  submitting: boolean;
  error: string | null;
  submit: (promptText: string) => Promise<void>;
}

async function submitErrorMessage(res: Response): Promise<string> {
  if (res.status === 403) return "Only editors and admins can submit a prompt.";
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as { field?: string } | null;
    const field = body?.field;
    return field
      ? `Invalid value for "${field}" — check the prompt and try again.`
      : "Invalid prompt — check the text and try again.";
  }
  return "Unable to submit the prompt — try again shortly.";
}

/** BE-V1-TASK-021 (FR-065 AC-4): polls the existing run-status channel
 * (`GET /api/build/projects/{id}/state`, proxying `/api/state/{project_iri}`)
 * while a prompt run is in flight -- split out to keep `usePromptStatus`
 * under the function-length budget, same shape as `useStatusPolling` in
 * `request/use-request-status.ts`. */
function useRunPhasePolling(
  projectId: string,
  runId: string | null,
  phase: string | null,
  setPhase: (phase: string) => void
): void {
  const pollingRunId = runId && !TERMINAL_PHASES.has(phase ?? "") ? runId : null;

  useEffect(() => {
    if (!pollingRunId) return;
    let stopped = false;
    let polls = 0;
    const interval = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      fetch(`/api/build/projects/${projectId}/state`)
        .then((res) => (res.ok ? (res.json() as Promise<{ phase: string }>) : null))
        .then((body) => {
          if (stopped || !body) return;
          setPhase(body.phase);
          if (TERMINAL_PHASES.has(body.phase)) clearInterval(interval);
        })
        .catch(() => clearInterval(interval));
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [projectId, pollingRunId, setPhase]);
}

/** Drives the Dashboard's direct-project-prompt box: submits to
 * `POST /api/build/projects/{id}/prompts`, then polls the run's phase
 * until it reaches a terminal state (AC-1/AC-4). */
export function usePromptStatus(projectId: string): PromptRunState {
  const [runId, setRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (promptText: string) => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(`/api/build/projects/${projectId}/prompts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt_text: promptText }),
        });
        if (res.status !== 202) {
          setError(await submitErrorMessage(res));
          return;
        }
        const body = (await res.json()) as { run_id: string; prompt_id: string };
        setRunId(body.run_id);
        setPhase("queued");
      } catch {
        setError("Unable to submit the prompt — try again shortly.");
      } finally {
        setSubmitting(false);
      }
    },
    [projectId]
  );

  useRunPhasePolling(projectId, runId, phase, setPhase);

  return { runId, phase, submitting, error, submit };
}
