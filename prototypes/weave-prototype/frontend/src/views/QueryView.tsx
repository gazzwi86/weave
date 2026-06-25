import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { SparqlResult } from '../types';

interface Props {
  projectId: string;
}

const EXAMPLE_QUERIES = [
  {
    label: 'All concepts',
    query: 'SELECT ?id ?label WHERE {\n  ?id a skos:Concept ;\n     rdfs:label ?label .\n} ORDER BY ?label',
  },
  {
    label: 'Systems and domains',
    query: 'SELECT ?sys ?sysLabel ?dom ?domLabel WHERE {\n  ?sys a weave:System ;\n       rdfs:label ?sysLabel .\n  OPTIONAL { ?sys weave:inDomain ?dom . ?dom rdfs:label ?domLabel . }\n} ORDER BY ?sysLabel',
  },
  {
    label: 'All relationships',
    query: 'SELECT ?source ?pred ?target WHERE {\n  ?source ?pred ?target .\n  FILTER(?pred != rdf:type && ?pred != rdfs:label)\n} LIMIT 50',
  },
];

/** SPARQL query screen with natural-language and direct query modes. */
export default function QueryView({ projectId }: Props) {
  const [mode, setMode] = useState<'sparql' | 'nl'>('nl');
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0].query);
  const [nlQuestion, setNlQuestion] = useState('');
  const [results, setResults] = useState<SparqlResult | null>(null);
  const [generatedQuery, setGeneratedQuery] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sparqlMutation = useMutation({
    mutationFn: (q: string) => api.sparqlQuery(projectId, q),
    onSuccess: (data) => { setResults(data); setError(null); },
    onError: (e: Error) => { setError(e.message); setResults(null); },
  });

  const nlMutation = useMutation({
    mutationFn: (question: string) => api.sparqlNl(projectId, question),
    onSuccess: (data) => {
      setResults(data);
      setError(null);
      if (data.generated_sparql) setGeneratedQuery(data.generated_sparql);
    },
    onError: (e: Error) => { setError(e.message); setResults(null); },
  });

  function runSparql() {
    setGeneratedQuery(null);
    sparqlMutation.mutate(query);
  }

  function runNl() {
    setGeneratedQuery(null);
    nlMutation.mutate(nlQuestion);
  }

  const isPending = sparqlMutation.isPending || nlMutation.isPending;

  return (
    <div className="view">
      <div className="panel query-panel">
        <div className="panel-header">
          <div>
            <h2>Query</h2>
            <p className="muted">
              Explore the ontology with SPARQL or natural language.
            </p>
          </div>
        </div>

        <div className="query-mode-tabs">
          <button
            className={`query-mode-tab${mode === 'sparql' ? ' active' : ''}`}
            onClick={() => setMode('sparql')}
          >
            SPARQL
          </button>
          <button
            className={`query-mode-tab${mode === 'nl' ? ' active' : ''}`}
            onClick={() => setMode('nl')}
          >
            Natural language
          </button>
        </div>

        {mode === 'sparql' ? (
          <div className="query-input-area">
            <div className="query-examples">
              {EXAMPLE_QUERIES.map((ex) => (
                <button
                  key={ex.label}
                  className="btn btn-sm"
                  onClick={() => setQuery(ex.query)}
                >
                  {ex.label}
                </button>
              ))}
            </div>
            <textarea
              className="query-editor"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder="SELECT …"
              aria-label="SPARQL query"
            />
            <button className="btn btn-primary" onClick={runSparql} disabled={isPending || !query.trim()}>
              {sparqlMutation.isPending ? 'Running…' : 'Run query'}
            </button>
          </div>
        ) : (
          <div className="query-input-area">
            <p className="muted">
              Ask a question in plain English. Claude will generate and run the SPARQL for you.
            </p>
            <textarea
              className="query-editor"
              value={nlQuestion}
              onChange={(e) => setNlQuestion(e.target.value)}
              rows={3}
              placeholder="e.g. Which systems depend on the Billing service?"
              aria-label="Natural language question"
            />
            <button className="btn btn-primary" onClick={runNl} disabled={isPending || !nlQuestion.trim()}>
              {nlMutation.isPending ? 'Generating…' : 'Ask'}
            </button>
            {generatedQuery && (
              <details className="query-generated">
                <summary>Generated SPARQL</summary>
                <pre className="query-pre">{generatedQuery}</pre>
              </details>
            )}
          </div>
        )}

        {error && (
          <div className="query-error" role="alert">
            {error}
          </div>
        )}

        {results && <QueryResults results={results} />}
      </div>
    </div>
  );
}

function QueryResults({ results }: { results: SparqlResult }) {
  if (results.columns.length === 0 || results.rows.length === 0) {
    return <p className="muted query-empty">No results.</p>;
  }
  return (
    <div className="query-results">
      <p className="query-count">{results.rows.length} row{results.rows.length !== 1 ? 's' : ''}</p>
      <div className="query-table-wrap">
        <table className="query-table">
          <thead>
            <tr>
              {results.columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, i) => (
              <tr key={i}>
                {results.columns.map((col) => (
                  <td key={col} title={row[col] ?? ''}>
                    {row[col] ?? <span className="subtle">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
