import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { ToastProvider } from "@/components/ui/toast";

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

const RULES_BODY = { pending: false, results: [], rules: [], ran_at: "2026-07-17T00:00:00Z", version_resolved: "draft" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface FetchMockOptions {
  versionsSequence: VersionEntry[][];
  publish?: () => Response;
  diff?: () => Response;
  validate?: () => Response;
}

interface Route {
  match: (url: string, method: string) => boolean;
  handle: () => Response;
}

/** One handler per endpoint, kept out of the dispatching arrow so it stays
 * under the complexity budget (data-driven route table instead of a chain
 * of ifs). */
function buildRoutes({ versionsSequence, publish, diff, validate }: FetchMockOptions): Route[] {
  const versionsCallIndex = { current: 0 };
  return [
    { match: (url, method) => url.includes("/publish") && method === "POST", handle: () => (publish ? publish() : jsonResponse(200, {})) },
    {
      match: (url) => url.includes("/api/proxy/ontology/versions"),
      handle: () => {
        const list = versionsSequence[Math.min(versionsCallIndex.current, versionsSequence.length - 1)] ?? [];
        versionsCallIndex.current += 1;
        return jsonResponse(200, { versions: list, total: list.length, page: 1, per_page: 50 });
      },
    },
    {
      match: (url) => url.includes("/api/proxy/ontology/diff"),
      handle: () => (diff ? diff() : jsonResponse(404, { error: "version_not_found" })),
    },
    {
      match: (url) => url.includes("/api/proxy/validate"),
      handle: () => (validate ? validate() : jsonResponse(200, RULES_BODY)),
    },
  ];
}

function stubFetch(options: FetchMockOptions): void {
  const routes = buildRoutes(options);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      const method = init?.method ?? "GET";
      const route = routes.find((candidate) => candidate.match(url, method));
      if (!route) throw new Error(`unhandled fetch ${url}`);
      return route.handle();
    })
  );
}

function renderPage() {
  return render(
    <ToastProvider>
      <CeVersionsPage />
    </ToastProvider>
  );
}

describe("CeVersionsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]], diff: () => jsonResponse(200, DIFF_BODY) });
    const { container } = renderPage();
    await screen.findByTestId("versions-timeline");
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("shows the draft ExplainBand with a real change count from the diff endpoint", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]], diff: () => jsonResponse(200, DIFF_BODY) });
    renderPage();

    await expect(screen.findByText(/3 changes since v0\.1\.0/i)).resolves.toBeInTheDocument();
    expect(screen.getByText(/Publishing freezes them into v0\.2\.0/i)).toBeInTheDocument();
  });

  it("degrades to a first-version message when there is no published baseline", async () => {
    stubFetch({ versionsSequence: [[DRAFT]] });
    renderPage();

    await expect(screen.findByText(/first version/i)).resolves.toBeInTheDocument();
  });

  it("shows only published versions in the timeline, latest first", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]], diff: () => jsonResponse(200, DIFF_BODY) });
    renderPage();

    const timeline = await screen.findByTestId("versions-timeline");
    expect(within(timeline).getByText("v0.1.0")).toBeInTheDocument();
    expect(within(timeline).queryByText("v0.2.0")).not.toBeInTheDocument();
    expect(within(timeline).getByText("latest")).toBeInTheDocument();
  });

  it("renders no ExplainBand when there is no draft", async () => {
    stubFetch({ versionsSequence: [[PUBLISHED]] });
    renderPage();

    await screen.findByTestId("versions-timeline");
    expect(screen.queryByRole("button", { name: "Review & publish" })).not.toBeInTheDocument();
  });

  it("opens the publish drawer with the diff and a real Rules preflight row", async () => {
    stubFetch({
      versionsSequence: [[DRAFT, PUBLISHED]],
      diff: () => jsonResponse(200, DIFF_BODY),
      validate: () =>
        jsonResponse(200, {
          pending: false,
          results: [{ shape_iri: "s", focus_node: "f", path: null, message: "m", severity: "Violation" }],
          rules: [],
          ran_at: "2026-07-17T00:00:00Z",
          version_resolved: "draft",
        }),
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Review & publish" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Publish draft → v0.2.0")).toBeInTheDocument();
    await expect(within(dialog).findByTestId("diff-view")).resolves.toBeInTheDocument();
    await expect(within(dialog).findByText(/1 violation/i)).resolves.toBeInTheDocument();
    expect(within(dialog).getByText("Consistency")).toBeInTheDocument();
    expect(within(dialog).getByText("Provenance")).toBeInTheDocument();
  });

  it("publishing from the drawer calls POST publish, refetches, toasts success and closes", async () => {
    stubFetch({
      versionsSequence: [[DRAFT, PUBLISHED], [DRAFT_PUBLISHED, PUBLISHED]],
      diff: () => jsonResponse(200, DIFF_BODY),
      publish: () => jsonResponse(200, { version_iri: DRAFT.version_iri, status: "published" }),
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Review & publish" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish v0.2.0" }));

    await expect(screen.findByText(/v0\.2\.0 published/i)).resolves.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows a publisher-role message inside the drawer on 403 without crashing", async () => {
    stubFetch({
      versionsSequence: [[DRAFT]],
      publish: () => jsonResponse(403, { message: "insufficient role" }),
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Review & publish" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish v0.2.0" }));

    await expect(within(dialog).findByText(/need publisher role/i)).resolves.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("treats 405 (already published) as a success refetch, not an error", async () => {
    stubFetch({
      versionsSequence: [[DRAFT], [DRAFT_PUBLISHED]],
      publish: () => jsonResponse(405, { message: "version is published and immutable" }),
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Review & publish" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish v0.2.0" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText(/need publisher role/i)).not.toBeInTheDocument();
  });

  it("gap-toasts when a release note is entered before publishing", async () => {
    stubFetch({
      versionsSequence: [[DRAFT, PUBLISHED], [DRAFT_PUBLISHED, PUBLISHED]],
      diff: () => jsonResponse(200, DIFF_BODY),
      publish: () => jsonResponse(200, {}),
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Review & publish" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/release note/i), { target: { value: "Fixed the refund flow" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish v0.2.0" }));

    await expect(screen.findByText(/release notes aren't available yet/i)).resolves.toBeInTheDocument();
  });

  it("gap-toasts View diff on canvas from the ExplainBand", async () => {
    stubFetch({ versionsSequence: [[DRAFT, PUBLISHED]], diff: () => jsonResponse(200, DIFF_BODY) });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "View diff on canvas" }));

    await expect(screen.findByText(/explore-canvas linking isn't available yet/i)).resolves.toBeInTheDocument();
  });
});
