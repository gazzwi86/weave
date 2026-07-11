import { EntityPicker, type TypeaheadResult } from "@/components/molecules/EntityPicker";

export type { TypeaheadResult };
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type RequestFormRunMode = "draft_spec_only" | "spec_to_build" | "spike";

const RUN_MODES: { value: RequestFormRunMode; label: string }[] = [
  { value: "draft_spec_only", label: "Draft spec only" },
  { value: "spec_to_build", label: "Spec to build" },
  { value: "spike", label: "Spike" },
];

const FIELD_CLASS =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

export interface RequestFormProps {
  name: string;
  onNameChange: (name: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  runMode: RequestFormRunMode;
  onRunModeChange: (runMode: RequestFormRunMode) => void;
  requiresRepoName: boolean;
  targetRepoName: string;
  onTargetRepoNameChange: (targetRepoName: string) => void;
  entityQuery: string;
  onEntityQueryChange: (query: string) => void;
  entityResults: TypeaheadResult[];
  selectedEntities: TypeaheadResult[];
  onEntitySelect: (entity: TypeaheadResult) => void;
  onEntityRemove: (iri: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

/** TASK-024 (F-D20): the Build engine's "Request application" form fields,
 * as a dumb template -- data-fetching/state lives in `app/`'s page
 * container (atomic-design boundary, `weave/app-layer-boundary` lint
 * rule); this component only renders props and reports intent upward.
 */
export function RequestForm(props: RequestFormProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <label
          htmlFor="build-request-name"
          className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
        >
          Request name
        </label>
        <Input
          id="build-request-name"
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
        />
        <label
          htmlFor="build-prompt"
          className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
        >
          What should Weave build?
        </label>
        <textarea
          id="build-prompt"
          rows={6}
          value={props.prompt}
          onChange={(e) => props.onPromptChange(e.target.value)}
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
          value={props.runMode}
          onChange={(e) => props.onRunModeChange(e.target.value as RequestFormRunMode)}
          className={FIELD_CLASS}
        >
          {RUN_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label}
            </option>
          ))}
        </select>
        {props.requiresRepoName && (
          <>
            <label
              htmlFor="build-target-repo-name"
              className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]"
            >
              Target repo name
            </label>
            <Input
              id="build-target-repo-name"
              placeholder="my-new-service"
              value={props.targetRepoName}
              onChange={(e) => props.onTargetRepoNameChange(e.target.value)}
            />
          </>
        )}
        <EntityPicker
          id="build-grounding-entities"
          label="Grounding entities"
          query={props.entityQuery}
          onQueryChange={props.onEntityQueryChange}
          results={props.entityResults}
          selected={props.selectedEntities}
          onSelect={props.onEntitySelect}
          onRemove={props.onEntityRemove}
        />
        <Input
          aria-label="Description (optional)"
          placeholder="description (optional)"
          value={props.description}
          onChange={(e) => props.onDescriptionChange(e.target.value)}
        />
        <Button disabled={!props.canSubmit} onClick={props.onSubmit}>
          {props.submitting ? "Requesting…" : "Request application"}
        </Button>
      </CardContent>
    </Card>
  );
}
