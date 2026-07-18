"use client";

import { VersionsTimelineDrawer } from "@/components/templates/VersionsTimelineDrawer";
import { Button } from "@/components/ui/button";
import { ExplainBand } from "@/components/ui/explain-band";
import { useToast } from "@/components/ui/toast";

import { useRules } from "../rules/use-rules";
import { buildPublishDrawerProps } from "./publish-drawer";
import { useDiff } from "./use-diff";
import { usePublishDrawer } from "./use-publish-drawer";
import { useVersions } from "./use-versions";
import { buildDraftBandBody, buildPublishedTimelineEntries, publishedEntriesDesc, selectDraft } from "./version-page-helpers";

const VIEW_ON_CANVAS_GAP_TOAST = "Explore-canvas linking isn't wired yet.";

type BodyState = "error" | "loading" | "empty" | "content";

/** Collapses the page's four mutually-exclusive body states into one value
 * (kept out of the component so its branching doesn't count against
 * `CeVersionsPage`'s own complexity budget). */
function versionsBodyState(error: boolean, loading: boolean, hasPublished: boolean, hasDraft: boolean): BodyState {
  if (error) return "error";
  if (loading) return "loading";
  if (!hasPublished && !hasDraft) return "empty";
  return "content";
}

/** Versions (IA `#sub-versions`): the draft-review + publish workflow,
 * refit onto ExplainBand (draft banner) + Timeline (published history) +
 * Drawer (publish flow) per refit-mock.html `#sub-versions`/`#publish-drawer`
 * -- every other refit component already cites refit-mock.html, not
 * mock-v5-delta.html (which has no matching anchors there). Page stays
 * data-binding only: row/band-copy shaping lives in `version-page-helpers.tsx`,
 * drawer-content shaping in `publish-drawer.tsx`, drawer state in
 * `use-publish-drawer.ts`.
 */
export default function CeVersionsPage() {
  const { versions, loading, error, publish } = useVersions();
  const diffState = useDiff();
  const rules = useRules();
  const { toast } = useToast();
  const draft = selectDraft(versions);
  const drawer = usePublishDrawer({ draft, diffLoad: diffState.load, rulesRun: rules.run, publish, toast });

  const published = publishedEntriesDesc(versions);
  const latestPublished = published[0] ?? null;
  const onViewOnCanvas = () => toast({ message: VIEW_ON_CANVAS_GAP_TOAST, variant: "info" });

  const timelineEntries = buildPublishedTimelineEntries(published, {
    expandedId: drawer.expandedId,
    onToggleDiff: drawer.toggleDiffRow,
    onViewOnCanvas,
  });
  const drawerProps = draft
    ? buildPublishDrawerProps({
        draft,
        open: drawer.open,
        onClose: drawer.closeDrawer,
        diffView: diffState,
        rules,
        publishError: drawer.publishError,
        releaseNote: drawer.releaseNote,
        onReleaseNoteChange: drawer.setReleaseNote,
        onPublish: () => drawer.handlePublish().catch(() => undefined),
      })
    : undefined;
  const bodyState = versionsBodyState(error, loading, published.length > 0, Boolean(draft));

  return (
    <main data-tour-id="ce.versions" className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Versions
      </h1>

      {draft && (
        <ExplainBand
          tone="warn"
          icon="git"
          body={buildDraftBandBody(draft, latestPublished, diffState)}
          action={
            <div className="flex shrink-0 gap-[var(--space-2)]">
              <Button variant="ghost" onClick={onViewOnCanvas}>
                View diff on canvas
              </Button>
              <Button variant="primary" onClick={drawer.openDrawer}>
                Review & publish
              </Button>
            </div>
          }
        />
      )}

      {bodyState === "error" && <p className="text-[var(--color-danger)]">Could not load versions.</p>}
      {bodyState === "loading" && <p className="text-[var(--color-text-muted)]">Loading versions…</p>}
      {bodyState === "empty" && <p className="text-[var(--color-text-muted)]">No published versions yet.</p>}
      {bodyState === "content" && <VersionsTimelineDrawer entries={timelineEntries} drawer={drawerProps} />}
    </main>
  );
}
