import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import CePage from "../page";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

const KINDS = {
  kinds: [
    { id: "Process", label: "Process", colour: "#22d3ee" },
    { id: "Role", label: "Role", colour: "#a78bfa" },
    { id: "System", label: "System", colour: "#34d399" },
  ],
};

const SPARQL_PAGE = {
  rows: [
    { subject: "urn:a", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" },
    { subject: "urn:b", predicate: RDF_TYPE, object: "https://weave.io/ontology/Process" },
    { subject: "urn:c", predicate: RDF_TYPE, object: "https://weave.io/ontology/Role" },
    { subject: "urn:a", predicate: "https://weave.io/ontology/ownedBy", object: "urn:c" },
  ],
  columns: ["subject", "predicate", "object"],
  has_more_pages: false,
  page: 0,
};

const VERSIONS = {
  versions: [
    { version_iri: "urn:v2", semver: "1.2.0", status: "published", created_at: "", published_at: "2026-07-01T00:00:00Z", actor_iri: "urn:u" },
    { version_iri: "urn:v1", semver: "1.1.0", status: "published", created_at: "", published_at: "2026-06-01T00:00:00Z", actor_iri: "urn:u" },
  ],
};

function stubFetch(overrides: Partial<Record<"node-kinds" | "sparql" | "versions", Response>> = {}): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("node-kinds")) return overrides["node-kinds"] ?? jsonResponse(KINDS);
      if (url.includes("sparql")) return overrides.sparql ?? jsonResponse(SPARQL_PAGE);
      if (url.includes("versions")) return overrides.versions ?? jsonResponse(VERSIONS);
      throw new Error(`unexpected fetch: ${url}`);
    })
  );
}

describe("CePage (Constitution overview landing)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("has no axe violations", async () => {
    stubFetch();
    const { container } = render(<CePage />);
    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect((await axe(container)).violations).toHaveLength(0);
  });

  it("renders the eyebrow + title and an explain band", async () => {
    stubFetch();
    render(<CePage />);
    expect(screen.getByText("Constitution")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByText(/How the Constitution works/)).toBeInTheDocument();
  });

  it("renders per-kind instance counts, KPI totals, and unused-kind line", async () => {
    stubFetch();

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.getByTestId("kind-list")).toHaveTextContent("Process2");
    expect(screen.getByTestId("kind-list")).toHaveTextContent("Role1");
    expect(screen.getByTestId("kind-list")).not.toHaveTextContent("System");
    expect(screen.getByTestId("unused-kinds")).toHaveTextContent("1 kind unused yet");
    // "Instances" appears twice — the KPI label (<p>) and the quick-link (<a>);
    // scope to the KPI paragraph so the count assertion isn't ambiguous.
    expect(screen.getByText("Instances", { selector: "p" }).parentElement).toHaveTextContent("3");
    expect(screen.getByText("Triples loaded").parentElement).toHaveTextContent("4");
    expect(screen.getByText("Published version").parentElement).toHaveTextContent("v1.2.0");
  });

  it("renders the most recent published versions, newest first", async () => {
    stubFetch();

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("recent-versions")).toBeInTheDocument());
    const versionText = screen.getByTestId("recent-versions").textContent ?? "";
    expect(versionText.indexOf("v1.2.0")).toBeLessThan(versionText.indexOf("v1.1.0"));
  });

  it("shows an empty state when there are no published versions", async () => {
    stubFetch({ versions: jsonResponse({ versions: [] }) });

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("no-versions")).toBeInTheDocument());
    expect(screen.getByText("Published version").parentElement).toHaveTextContent("No data yet");
  });

  it("shows a tasteful placeholder for rules/violations (no fabricated count)", async () => {
    stubFetch();

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("rules-placeholder")).toBeInTheDocument());
  });

  it("renders quick links to explorer, query, instances, and audit", async () => {
    stubFetch();

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explorer");
    expect(screen.getByRole("link", { name: "Query" })).toHaveAttribute("href", "/ce/query");
    expect(screen.getByRole("link", { name: "Instances" })).toHaveAttribute("href", "/ce/instances");
    expect(screen.getByRole("link", { name: "Audit trail" })).toHaveAttribute("href", "/audit");
  });

  it("shows a muted error when the triples fetch fails", async () => {
    stubFetch({ sparql: jsonResponse({ error: "store_unavailable" }, 503) });

    render(<CePage />);

    await waitFor(() => expect(screen.getByTestId("overview-error")).toBeInTheDocument());
    expect(screen.queryByTestId("kind-list")).not.toBeInTheDocument();
  });

  it("does not render a raw file upload input on the landing", async () => {
    stubFetch();
    render(<CePage />);
    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });
});
