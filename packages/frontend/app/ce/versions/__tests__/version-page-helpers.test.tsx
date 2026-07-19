import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RulesState } from "../../rules/use-rules";
import {
  buildDraftBandBody,
  buildPreflightRows,
  buildPublishedTimelineEntries,
  publishedEntriesDesc,
  selectDraft,
} from "../version-page-helpers";
import type { VersionEntry } from "../types";

const DRAFT: VersionEntry = {
  version_iri: "urn:workspace:demo:v2",
  semver: "0.2.0",
  status: "draft",
  created_at: "2026-07-17T09:12:00Z",
  published_at: null,
  actor_iri: "urn:weave:user:priya",
};

const PUBLISHED_OLD: VersionEntry = {
  version_iri: "urn:workspace:demo:v1",
  semver: "0.1.0",
  status: "published",
  created_at: "2026-07-01T10:00:00Z",
  published_at: "2026-07-01T10:05:00Z",
  actor_iri: "urn:weave:user:marco",
};

const PUBLISHED_NEW: VersionEntry = {
  version_iri: "urn:workspace:demo:v1b",
  semver: "0.1.1",
  status: "published",
  created_at: "2026-07-10T10:00:00Z",
  published_at: "2026-07-10T10:05:00Z",
  actor_iri: "urn:weave:user:priya",
};

describe("selectDraft", () => {
  it("returns the first draft entry", () => {
    expect(selectDraft([PUBLISHED_OLD, DRAFT])).toBe(DRAFT);
  });

  it("returns undefined when there is no draft", () => {
    expect(selectDraft([PUBLISHED_OLD])).toBeUndefined();
  });
});

describe("publishedEntriesDesc", () => {
  it("filters to published only, newest published_at first", () => {
    const result = publishedEntriesDesc([DRAFT, PUBLISHED_OLD, PUBLISHED_NEW]);
    expect(result).toEqual([PUBLISHED_NEW, PUBLISHED_OLD]);
  });
});

describe("buildDraftBandBody", () => {
  it("shows a checking message while the diff is loading", () => {
    const body = buildDraftBandBody(DRAFT, PUBLISHED_NEW, { loading: true, notFound: false, diff: null });
    expect(body).toMatch(/checking/i);
  });

  it("shows a first-version message when there is no published baseline", () => {
    const body = buildDraftBandBody(DRAFT, null, { loading: false, notFound: true, diff: null });
    expect(body).toMatch(/first version/i);
    expect(body).toContain("v0.2.0");
  });

  it("shows a real change count, baseline version and actor once the diff loads", () => {
    const diff = { added: [{ subject: "a", predicate: "b", object: "c" }], removed: [], modified: [] };
    const body = buildDraftBandBody(DRAFT, PUBLISHED_NEW, { loading: false, notFound: false, diff });
    expect(body).toContain("1 change");
    expect(body).toContain("v0.1.1");
    expect(body).toContain("urn:weave:user:priya");
    expect(body).toContain("v0.2.0");
  });

  it("pluralizes multiple changes", () => {
    const diff = {
      added: [{ subject: "a", predicate: "b", object: "c" }],
      removed: [{ subject: "d", predicate: "e", object: "f" }],
      modified: [],
    };
    const body = buildDraftBandBody(DRAFT, PUBLISHED_NEW, { loading: false, notFound: false, diff });
    expect(body).toContain("2 changes");
  });
});

describe("buildPublishedTimelineEntries", () => {
  const opts = { expandedId: null, onToggleDiff: vi.fn(), onViewOnCanvas: vi.fn() };

  it("marks only the first (newest) entry as latest", () => {
    const entries = buildPublishedTimelineEntries([PUBLISHED_NEW, PUBLISHED_OLD], opts);
    expect(entries[0]!.latest).toBe(true);
    expect(entries[1]!.latest).toBeFalsy();
  });

  it("renders a gap note as expandedContent only for the expanded entry", () => {
    const entries = buildPublishedTimelineEntries([PUBLISHED_NEW, PUBLISHED_OLD], {
      ...opts,
      expandedId: PUBLISHED_OLD.version_iri,
    });
    render(<>{entries[1]!.expandedContent}</>);
    expect(screen.getByText(/isn't available yet/i)).toBeInTheDocument();
    expect(entries[0]!.expandedContent).toBeUndefined();
  });

  it("wires the Diff action to onToggleDiff with the entry's version IRI", () => {
    const onToggleDiff = vi.fn();
    const entries = buildPublishedTimelineEntries([PUBLISHED_NEW], { ...opts, onToggleDiff });
    entries[0]!.actions!.find((a) => a.label === "Diff")!.onClick();
    expect(onToggleDiff).toHaveBeenCalledWith(PUBLISHED_NEW.version_iri);
  });
});

describe("buildPreflightRows", () => {
  function rulesState(overrides: Partial<RulesState>): RulesState {
    return { report: null, loading: false, error: false, run: vi.fn(), ...overrides };
  }

  it("shows a real violation count from the rules report", () => {
    const rows = buildPreflightRows(
      rulesState({
        report: {
          pending: false,
          results: [{ shape_iri: "s", focus_node: "f", path: null, message: "m", severity: "Violation" }],
          rules: [],
          ran_at: "2026-07-17T00:00:00Z",
          version_resolved: "draft",
        },
      })
    );
    const rulesRow = rows.find((r) => r.label === "Rules")!;
    expect(rulesRow.status).toBe("warn");
    expect(rulesRow.detail).toMatch(/1 violation/i);
  });

  it("shows pass status when there are zero violations", () => {
    const rows = buildPreflightRows(
      rulesState({
        report: { pending: false, results: [], rules: [], ran_at: "2026-07-17T00:00:00Z", version_resolved: "draft" },
      })
    );
    expect(rows.find((r) => r.label === "Rules")!.status).toBe("pass");
  });

  it("always includes honest gap rows for consistency and provenance", () => {
    const rows = buildPreflightRows(rulesState({}));
    expect(rows.find((r) => r.label === "Consistency")!.status).toBe("gap");
    expect(rows.find((r) => r.label === "Provenance")!.status).toBe("gap");
  });
});
