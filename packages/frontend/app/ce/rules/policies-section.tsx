"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { PolicyRow } from "./policies-query";
import { PolicyAttachModal } from "./policy-attach-modal";
import { PolicyCards } from "./policy-cards";
import { usePolicies } from "./use-policies";

/** Policies tab (task brief: "policies tab + attach EntityPickerModal") --
 * paginated card grid, same page shape as brand's BrandListSection. Attach
 * opens `PolicyAttachModal`, which owns its own entity search + submit; no
 * refetch needed after a successful attach since it doesn't change this
 * list's rows (label/iri), only the attached entity's graph edges.
 */
export function PoliciesSection() {
  const [page, setPage] = useState(0);
  const [attaching, setAttaching] = useState<PolicyRow | null>(null);
  const list = usePolicies(page);

  if (list.error) return <p className="text-[var(--color-danger)]">Could not load policies.</p>;
  if (list.loading) return <p className="text-[var(--color-text-muted)]">Loading…</p>;

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <PolicyCards rows={list.rows} onAttach={setAttaching} />
      <div className="flex items-center gap-[var(--space-2)]">
        <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button variant="secondary" disabled={!list.hasMore} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
      {attaching && (
        <PolicyAttachModal policy={attaching} onClose={() => setAttaching(null)} onAttached={() => setAttaching(null)} />
      )}
    </div>
  );
}
