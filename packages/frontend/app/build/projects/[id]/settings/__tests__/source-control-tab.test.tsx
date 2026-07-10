import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SourceControlTab } from "../source-control-tab";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CONFIG = {
  provider: "github",
  token_secret_ref: "weave/tenant-1/scm/acme/github/token",
  configured_by: "urn:weave:principal:user:admin",
  configured_at: "2026-07-01T00:00:00Z",
};

const SENTINEL_TOKEN_VALUE = "ghp_should-never-render-9f2c1a";

describe("SourceControlTab", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("should render config with reference name and no reveal affordance", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(CONFIG)));
    render(<SourceControlTab projectId="p-1" canManage={false} />);

    await waitFor(() =>
      expect(screen.getByText("weave/tenant-1/scm/acme/github/token")).toBeInTheDocument()
    );
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reveal|show/i })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(/./)).not.toBeInTheDocument(); // no token value anywhere
  });

  it("should render unconfigured setup state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "not_found" }, 404)));
    render(<SourceControlTab projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
    expect(screen.getByText(/fails closed/i)).toBeInTheDocument();
  });

  it("hides the configure form for a non-admin caller (server 403 is the real boundary)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "not_found" }, 404)));
    render(<SourceControlTab projectId="p-1" canManage={false} />);

    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());
    expect(screen.queryByLabelText(/provider/i)).not.toBeInTheDocument();
  });

  it("admin configures provider + token end to end and the field clears after submit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not_found" }, 404))
      .mockResolvedValueOnce(jsonResponse(CONFIG, 200))
      .mockResolvedValueOnce(jsonResponse(CONFIG, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<SourceControlTab projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "github" } });
    const tokenField = screen.getByLabelText(/token/i) as HTMLInputElement;
    fireEvent.change(tokenField, { target: { value: SENTINEL_TOKEN_VALUE } });
    fireEvent.click(screen.getByRole("button", { name: /configure|save/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/build/projects/p-1/source-control",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ provider: "github", token: SENTINEL_TOKEN_VALUE }),
        })
      )
    );
    await waitFor(() =>
      expect(screen.getByText("weave/tenant-1/scm/acme/github/token")).toBeInTheDocument()
    );
    expect(screen.queryByDisplayValue(SENTINEL_TOKEN_VALUE)).not.toBeInTheDocument();
  });

  it("shows a write-failure message and never echoes the token when the save fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "not_found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: "upstream_unavailable" }, 502));
    vi.stubGlobal("fetch", fetchMock);

    render(<SourceControlTab projectId="p-1" canManage={true} />);
    await waitFor(() => expect(screen.getByText(/not configured/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: SENTINEL_TOKEN_VALUE } });
    fireEvent.click(screen.getByRole("button", { name: /configure|save/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText(SENTINEL_TOKEN_VALUE)).not.toBeInTheDocument();
  });
});
