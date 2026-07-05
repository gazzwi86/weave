import { useCallback, useState } from "react";

import type { QueryResult } from "./types";

interface NlQueryResponse {
  sparql_generated: string;
  rows: Record<string, string>[];
  column_names: string[];
  explanation?: string | null;
}

interface NlErrorBody {
  error: string;
  nl_question?: string;
  clause?: string;
}

export interface NlQueryState {
  question: string;
  setQuestion: (question: string) => void;
  asking: boolean;
  result: QueryResult | null;
  sparqlGenerated: string | null;
  explanation: string | null;
  errorCode: string | null;
  ask: () => Promise<void>;
}

/** CE-TASK-007 AC-007-01/-04/-05/-06/-08: submits a natural-language
 * question to `/api/query/nl` and exposes the model's generated SPARQL
 * (AC-007-06's transparency requirement), the result rows, and any
 * unanswerable-question explanation (AC-007-04).
 */
export function useNlQuery(): NlQueryState {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [sparqlGenerated, setSparqlGenerated] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const ask = useCallback(async () => {
    setAsking(true);
    setErrorCode(null);
    try {
      const res = await fetch("/api/query/nl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const body = (await res.json()) as NlErrorBody;
        setErrorCode(body.error);
        setResult(null);
        setSparqlGenerated(null);
        setExplanation(null);
        return;
      }
      const body = (await res.json()) as NlQueryResponse;
      setSparqlGenerated(body.sparql_generated);
      setExplanation(body.explanation ?? null);
      setResult({ columnNames: body.column_names, rows: body.rows });
    } catch {
      setErrorCode("upstream_unavailable");
    } finally {
      setAsking(false);
    }
  }, [question]);

  return { question, setQuestion, asking, result, sparqlGenerated, explanation, errorCode, ask };
}
