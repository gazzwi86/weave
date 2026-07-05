"use client";

import { useEffect, useState } from "react";

import { ChatPanel } from "./chat/chat-panel";
import { GuidedForm } from "./chat/guided-form";
import type { KindEntry } from "./chat/types";

/** ponytail: a plain effect + useState, not a shared hook -- this is the
 * only place the full kind list (as opposed to one kind's shape) is needed.
 */
function useKindList(): KindEntry[] {
  const [kinds, setKinds] = useState<KindEntry[]>([]);
  useEffect(() => {
    fetch("/api/ontology/types")
      .then((res) => (res.ok ? (res.json() as Promise<{ kinds: KindEntry[] }>) : null))
      .then((body) => setKinds(body?.kinds ?? []));
  }, []);
  return kinds;
}

function AddEntityLauncher() {
  const kinds = useKindList();
  const [selectedKind, setSelectedKind] = useState("");

  if (selectedKind) {
    return <GuidedForm kindIri={selectedKind} onClose={() => setSelectedKind("")} />;
  }

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <label htmlFor="ce-add-entity" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        Add entity
      </label>
      <select
        id="ce-add-entity"
        value={selectedKind}
        onChange={(event) => setSelectedKind(event.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      >
        <option value="">Select a kind…</option>
        {kinds.map((kind) => (
          <option key={kind.iri} value={kind.iri}>
            {kind.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** TASK-006 AC-006-01: the Constitution Engine workspace -- persistent chat
 * panel alongside the entity-authoring surfaces (guided forms). The graph
 * view itself is a separate task/engine, not built here.
 */
export default function CePage() {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-4)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Constitution Engine
      </h1>
      <div className="grid flex-1 grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
        <ChatPanel />
        <AddEntityLauncher />
      </div>
    </main>
  );
}
