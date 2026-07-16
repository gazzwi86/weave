"use client";

import { useCallback, useRef, useState } from "react";

/** CE-V1-TASK-032: the ask bar's explicit lifecycle -- AC-1..AC-4 require a
 * named state at every point between submit and settle, never an implicit
 * "nothing rendered" gap. */
export type AskStatus = "idle" | "submitting" | "success" | "provider-missing" | "timeout" | "error";

export interface AskResult {
  sparql: string;
  rows: Record<string, string>[];
  columnNames: string[];
  groundedIris: string[];
}

export interface AskLifecycleState {
  status: AskStatus;
  question: string;
  setQuestion: (question: string) => void;
  version: string;
  setVersion: (version: string) => void;
  result: AskResult | null;
  errorMessage: string | null;
  ask: () => Promise<void>;
  retry: () => void;
}

const NL_ERROR_MESSAGES: Record<string, string> = {
  translation_failed: "Couldn't turn that into a query -- try rephrasing.",
  prohibited_clause: "That question would require a write operation, which is not allowed.",
  service_blocked: "That question would require a federated query, which is not allowed.",
  upstream_unavailable: "Unable to reach the query service.",
};

interface NlSuccessBody {
  sparql_generated: string;
  // CE-TASK-007's `/api/query/nl` returns already-flattened rows (see its
  // E2E mock), not raw SPARQL JSON bindings -- unlike the SPARQL-editor's
  // `GET /api/sparql`, which is why `bindingsToRows` isn't needed here.
  rows: Record<string, string>[];
  column_names: string[];
  grounded_iris?: string[];
}

function toAskResult(body: NlSuccessBody): AskResult {
  return {
    sparql: body.sparql_generated,
    rows: body.rows,
    columnNames: body.column_names,
    groundedIris: body.grounded_iris ?? [],
  };
}

/** AC-2/AC-4: classifies a non-ok `/api/query/nl` response into the
 * `provider-missing` vs generic `error` lifecycle state -- a `503` (or the
 * proxy's own `upstream_unavailable`/502) is provider-missing, never the
 * generic error state. Exported for the unit test naming this rule. */
export function classifyFailureStatus(status: number): "provider-missing" | "error" {
  return status === 503 || status === 502 ? "provider-missing" : "error";
}

// R2: was 15s -- 20x shorter than the backend's OLLAMA_TIMEOUT_S=300 budget,
// so real generations got aborted and misreported as "timed out" long before
// the backend actually gave up. Set just above the backend budget so timeout
// only fires once the backend has truly failed.
// ponytail: still a flat client constant, not read from the backend -- no
// shared config surface exists yet (grepped, only OLLAMA_TIMEOUT_S server-side
// env var). Upgrade path: expose it via a response header if the two values
// ever need to drift independently.
export const DEFAULT_TIMEOUT_MS = 310000;

interface AskCallbacks {
  onStatus: (status: AskStatus) => void;
  onError: (message: string) => void;
  onResult: (result: AskResult) => void;
}

/** The fetch + timeout + response-classification body of `ask()` -- split
 * out of `useAskLifecycle` (a free function, not a hook) to keep the hook
 * under the per-function line budget (Law E). */
async function runAskRequest(
  question: string,
  version: string,
  timeoutMs: number,
  { onStatus, onError, onResult }: AskCallbacks
): Promise<void> {
  onStatus("submitting");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/query/nl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, version }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      onStatus(classifyFailureStatus(res.status));
      onError(NL_ERROR_MESSAGES[body.error ?? ""] ?? "Something went wrong answering that question.");
      return;
    }
    onResult(toAskResult((await res.json()) as NlSuccessBody));
    onStatus("success");
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      onStatus("timeout");
    } else {
      onStatus("error");
      onError("Unable to reach the query service.");
    }
  } finally {
    clearTimeout(timer);
  }
}

/** CE-V1-TASK-032 AC-1..AC-4: drives the ask bar's `POST /api/query/nl`
 * call through an explicit state machine so the UI is never in an
 * unlabelled "nothing happened yet" gap. */
export function useAskLifecycle(timeoutMs: number = DEFAULT_TIMEOUT_MS): AskLifecycleState {
  const [status, setStatus] = useState<AskStatus>("idle");
  const [question, setQuestion] = useState("");
  const [version, setVersion] = useState("latest");
  const [result, setResult] = useState<AskResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastAskedRef = useRef<{ question: string; version: string } | null>(null);

  const performAsk = useCallback(
    async (askedQuestion: string, askedVersion: string) => {
      lastAskedRef.current = { question: askedQuestion, version: askedVersion };
      setErrorMessage(null);
      await runAskRequest(askedQuestion, askedVersion, timeoutMs, {
        onStatus: setStatus,
        onError: setErrorMessage,
        onResult: setResult,
      });
    },
    [timeoutMs]
  );

  const ask = useCallback(async () => {
    if (!question.trim()) return;
    await performAsk(question, version);
  }, [performAsk, question, version]);

  const retry = useCallback(() => {
    if (!lastAskedRef.current) return;
    void performAsk(lastAskedRef.current.question, lastAskedRef.current.version);
  }, [performAsk]);

  return { status, question, setQuestion, version, setVersion, result, errorMessage, ask, retry };
}
