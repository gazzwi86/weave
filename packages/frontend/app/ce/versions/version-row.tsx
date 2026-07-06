"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { DiffView } from "./diff-view";
import type { VersionEntry } from "./types";
import { useDiff } from "./use-diff";
import type { PublishOutcome } from "./use-versions";

export interface VersionRowProps {
  version: VersionEntry;
  onPublish: (versionIri: string) => Promise<PublishOutcome>;
}

const PUBLISH_MESSAGE: Partial<Record<PublishOutcome, string>> = {
  forbidden: "You need publisher role to publish this version.",
  not_found: "This version no longer exists.",
  unavailable: "The ontology store is unavailable — try again shortly.",
};

/** ponytail: relative time via native Intl.RelativeTimeFormat -- no date
 * library needed for "3 hours ago" granularity. */
function relativeTime(iso: string): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  return rtf.format(Math.round(diffHours / 24), "day");
}

export function VersionRow({ version, onPublish }: VersionRowProps) {
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const diffState = useDiff();
  const isDraft = version.status === "draft";

  function toggleReview(): void {
    const next = !reviewing;
    setReviewing(next);
    if (next) diffState.load(version.version_iri);
  }

  async function handlePublish(): Promise<void> {
    setMessage(null);
    const outcome = await onPublish(version.version_iri);
    setMessage(PUBLISH_MESSAGE[outcome] ?? null);
  }

  return (
    <li className="flex flex-col gap-[var(--space-2)] border-b border-[var(--color-border)] py-[var(--space-3)]">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-3)]">
          <Badge variant={isDraft ? "warn" : "success"}>{isDraft ? "Draft" : "Published"}</Badge>
          <span className="font-mono text-[length:var(--text-mono-sm)] text-[var(--color-text-default)]">
            {version.semver}
          </span>
          <span className="text-[var(--color-text-muted)]">{version.actor_iri}</span>
          <span className="text-[var(--color-text-muted)]">
            {relativeTime(version.published_at ?? version.created_at)}
          </span>
        </div>
        {isDraft && (
          <div className="flex items-center gap-[var(--space-2)]">
            <Button variant="secondary" onClick={toggleReview}>
              {reviewing ? "Hide changes" : "Review changes"}
            </Button>
            <Button variant="primary" onClick={handlePublish}>
              Publish
            </Button>
          </div>
        )}
      </div>
      {message && <p className="text-[length:var(--text-caption)] text-[var(--color-danger)]">{message}</p>}
      {reviewing && (
        <DiffView diff={diffState.diff} loading={diffState.loading} error={diffState.error} notFound={diffState.notFound} />
      )}
    </li>
  );
}
