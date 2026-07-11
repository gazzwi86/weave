import { useCallback, useState } from "react";

import { bindingsToRows, type QueryResult } from "./types";

interface SparqlQueryApiResponse {
  head: { vars?: string[] };
  results: { bindings: Record<string, { value: string }>[] };
}

interface SparqlPatternApiResponse {
  column_names: string[];
  rows: Record<string, string>[];
  message?: string;
}

type SparqlApiResponse = SparqlQueryApiResponse | SparqlPatternApiResponse;

function isPatternResponse(body: SparqlApiResponse): body is SparqlPatternApiResponse {
  return "rows" in body;
}

function toQueryResult(body: SparqlApiResponse): QueryResult {
  if (isPatternResponse(body)) {
    return { columnNames: body.column_names, rows: body.rows, message: body.message };
  }
  const columnNames = body.head.vars ?? [];
  return { columnNames, rows: bindingsToRows(body.results.bindings, columnNames) };
}

interface ExplainState {
  explanation: string | null;
  explaining: boolean;
  explainQuery: (sparql: string) => Promise<void>;
}

/** AC-007-14: the on-demand "Explain this query" call -- split out of
 * `useSparqlEditor` to keep it under the per-function line budget (Law E).
 */
function useExplainQuery(): ExplainState {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  const explainQuery = useCallback(async (sparql: string) => {
    setExplaining(true);
    try {
      const res = await fetch("/api/query/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sparql }),
      });
      if (res.ok) {
        const body = (await res.json()) as { explanation: string };
        setExplanation(body.explanation);
      }
    } finally {
      setExplaining(false);
    }
  }, []);

  return { explanation, explaining, explainQuery };
}

export interface SparqlEditorState {
  queryText: string;
  setQueryText: (text: string) => void;
  version: string;
  setVersion: (version: string) => void;
  running: boolean;
  result: QueryResult | null;
  /** CE-V1-TASK-032 AC-6: the exact executed query text, kept alongside
   * `result` so "View SPARQL" is available identically for hand-typed runs
   * (which carry no NL grounding, unlike the ask lifecycle's result). */
  executedSparql: string | null;
  errorCode: string | null;
  runQuery: () => Promise<void>;
  runPattern: (pattern: string) => Promise<void>;
  explanation: string | null;
  explaining: boolean;
  explainQuery: () => Promise<void>;
}

interface ExecuteCallbacks {
  onResult: (result: QueryResult, sparqlText: string | null) => void;
  onError: (code: string) => void;
}

/** The fetch + response-shape body of `execute()` -- a free function (not a
 * hook) so `useSparqlEditor` stays under the per-function line budget
 * (Law E). */
async function runSparqlRequest(params: URLSearchParams, sparqlText: string | null, { onResult, onError }: ExecuteCallbacks): Promise<void> {
  try {
    const res = await fetch(`/api/sparql?${params.toString()}`);
    if (!res.ok) {
      const body = (await res.json()) as { error: string };
      onError(body.error);
      return;
    }
    onResult(toQueryResult((await res.json()) as SparqlApiResponse), sparqlText);
  } catch {
    onError("upstream_unavailable");
  }
}

/** CE-TASK-007 AC-007-09/-10/-11/-12/-13/-14: drives the editor's "Run"
 * action (raw `query=`, sanitised + version-pinned server-side), the
 * coverage_gap report's "Run" action (`pattern=`), and the on-demand
 * "Explain this query" call -- three thin fetches sharing one `GET
 * /api/sparql` result shape via `toQueryResult`.
 */
export function useSparqlEditor(): SparqlEditorState {
  const [queryText, setQueryText] = useState("");
  const [version, setVersion] = useState("latest");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executedSparql, setExecutedSparql] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const { explanation, explaining, explainQuery: explainSparql } = useExplainQuery();

  const execute = useCallback(async (params: URLSearchParams, sparqlText: string | null) => {
    setRunning(true);
    setErrorCode(null);
    await runSparqlRequest(params, sparqlText, {
      onResult: (queryResult, executed) => {
        setResult(queryResult);
        setExecutedSparql(executed);
      },
      onError: (code) => {
        setErrorCode(code);
        setResult(null);
      },
    });
    setRunning(false);
  }, []);

  const runQuery = useCallback(
    () => execute(new URLSearchParams({ query: queryText, version }), queryText),
    [execute, queryText, version]
  );
  const runPattern = useCallback(
    (pattern: string) => execute(new URLSearchParams({ pattern, version }), null),
    [execute, version]
  );

  const explainQuery = useCallback(() => explainSparql(queryText), [explainSparql, queryText]);

  return {
    queryText,
    setQueryText,
    version,
    setVersion,
    running,
    result,
    executedSparql,
    errorCode,
    runQuery,
    runPattern,
    explanation,
    explaining,
    explainQuery,
  };
}
