"use client";

import { useState } from "react";

import { RequestForm, type TypeaheadResult } from "@/components/templates/RequestForm";
import { Card, CardContent } from "@/components/ui/card";

import { type BuildRequest, type RunMode, useRequestStatus } from "./use-request-status";

function StatusCard({ request }: { request: BuildRequest }) {
  return (
    <Card>
      {/* Plain text, not CardTitle -- same axe heading-order trap as
       * billing/page.tsx (the page's only heading is its own h1). */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Request {request.request_id}
        {request.name ? ` — ${request.name}` : ""}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p data-testid="request-status">Status: {request.status}</p>
        {request.target_repo_name && (
          <p data-testid="request-target-repo">Target repo: {request.target_repo_name}</p>
        )}
        {request.grounding_entity_iris && request.grounding_entity_iris.length > 0 && (
          <ul data-testid="request-grounding-entities" aria-label="Grounding entities">
            {request.grounding_entity_iris.map((iri) => (
              <li key={iri} className="text-[length:var(--text-mono-sm)] font-[var(--font-mono)]">
                {iri}
              </li>
            ))}
          </ul>
        )}
        {request.draft_content && (
          <pre
            data-testid="draft-content"
            className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
          >
            {JSON.stringify(request.draft_content, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

async function fetchTypeahead(q: string): Promise<TypeaheadResult[]> {
  if (!q.trim()) {
    return [];
  }
  const res = await fetch(`/api/ontology/entities/typeahead?q=${encodeURIComponent(q)}`);
  if (!res.ok) {
    return [];
  }
  const body = (await res.json()) as { results: TypeaheadResult[] };
  return body.results;
}

/** Build engine M1: the "Request application" form. Submits a prompt to the
 * dark-factory loop via `POST /api/requests` and polls the created request
 * until it leaves the "drafting" status, rendering the draft content when
 * the backend produces it.
 *
 * TASK-024 (F-D20): adds the request name, grounding-entity picker, and
 * target repo name fields, plus a fuller visible request record. Field
 * markup lives in `components/organisms/RequestForm` (atomic-design
 * boundary) -- this container owns state + data-fetching only.
 */
export default function BuildPage() {
  const { request, submitting, error, submit } = useRequestStatus();
  const [prompt, setPrompt] = useState("");
  const [runMode, setRunMode] = useState<RunMode>("draft_spec_only");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [targetRepoName, setTargetRepoName] = useState("");
  const [entityQuery, setEntityQuery] = useState("");
  const [entityResults, setEntityResults] = useState<TypeaheadResult[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<TypeaheadResult[]>([]);

  const requiresRepoName = runMode !== "draft_spec_only";
  const canSubmit = Boolean(
    prompt.trim() && name.trim() && (!requiresRepoName || targetRepoName.trim()) && !submitting
  );

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Request application
      </h1>

      <RequestForm
        name={name}
        onNameChange={setName}
        prompt={prompt}
        onPromptChange={setPrompt}
        runMode={runMode}
        onRunModeChange={setRunMode}
        requiresRepoName={requiresRepoName}
        targetRepoName={targetRepoName}
        onTargetRepoNameChange={setTargetRepoName}
        entityQuery={entityQuery}
        onEntityQueryChange={(q) => {
          setEntityQuery(q);
          fetchTypeahead(q)
            .then(setEntityResults)
            .catch(() => setEntityResults([]));
        }}
        entityResults={entityResults}
        selectedEntities={selectedEntities}
        onEntitySelect={(entity) => {
          setSelectedEntities((prev) => [...prev, entity]);
          setEntityQuery("");
          setEntityResults([]);
        }}
        onEntityRemove={(iri) =>
          setSelectedEntities((prev) => prev.filter((entity) => entity.iri !== iri))
        }
        description={description}
        onDescriptionChange={setDescription}
        submitting={submitting}
        canSubmit={canSubmit}
        onSubmit={() =>
          submit(prompt, runMode, description, {
            name,
            groundingEntityIris: selectedEntities.map((e) => e.iri),
            targetRepoName,
          })
        }
      />

      {error && (
        <p data-testid="request-error" role="alert" className="text-[var(--color-text-muted)]">
          {error}
        </p>
      )}

      {request && <StatusCard request={request} />}
    </main>
  );
}
