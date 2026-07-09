"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { type BuildRequest, type RunMode, useRequestStatus } from "./use-request-status";

const RUN_MODES: { value: RunMode; label: string }[] = [
  { value: "draft_spec_only", label: "Draft spec only" },
  { value: "spec_to_build", label: "Spec to build" },
  { value: "spike", label: "Spike" },
];

const FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

function StatusCard({ request }: { request: BuildRequest }) {
  return (
    <Card>
      {/* Plain text, not CardTitle -- same axe heading-order trap as
       * billing/page.tsx (the page's only heading is its own h1). */}
      <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Request {request.request_id}
      </p>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <p data-testid="request-status">Status: {request.status}</p>
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

/** Build engine M1: the "Request application" form. Submits a prompt to the
 * dark-factory loop via `POST /api/requests` and polls the created request
 * until it leaves the "drafting" status, rendering the draft content when
 * the backend produces it.
 */
export default function BuildPage() {
  const { request, submitting, error, submit } = useRequestStatus();
  const [prompt, setPrompt] = useState("");
  const [runMode, setRunMode] = useState<RunMode>("draft_spec_only");
  const [description, setDescription] = useState("");

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Request application
      </h1>

      <Card>
        <CardContent className="flex flex-col gap-[var(--space-3)]">
          <label
            htmlFor="build-prompt"
            className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
          >
            What should Weave build?
          </label>
          <textarea
            id="build-prompt"
            rows={6}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className={FIELD_CLASS}
          />
          <label
            htmlFor="build-run-mode"
            className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
          >
            Run mode
          </label>
          <select
            id="build-run-mode"
            value={runMode}
            onChange={(e) => setRunMode(e.target.value as RunMode)}
            className={FIELD_CLASS}
          >
            {RUN_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="Description (optional)"
            placeholder="description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            disabled={!prompt.trim() || submitting}
            onClick={() => submit(prompt, runMode, description)}
          >
            {submitting ? "Requesting…" : "Request application"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p data-testid="request-error" role="alert" className="text-[var(--color-text-muted)]">
          {error}
        </p>
      )}

      {request && <StatusCard request={request} />}
    </main>
  );
}
