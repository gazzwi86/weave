import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSettingsPanel } from "../project-settings-panel";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SETTINGS = {
  model_tier: "standard",
  model_tier_source: "company",
  cost_cap_usd: 50,
  cost_cap_source: "company",
};

const CONTRIBUTORS = { items: [] };

function stubFetchSequence(...responses: Response[]): void {
  const fetchMock = vi.fn();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
}

describe("ProjectSettingsPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders the resolved governance cascade (AC-2)", async () => {
    stubFetchSequence(jsonResponse(SETTINGS), jsonResponse(CONTRIBUTORS));
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    expect(screen.getAllByText(/company/i).length).toBeGreaterThan(0);
  });

  it("saves a governance change via PATCH and shows a success message (AC-2)", async () => {
    stubFetchSequence(
      jsonResponse(SETTINGS),
      jsonResponse(CONTRIBUTORS),
      jsonResponse({ ...SETTINGS, model_tier: "premium" })
    );
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Model tier"), { target: { value: "premium" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/build/projects/p-1/settings",
        expect.objectContaining({ method: "PATCH" })
      )
    );
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument());
  });

  it("shows the cascade level on a cap_looser_than_parent 422 (AC-3)", async () => {
    stubFetchSequence(
      jsonResponse(SETTINGS),
      jsonResponse(CONTRIBUTORS),
      jsonResponse({ error: "cap_looser_than_parent", level: "company", parent_cap_usd: 25 }, 422)
    );
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Cost cap (USD)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/company/i)
    );
    const costCapInput = screen.getByLabelText("Cost cap (USD)");
    expect(costCapInput).toHaveAttribute("aria-invalid", "true");
    expect(costCapInput).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
  });

  it("surfaces the 503 project-scope-settings-unavailable error (AC-3)", async () => {
    stubFetchSequence(
      jsonResponse(SETTINGS),
      jsonResponse(CONTRIBUTORS),
      jsonResponse({ error: "project_scope_settings_unavailable" }, 503)
    );
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i)
    );
    expect(screen.getByLabelText("Cost cap (USD)")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("renders governance read-only and hides Save for a non-admin caller (AC-4)", async () => {
    stubFetchSequence(
      jsonResponse(SETTINGS),
      jsonResponse({ items: [{ principal_iri: "urn:weave:principal:user:client", role: "editor" }] })
    );
    render(
      <ProjectSettingsPanel
        projectId="p-1"
        tenantRole="author"
        principalIri="urn:weave:principal:user:client"
      />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    expect(screen.getByLabelText("Model tier")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("shows the pin-upgrade trigger on Governance for an admin (AC-6, TASK-016)", async () => {
    stubFetchSequence(jsonResponse(SETTINGS), jsonResponse(CONTRIBUTORS));
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /review upgrade/i })).toBeInTheDocument();
  });

  it("hides the pin-upgrade trigger for a non-admin (AC-6, TASK-016)", async () => {
    stubFetchSequence(
      jsonResponse(SETTINGS),
      jsonResponse({ items: [{ principal_iri: "urn:weave:principal:user:client", role: "editor" }] })
    );
    render(
      <ProjectSettingsPanel
        projectId="p-1"
        tenantRole="author"
        principalIri="urn:weave:principal:user:client"
      />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /review upgrade/i })).not.toBeInTheDocument();
  });

  it("renders three bindable system cards for an admin (AC-7, TASK-022)", async () => {
    stubFetchSequence(jsonResponse(SETTINGS), jsonResponse(CONTRIBUTORS), jsonResponse({ items: [] }));
    render(
      <ProjectSettingsPanel projectId="p-1" tenantRole="admin" principalIri="urn:weave:principal:user:owner" />
    );

    await waitFor(() => expect(screen.getByDisplayValue("standard")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Connections" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Bind Confluence" })).toBeInTheDocument()
    );
    expect(screen.getByText("Confluence")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.getByText("ServiceNow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bind Jira" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bind ServiceNow" })).toBeInTheDocument();
  });
});
