"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

// AC-3/AC-7: fixed 8-state list -- a state the manifest lacks renders as a
// labelled placeholder, never a broken image.
const CAPTURE_STATES = [
  "default",
  "hover",
  "focus",
  "active",
  "disabled",
  "loading",
  "empty",
  "error",
] as const;

type CaptureEntry = { state: string; status: "captured" | "absent"; reason?: string };
type CapturesManifest = CaptureEntry[] | Record<string, unknown> | null;

function useCapturesManifest(projectId: string, taskId: string): CapturesManifest | undefined {
  const [manifest, setManifest] = useState<CapturesManifest | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/captures`
    )
      .then((res) =>
        res.ok ? (res.json() as Promise<{ manifest: CapturesManifest }>) : { manifest: null }
      )
      .then((body) => {
        if (!cancelled) setManifest(body.manifest);
      })
      .catch(() => {
        if (!cancelled) setManifest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  return manifest;
}

function findEntry(manifest: CapturesManifest, state: string): CaptureEntry | undefined {
  if (!Array.isArray(manifest)) return undefined;
  return manifest.find((e) => e.state === state);
}

function CaptureCell({ state, entry }: { state: string; entry: CaptureEntry | undefined }) {
  const captured = entry?.status === "captured";
  return (
    <Card data-testid={`capture-cell-${state}`} className="flex flex-col gap-[var(--space-2)]">
      <div className="flex items-center justify-between">
        <span className="font-[var(--font-mono)] text-[length:var(--text-caption)] text-[var(--color-text-default)]">
          {state}
        </span>
        <Badge variant={captured ? "success" : "neutral"}>
          {captured ? "captured" : "absent"}
        </Badge>
      </div>
      {!captured && entry?.reason ? (
        <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {entry.reason}
        </p>
      ) : null}
    </Card>
  );
}

/** AC-3: the 8-cell captures grid; a missing manifest shows honest absence,
 * never broken images. */
export function TestsTab({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}): React.JSX.Element {
  const manifest = useCapturesManifest(projectId, taskId);

  if (manifest === undefined) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }
  if (manifest === null) {
    return (
      <p data-testid="captures-not-available" className="text-[var(--color-text-muted)]">
        Captures not available.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-[var(--space-3)] sm:grid-cols-4">
      {CAPTURE_STATES.map((state) => (
        <CaptureCell key={state} state={state} entry={findEntry(manifest, state)} />
      ))}
    </div>
  );
}
