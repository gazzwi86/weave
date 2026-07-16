import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
} from "react";

export type RunMode = "draft_spec_only" | "spec_to_build" | "spike";

export interface BuildRequest {
  request_id: string;
  status: string;
  draft_content: Record<string, unknown> | null;
  name?: string;
  grounding_entity_iris?: string[];
  target_repo_name?: string | null;
  stream_url?: string;
  reason?: string | null;
}

/** TASK-024: fields the form collects beyond prompt/run_mode/description. */
export interface RequestFormExtras {
  name: string;
  groundingEntityIris: string[];
  targetRepoName: string;
}

export interface RequestStatusState {
  request: BuildRequest | null;
  submitting: boolean;
  error: string | null;
  submit: (
    prompt: string,
    runMode: RunMode,
    description: string,
    extras: RequestFormExtras
  ) => Promise<void>;
}

const POLL_INTERVAL_MS = 2_000;
// ponytail: fixed ~5-minute cap (150 polls x 2s); make it configurable only
// if a run mode ever legitimately drafts for longer.
const MAX_POLLS = 150;

async function submitErrorMessage(res: Response): Promise<string> {
  if (res.status === 503) {
    return "The model provider is unavailable — try again shortly.";
  }
  if (res.status === 422) {
    const body = (await res.json().catch(() => null)) as {
      detail?: { field?: string };
    } | null;
    const field = body?.detail?.field;
    return field
      ? `Invalid value for "${field}" — check the form and try again.`
      : "Invalid request — check the form and try again.";
  }
  return "Unable to submit the request — try again shortly.";
}

/** Polls `GET /api/requests/{id}` every 2s while the request is drafting.
 * Stops on a terminal status (anything other than "drafting"), on a fetch
 * error, or after ~5 minutes. Split out of `useRequestStatus` to keep each
 * hook under the function length budget (Law E).
 */
function useStatusPolling(
  request: BuildRequest | null,
  setRequest: Dispatch<SetStateAction<BuildRequest | null>>
): void {
  const requestId = request?.status === "drafting" ? request.request_id : null;

  useEffect(() => {
    if (!requestId) {
      return;
    }
    let stopped = false;
    let polls = 0;
    const interval = setInterval(() => {
      polls += 1;
      if (polls > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      fetch(`/api/requests/${encodeURIComponent(requestId)}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error("poll_failed");
          }
          return res.json() as Promise<BuildRequest>;
        })
        .then((body) => {
          if (stopped) {
            return;
          }
          setRequest(body);
          if (body.status !== "drafting") {
            clearInterval(interval);
          }
        })
        .catch(() => clearInterval(interval));
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [requestId, setRequest]);
}

/** Drives the Build engine's "Request application" form: submits the prompt
 * to `POST /api/requests`, then polls the created request until it leaves
 * the "drafting" status.
 */
export function useRequestStatus(): RequestStatusState {
  const [request, setRequest] = useState<BuildRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (prompt: string, runMode: RunMode, description: string, extras: RequestFormExtras) => {
      setSubmitting(true);
      setError(null);
      setRequest(null);
      try {
        const res = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            run_mode: runMode,
            name: extras.name,
            grounding_entity_iris: extras.groundingEntityIris,
            ...(description ? { description } : {}),
            ...(extras.targetRepoName ? { target_repo_name: extras.targetRepoName } : {}),
          }),
        });
        if (res.status !== 202) {
          setError(await submitErrorMessage(res));
          return;
        }
        const body = (await res.json()) as {
          request_id: string;
          status: string;
          stream_url?: string;
        };
        setRequest({
          request_id: body.request_id,
          status: body.status,
          draft_content: null,
          stream_url: body.stream_url,
        });
      } catch {
        setError("Unable to submit the request — try again shortly.");
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  useStatusPolling(request, setRequest);

  return { request, submitting, error, submit };
}
