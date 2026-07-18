"use client";

import { useState } from "react";

import { DrawerPage as Drawer } from "@/components/templates/DrawerPage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { submitCommitShape, submitPreviewShape } from "./submit-shape";

interface NlRuleDrawerProps {
  onClose: () => void;
  onCommitted: (shapeIri: string) => void;
}

function useDraftState() {
  const [text, setText] = useState("");
  const [shapeTurtle, setShapeTurtle] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return { text, setText, shapeTurtle, setShapeTurtle, edited, setEdited, error, setError, submitting, setSubmitting };
}

type DraftState = ReturnType<typeof useDraftState>;

/** New-rule drawer's NL box + previewed-turtle box (G3, remediation-2). Turtle
 * box only appears once a preview has returned -- editing it after the fact
 * flips `ai_generated` to false on commit (submit-shape.ts's contract). */
function DraftFields({ state }: { state: DraftState }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="nl-rule-text" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Describe the rule
        </label>
        <Textarea
          id="nl-rule-text"
          rows={3}
          value={state.text}
          onChange={(e) => state.setText(e.target.value)}
          placeholder="Every Process must have an Owner."
        />
      </div>
      {state.shapeTurtle !== null && (
        <div className="flex flex-col gap-[var(--space-1)]">
          <label htmlFor="nl-rule-turtle" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
            Shape (edit before committing if needed)
          </label>
          <Textarea
            id="nl-rule-turtle"
            rows={6}
            className="font-[var(--font-mono)]"
            value={state.shapeTurtle}
            onChange={(e) => {
              state.setShapeTurtle(e.target.value);
              state.setEdited(true);
            }}
          />
        </div>
      )}
      {state.error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}

async function runPreview(state: DraftState): Promise<void> {
  state.setSubmitting(true);
  state.setError(null);
  const outcome = await submitPreviewShape(state.text);
  state.setSubmitting(false);
  if (outcome.shapeTurtle === null) return state.setError(outcome.errorMessage);
  state.setShapeTurtle(outcome.shapeTurtle);
  state.setEdited(false);
}

async function runCommit(state: DraftState, onCommitted: (shapeIri: string) => void): Promise<void> {
  if (state.shapeTurtle === null) return;
  state.setSubmitting(true);
  state.setError(null);
  const outcome = await submitCommitShape(state.shapeTurtle, !state.edited);
  state.setSubmitting(false);
  if (outcome.shapeIri === null) return state.setError(outcome.errorMessage);
  onCommitted(outcome.shapeIri);
}

/** New-rule authoring drawer (G3): NL text -> preview -> (optionally
 * hand-edit) -> commit. Every step's error (422/503) surfaces inline via
 * submit-shape.ts's never-throwing clients -- no crash on a down model
 * provider (graceful degradation). */
export function NlRuleDrawer({ onClose, onCommitted }: NlRuleDrawerProps) {
  const state = useDraftState();

  return (
    <Drawer
      open
      onClose={onClose}
      icon="sparkles"
      tone="var(--color-accent-primary)"
      title="New rule"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {state.shapeTurtle === null ? (
            <Button variant="primary" onClick={() => void runPreview(state)} disabled={state.submitting || !state.text.trim()}>
              Preview
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void runCommit(state, onCommitted)} disabled={state.submitting}>
              Commit
            </Button>
          )}
        </>
      }
    >
      <DraftFields state={state} />
    </Drawer>
  );
}
