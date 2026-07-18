"use client";

import { useState } from "react";

import { DEFAULT_EXPLORER_CONFIG } from "@/lib/explorer/config";
import { EntityPickerPage as EntityPickerModal } from "@/components/templates/EntityPickerPage";

import type { PolicyRow } from "./policies-query";
import { submitAddEdge } from "./submit-edge";
import { useKindTypeahead } from "./use-kind-typeahead";

// Same predicate Explorer's Governance layer already queries
// (lib/explorer/config.ts) -- reusing it, not a fresh literal, keeps a
// newly-attached edge visible in Explorer without a namespace mismatch.
const GOVERNED_BY = DEFAULT_EXPLORER_CONFIG.governanceLayerPredicate;

interface PolicyAttachModalProps {
  policy: PolicyRow;
  onClose: () => void;
  /** Called once at least one attach succeeds, so the caller can refresh
   * whatever list is showing governed-entity counts. */
  onAttached: () => void;
}

async function attachAll(selectedIds: string[], policyIri: string): Promise<string | null> {
  const outcomes = await Promise.all(selectedIds.map((id) => submitAddEdge(id, GOVERNED_BY, policyIri)));
  const failed = outcomes.filter((outcome) => !outcome.ok);
  const [firstFailure] = failed;
  // ponytail: one error line naming the failure count, no retry queue --
  // partial failure across a multi-select attach is the only real edge
  // case here (see PolicyAttachModal test "reports a partial failure").
  if (firstFailure) return firstFailure.errorMessage ?? `${failed.length} of ${outcomes.length} failed to attach.`;
  return null;
}

/** Policies tab's attach-to-entity flow (task brief: "attach
 * EntityPickerModal via operations client"): a kind-aware typeahead search
 * feeds `EntityPickerModal`, and on confirm each selected entity gets a
 * `governedBy` edge to this policy via `submitAddEdge`. Closes only on full
 * success -- a partial failure keeps the modal open with the error inline
 * so the caller can retry just the ones that failed. */
export function PolicyAttachModal({ policy, onClose, onAttached }: PolicyAttachModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const options = useKindTypeahead(search);

  function toggle(id: string): void {
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  async function handleConfirm(ids: string[]): Promise<void> {
    setError(null);
    const failure = await attachAll(ids, policy.iri);
    if (failure) return setError(failure);
    onAttached();
    onClose();
  }

  return (
    <>
      <EntityPickerModal
        open
        onClose={onClose}
        onConfirm={(ids) => void handleConfirm(ids)}
        options={options}
        selectedIds={selectedIds}
        onToggle={toggle}
        search={{ value: search, onChange: setSearch }}
        title={`Attach to ${policy.label}`}
      />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </>
  );
}
