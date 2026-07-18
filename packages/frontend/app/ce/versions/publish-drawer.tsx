import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import type { DrawerProps } from "@/components/templates/VersionsTimelineDrawer";

import type { RulesState } from "../rules/use-rules";
import { DiffView, type DiffViewProps } from "./diff-view";
import type { VersionEntry } from "./types";
import { buildPreflightRows, type PreflightRow } from "./version-page-helpers";

const PREFLIGHT_STATUS_STYLE: Record<PreflightRow["status"], string> = {
  pass: "text-[var(--color-success)]",
  warn: "text-[var(--color-warn)]",
  gap: "text-[var(--color-text-subtle)]",
};

function PreflightList({ rows }: { rows: PreflightRow[] }) {
  return (
    <ul className="flex flex-col gap-[var(--space-2)]">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between text-[length:var(--text-body-sm)]">
          <span className="text-[var(--color-text-default)]">{row.label}</span>
          <span className={PREFLIGHT_STATUS_STYLE[row.status]}>{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}

interface PublishDrawerBodyProps {
  draft: VersionEntry;
  diffView: DiffViewProps;
  rules: RulesState;
  publishError: string | null;
  releaseNote: string;
  onReleaseNoteChange: (value: string) => void;
}

/** refit-mock.html `#publish-drawer`'s body: the diff, the real pre-publish
 * checks, and the (unpersisted) release note field. */
function PublishDrawerBody({ draft, diffView, rules, publishError, releaseNote, onReleaseNoteChange }: PublishDrawerBodyProps) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {publishError && <p className="text-[length:var(--text-caption)] text-[var(--color-danger)]">{publishError}</p>}
      <DiffView {...diffView} />
      <div>
        <h2 className="mb-[var(--space-2)] text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Pre-publish checks
        </h2>
        <PreflightList rows={buildPreflightRows(rules)} />
      </div>
      <label className="flex flex-col gap-[var(--space-2)]">
        <span className="text-[length:var(--text-body-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Release note (optional)
        </span>
        <textarea
          value={releaseNote}
          onChange={(event) => onReleaseNoteChange(event.target.value)}
          rows={3}
          className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-raised)] p-[var(--space-3)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)]"
        />
      </label>
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        Publishing freezes these changes into v{draft.semver}, notifies the team, and re-checks any dependent
        projects.
      </p>
    </div>
  );
}

export interface BuildPublishDrawerPropsArgs {
  draft: VersionEntry;
  open: boolean;
  onClose: () => void;
  diffView: DiffViewProps;
  rules: RulesState;
  publishError: string | null;
  releaseNote: string;
  onReleaseNoteChange: (value: string) => void;
  onPublish: () => void;
}

/** Assembles the full `Drawer` prop set for the publish flow (kept out of
 * the page body for the Law E line budget). */
export function buildPublishDrawerProps(args: BuildPublishDrawerPropsArgs): DrawerProps {
  const { draft, open, onClose, onPublish } = args;
  return {
    open,
    onClose,
    icon: "git",
    tone: "var(--color-success)",
    title: `Publish draft → v${draft.semver}`,
    pill: <StatusPill status="draft" />,
    size: "lg",
    footer: (
      <>
        <Button variant="ghost" onClick={onClose}>
          Keep drafting
        </Button>
        <Button variant="primary" onClick={onPublish}>
          {`Publish v${draft.semver}`}
        </Button>
      </>
    ),
    children: <PublishDrawerBody {...args} />,
  };
}
