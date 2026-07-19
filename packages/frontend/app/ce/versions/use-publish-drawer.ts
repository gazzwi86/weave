"use client";

import { useCallback, useEffect, useState } from "react";

import type { RulesState } from "../rules/use-rules";
import type { DiffState } from "./use-diff";
import type { PublishOutcome } from "./use-versions";
import type { VersionEntry } from "./types";

const RELEASE_NOTE_GAP_TOAST = "Release notes aren't available yet.";

const PUBLISH_MESSAGE: Partial<Record<PublishOutcome, string>> = {
  forbidden: "You need publisher role to publish this version.",
  not_found: "This version no longer exists.",
  unavailable: "The ontology store is unavailable — try again shortly.",
};

interface ToastInput {
  message: string;
  variant?: "info" | "success" | "error";
}

export interface PublishDrawerState {
  open: boolean;
  releaseNote: string;
  publishError: string | null;
  expandedId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  setReleaseNote: (value: string) => void;
  toggleDiffRow: (versionIri: string) => void;
  handlePublish: () => Promise<void>;
}

interface UsePublishDrawerArgs {
  draft: VersionEntry | undefined;
  diffLoad: DiffState["load"];
  rulesRun: RulesState["run"];
  publish: (versionIri: string) => Promise<PublishOutcome>;
  toast: (input: ToastInput) => void;
}

/** Owns the publish-drawer's UI-only state and the two effects that keep it
 * fed with real data (the draft's diff on mount, a real SHACL pass on open)
 * -- kept out of the page body for the Law E complexity/line budget. */
export function usePublishDrawer({ draft, diffLoad, rulesRun, publish, toast }: UsePublishDrawerArgs): PublishDrawerState {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [releaseNote, setReleaseNote] = useState("");
  const [publishError, setPublishError] = useState<string | null>(null);

  useEffect(() => {
    if (draft) diffLoad(draft.version_iri);
    // diffLoad is a stable useCallback identity -- only the draft changing
    // should re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.version_iri]);

  useEffect(() => {
    // Opening the drawer runs the real SHACL pass (AC-006-04), not just the
    // mount-time cache-only read -- a pre-publish check should be current.
    if (open) rulesRun().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePublish = useCallback(async () => {
    if (!draft) return;
    setPublishError(null);
    if (releaseNote.trim().length > 0) {
      toast({ message: RELEASE_NOTE_GAP_TOAST, variant: "info" });
    }
    const outcome = await publish(draft.version_iri);
    if (outcome === "published" || outcome === "already_published") {
      toast({ message: `v${draft.semver} published — team notified, projects re-checking.`, variant: "success" });
      setOpen(false);
      setReleaseNote("");
    } else {
      setPublishError(PUBLISH_MESSAGE[outcome] ?? "Could not publish this version.");
    }
  }, [draft, releaseNote, publish, toast]);

  return {
    open,
    releaseNote,
    publishError,
    expandedId,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false),
    setReleaseNote,
    toggleDiffRow: (versionIri) => setExpandedId((current) => (current === versionIri ? null : versionIri)),
    handlePublish,
  };
}
