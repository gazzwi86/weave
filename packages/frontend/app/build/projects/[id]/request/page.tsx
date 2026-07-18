"use client";

import { useState } from "react";

import { RequestForm, type TypeaheadResult } from "@/components/templates/RequestForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { PlanCard } from "./plan-card";
import { Thread, type ThreadMessage } from "./thread";
import { useDraftingProgress } from "./use-drafting-progress";
import { type BuildRequest, type RunMode, useRequestStatus } from "./use-request-status";
import { type Turn, useStudioThread } from "./use-studio-thread";

function StatusCard({ request }: { request: BuildRequest }) {
  const drafting = request.status === "drafting";
  const completedSections = useDraftingProgress(request.stream_url, drafting);

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
        {drafting && completedSections.length > 0 && (
          <p data-testid="request-progress">Drafted so far: {completedSections.join(", ")}</p>
        )}
        {request.reason && (
          <p data-testid="request-reason">{request.reason}</p>
        )}
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
      </CardContent>
    </Card>
  );
}

/** refit-mock.html `#sub-bld-studio` "Refine the plan or ask a follow-up" --
 * re-submits through the same `useRequestStatus.submit` client as the
 * initial request, adding a new thread turn. */
function RefineBox({
  value,
  onChange,
  onSend,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="flex items-end gap-[var(--space-2)]">
      <div className="flex flex-1 flex-col gap-[var(--space-2)]">
        <label
          htmlFor="build-refine"
          className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
        >
          Refine the plan or ask a follow-up
        </label>
        <Input id="build-refine" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <Button onClick={onSend} disabled={!value.trim()}>
        Send
      </Button>
    </div>
  );
}

/** Turns the studio's turn history into thread messages: every turn shows
 * its user prompt, and (once data exists) an AI bubble -- the live request
 * for the newest turn, the frozen snapshot for superseded ones. */
function buildThreadMessages(turns: Turn[], liveRequest: BuildRequest | null): ThreadMessage[] {
  return turns.flatMap((turn, i) => {
    const data = i === turns.length - 1 ? liveRequest : turn.snapshot;
    return [
      { role: "user" as const, content: <p>{turn.prompt}</p> },
      ...(data ? [{ role: "ai" as const, content: <StatusCard request={data} /> }] : []),
    ];
  });
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
  const [refineText, setRefineText] = useState("");
  const { turns, startTurn } = useStudioThread(request);

  const requiresRepoName = runMode !== "draft_spec_only";
  const canSubmit = Boolean(
    prompt.trim() && name.trim() && (!requiresRepoName || targetRepoName.trim()) && !submitting
  );
  const extras = {
    name,
    groundingEntityIris: selectedEntities.map((e) => e.iri),
    targetRepoName,
  };

  function handleRefine() {
    if (!refineText.trim()) {
      return;
    }
    startTurn(refineText);
    void submit(refineText, runMode, description, extras);
    setRefineText("");
  }

  function handleInitialSubmit() {
    startTurn(prompt);
    void submit(prompt, runMode, description, extras);
  }

  function handleEntityQueryChange(q: string) {
    setEntityQuery(q);
    fetchTypeahead(q)
      .then(setEntityResults)
      .catch(() => setEntityResults([]));
  }

  function handleEntitySelect(entity: TypeaheadResult) {
    setSelectedEntities((prev) => [...prev, entity]);
    setEntityQuery("");
    setEntityResults([]);
  }

  function handleEntityRemove(iri: string) {
    setSelectedEntities((prev) => prev.filter((entity) => entity.iri !== iri));
  }

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
        onEntityQueryChange={handleEntityQueryChange}
        entityResults={entityResults}
        selectedEntities={selectedEntities}
        onEntitySelect={handleEntitySelect}
        onEntityRemove={handleEntityRemove}
        description={description}
        onDescriptionChange={setDescription}
        submitting={submitting}
        canSubmit={canSubmit}
        onSubmit={handleInitialSubmit}
      />

      {error && (
        <p data-testid="request-error" role="alert" className="text-[var(--color-text-muted)]">
          {error}
        </p>
      )}

      {turns.length > 0 && (
        <>
          <Thread messages={buildThreadMessages(turns, request)} />
          <PlanCard draftContent={request?.draft_content ?? null} />
          <RefineBox value={refineText} onChange={setRefineText} onSend={handleRefine} />
        </>
      )}
    </main>
  );
}
