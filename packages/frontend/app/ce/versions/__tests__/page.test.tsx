import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import CeVersionsPage from "../page";

interface VersionEntry {
  version_iri: string;
  semver: string;
  status: "draft" | "published";
  created_at: string;
  published_at: string | null;
  actor_iri: string;
}

const DRAFT: VersionEntry = {
  version_iri: "urn:workspace:demo:v2",
  semver: "0.2.0",
  status: "draft",
  created_at: "2026-07-06T10:00:00Z",
  published_at: null,
  actor_iri: "urn:weave:user:client",
};

const PUBLISHED: VersionEntry = {
  version_iri: "urn:workspace:demo:v1",
  semver: "0.1.0",
  status: "published",
  created_at: "2026-07-01T10:00:00Z",
  published_at: "2026-07-01T10:05:00Z",
  actor_iri: "urn:weave:user:client",
};

const DRAFT_PUBLISHED = { ...DRAFT, status: "published" as const, published_at: "2026-07-06T10:10:00Z" };

const DIFF_BODY = {
  added: [{ subject: "urn:a", predicate: "urn:rel", object: "urn:b" }],
  removed: [{ subject: "urn:c", predicate: "urn:rel", object: "urn:d" }],
  modified: [{ subject: "urn:e", predicate: "urn:rel", before: "urn:f", after: "urn:g" }],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface FetchMockOptions {
  versionsSequence: VersionEntry[][];
  publish?: () => Response;
  diff?: () => Response;
}

function stubFetch({ versionsSequence, publish, diff }: FetchMockOptions): void {
  let versionsCallIndex = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      if (url.includes("/publish") && method === "POST") {
        return publish ? publish() : jsonResponse(200, {});
      }
      if (url.includes("/api/proxy/ontology/versions")) {
        const list = versionsSequence[Math.min(versionsCallIndex, versionsSequence.length - 1)] ?? [];
        versionsCallIndex += 1;
        return jsonResponse(200, { versions: list, total: list.length, page: 1, per_page: 50 });
      }
      if (url.includes("/api/proxy/ontology/diff")) {
        return diff ? diff() : jsonResponse(404, { error: "version_not_found" });
      }
      throw new Error(`unhandled fetch ${url}`);
    })
  );
}

function draftRow(): HTMLElement {
  const rows = screen.getAllByRole("listitem");
  const found = rows.find((row) => row.textContent?.includes(DRAFT.semver));
  if (!found) throw new Error("draft row not found");
  return found;
}

function publishedRow(): HTMLElement {
  const rows = screen.getAllByRole("listitem");
  const found = rows.find((row) => row.textContent?.includes(PUBLISHED.semver));
  if (!found) throw new Error("published row not found");
  return found;
}

describe("CeVersionsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]] });
    const { container } = render(<CeVersionsPage />);
    await screen.findByTestId("version-list");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("renders versions with correct status badges", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]] });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    expect(within(draftRow()).getByText("Draft")).toBeInTheDocument();
    expect(within(publishedRow()).getByText("Published")).toBeInTheDocument();
  });

  it("shows a Publish button on a draft row but not on a published row", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]] });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    expect(within(draftRow()).getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(within(publishedRow()).queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("clicking Publish calls POST publish then refetches the list", async () => {
    stubFetch({
      versionsSequence: [[DRAFT, PUBLISHED], [DRAFT_PUBLISHED, PUBLISHED]],
      publish: () => jsonResponse(200, { version_iri: DRAFT.version_iri, status: "published" }),
    });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    fireEvent.click(within(draftRow()).getByRole("button", { name: "Publish" }));

    await waitFor(() => {
      const rows = screen.getAllByRole("listitem");
      const flipped = rows.find((row) => row.textContent?.includes(DRAFT.semver));
      expect(flipped && within(flipped).queryByText("Draft")).toBeNull();
    });
    expect(screen.getAllByText("Published")).toHaveLength(2);
  });

  it("shows a publisher-role message on 403 without crashing", async () => {
    stubFetch({
      versionsSequence: [[DRAFT]],
      publish: () => jsonResponse(403, { message: "insufficient role" }),
    });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    fireEvent.click(within(draftRow()).getByRole("button", { name: "Publish" }));

    await expect(screen.findByText(/need publisher role/i)).resolves.toBeInTheDocument();
  });

  it("treats 405 (already published) as a refetch, not an error", async () => {
    stubFetch({
      versionsSequence: [[DRAFT], [DRAFT_PUBLISHED]],
      publish: () => jsonResponse(405, { message: "version is published and immutable" }),
    });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    fireEvent.click(within(draftRow()).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(screen.getByText("Published")).toBeInTheDocument());
    expect(screen.queryByText(/need publisher role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("Review changes fetches the diff and renders added/removed/modified", async () => {
    stubFetch({
      versionsSequence: [[DRAFT]],
      diff: () => jsonResponse(200, DIFF_BODY),
    });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    fireEvent.click(within(draftRow()).getByRole("button", { name: "Review changes" }));

    const diffView = await screen.findByTestId("diff-view");
    expect(within(diffView).getByText(/1 added/i)).toBeInTheDocument();
    expect(within(diffView).getByText(/1 removed/i)).toBeInTheDocument();
    expect(within(diffView).getByText(/1 modified/i)).toBeInTheDocument();
  });

  it("degrades gracefully when there is no published baseline to diff against (404)", async () => {
    stubFetch({
      versionsSequence: [[DRAFT]],
      diff: () => jsonResponse(404, { error: "version_not_found" }),
    });
    render(<CeVersionsPage />);
    await screen.findByTestId("version-list");

    fireEvent.click(within(draftRow()).getByRole("button", { name: "Review changes" }));

    await expect(screen.findByText(/no published baseline/i)).resolves.toBeInTheDocument();
  });
});
