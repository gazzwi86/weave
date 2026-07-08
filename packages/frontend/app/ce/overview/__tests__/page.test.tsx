import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CeOverviewPage from "../page";

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
    { version_iri: "urn:v2", semver: "1.2.0", status: "published", created_at: "", published_at: "2026-07-01", actor_iri: "urn:u" },
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

describe("CeOverviewPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders per-kind instance counts, totals, and unused-kind line", async () => {
    stubFetch();

    render(<CeOverviewPage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.getByTestId("kind-list")).toHaveTextContent("Process2");
    expect(screen.getByTestId("kind-list")).toHaveTextContent("Role1");
    expect(screen.getByTestId("kind-list")).not.toHaveTextContent("System");
    expect(screen.getByTestId("unused-kinds")).toHaveTextContent("1 kind unused yet");
    expect(screen.getByTestId("totals")).toHaveTextContent("Total: 3 instances · 4 triples loaded");
    expect(screen.getByTestId("published-version")).toHaveTextContent("v1.2.0");
  });

  it("renders quick links to explorer, query, instances, and audit", async () => {
    stubFetch();

    render(<CeOverviewPage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explorer");
    expect(screen.getByRole("link", { name: "Query" })).toHaveAttribute("href", "/ce/query");
    expect(screen.getByRole("link", { name: "Instances" })).toHaveAttribute("href", "/ce");
    expect(screen.getByRole("link", { name: "Audit trail" })).toHaveAttribute("href", "/audit");
  });

  it("omits the version label when no published version exists", async () => {
    stubFetch({ versions: jsonResponse({ versions: [] }) });

    render(<CeOverviewPage />);

    await waitFor(() => expect(screen.getByTestId("kind-list")).toBeInTheDocument());
    expect(screen.queryByTestId("published-version")).not.toBeInTheDocument();
  });

  it("shows a muted error when the triples fetch fails", async () => {
    stubFetch({ sparql: jsonResponse({ error: "store_unavailable" }, 503) });

    render(<CeOverviewPage />);

    await waitFor(() => expect(screen.getByTestId("overview-error")).toBeInTheDocument());
    expect(screen.queryByTestId("kind-list")).not.toBeInTheDocument();
  });
});
