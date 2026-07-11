"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useVersions } from "./use-versions";
import { VersionRow } from "./version-row";

/** Versions / Publish (IA §2.2): draft-to-published lifecycle over
 * CE-READ-1's version list, CE-DIFF-1's semantic diff, and the publish
 * endpoint -- closes the create → review → publish → see loop. */
export default function CeVersionsPage() {
  const { versions, loading, error, publish } = useVersions();
  const sorted = [...versions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <main data-tour-id="ce.versions" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Versions
        </h1>
        <Badge variant="info">M1 — this pass</Badge>
      </div>
      <Card>
        <CardContent>
          {error && <p className="text-[var(--color-danger)]">Could not load versions.</p>}
          {!error && loading && <p className="text-[var(--color-text-muted)]">Loading versions…</p>}
          {!error && !loading && sorted.length === 0 && (
            <p className="text-[var(--color-text-muted)]">No versions yet.</p>
          )}
          {!error && !loading && sorted.length > 0 && (
            <ul data-testid="version-list" className="flex flex-col">
              {sorted.map((version) => (
                <VersionRow key={version.version_iri} version={version} onPublish={publish} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
