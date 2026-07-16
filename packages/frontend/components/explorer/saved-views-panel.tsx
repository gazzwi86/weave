"use client";

import { useState } from "react";

import type { UseSavedViewsResult } from "./use-saved-views";
import type { SaveViewResult, ViewSummary } from "@/lib/explorer/views-client";

const HEADING_CLASS = "text-[length:var(--text-caption)] text-[var(--color-text-subtle)]";
const FIELD_CLASS =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)]";
const BUTTON_CLASS = `${FIELD_CLASS} bg-transparent`;

interface SaveFormProps {
  onSave: (name: string, overwrite: boolean) => Promise<SaveViewResult>;
}

// AC-1: name input + Save; a 409 collision surfaces an inline
// overwrite/rename prompt rather than a modal, per the brief's minimal
// save-dialog description.
function SaveForm({ onSave }: SaveFormProps): React.ReactElement {
  const [name, setName] = useState("");
  const [collision, setCollision] = useState(false);

  const attemptSave = async (overwrite: boolean) => {
    if (!name.trim()) return;
    const result = await onSave(name.trim(), overwrite);
    setCollision(result.status === "collision");
  };

  return (
    <form
      className="flex items-center gap-[var(--space-2)]"
      onSubmit={(event) => {
        event.preventDefault();
        void attemptSave(false);
      }}
    >
      <input
        aria-label="View name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={FIELD_CLASS}
      />
      <button type="submit" className={BUTTON_CLASS}>
        Save view
      </button>
      {collision && (
        <span className="text-[length:var(--text-body-sm)]" role="alert">
          A view named &quot;{name}&quot; already exists.{" "}
          <button type="button" className={BUTTON_CLASS} onClick={() => void attemptSave(true)}>
            Overwrite
          </button>
        </span>
      )}
    </form>
  );
}

/** AC-2/AC-3: freeform-token author display -- Option-2 (coordinator-
 * confirmed): principal IRI's local part, no tenant-directory lookup. */
function authorToken(iri: string): string {
  return iri.split(/[/#]/).pop() ?? iri;
}

interface LibraryRowProps {
  view: ViewSummary;
  onOpen: () => void;
  onDelete: () => void;
  onShare: (recipients: string[]) => void;
}

// AC-5: freeform recipient chips (Option-2 deviation from the brief's
// tenant-member-picklist hint -- no member-directory endpoint exists;
// server still decides share eligibility).
function ShareChips({ onShare }: { onShare: (recipients: string[]) => void }): React.ReactElement {
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  const addChip = () => {
    const value = draft.trim();
    if (!value) return;
    setChips((prev) => [...prev, value]);
    setDraft("");
  };

  return (
    <span className="flex items-center gap-[var(--space-1)]">
      {chips.map((chip) => (
        <span key={chip} className={FIELD_CLASS}>
          {authorToken(chip)}
        </span>
      ))}
      <input
        aria-label="Add share recipient"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addChip();
          }
        }}
        className={FIELD_CLASS}
      />
      <button type="button" className={BUTTON_CLASS} onClick={addChip}>
        Add
      </button>
      <button type="button" className={BUTTON_CLASS} onClick={() => onShare(chips)} disabled={chips.length === 0}>
        Share
      </button>
    </span>
  );
}

function LibraryRow({ view, onOpen, onDelete, onShare }: LibraryRowProps): React.ReactElement {
  return (
    <li className="flex flex-col gap-[var(--space-1)]">
      <span className="flex items-center justify-between gap-[var(--space-2)]">
        <button type="button" className={`flex-1 text-left ${FIELD_CLASS}`} onClick={onOpen}>
          {view.name}
        </button>
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
          {authorToken(view.created_by)}
        </span>
        <button type="button" className={BUTTON_CLASS} onClick={onDelete} aria-label={`Delete ${view.name}`}>
          Delete
        </button>
      </span>
      <ShareChips onShare={onShare} />
    </li>
  );
}

/** TASK-026 AC-1..AC-5: save form + tenant view library (open/delete/share)
 * -- all state/proxy wiring lives in useSavedViews, this is presentation
 * only (same split as versions-panel.tsx/use-versions-panel.ts). */
export function SavedViewsPanel(props: UseSavedViewsResult): React.ReactElement {
  return (
    <div data-testid="explorer-saved-views-panel">
      <h2 className={HEADING_CLASS}>Saved views</h2>
      <SaveForm onSave={props.save} />
      <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
        {props.views.map((view) => (
          <LibraryRow
            key={view.view_id}
            view={view}
            onOpen={() => props.open(view)}
            onDelete={() => props.remove(view.view_id)}
            onShare={(recipients) => props.share(view.view_id, recipients)}
          />
        ))}
      </ul>
    </div>
  );
}
