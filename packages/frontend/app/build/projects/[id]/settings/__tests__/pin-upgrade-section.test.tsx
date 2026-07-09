import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PinUpgradeSection } from "../pin-upgrade-section";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const EMPTY_DIFF = {
  from_version_iri: "urn:weave:version:v2",
  to_version_iri: "urn:weave:version:v2",
  added: [],
  removed: [],
  modified: [],
  versions: [],
};

const NON_BREAKING_DIFF = {
  from_version_iri: "urn:weave:version:v1",
  to_version_iri: "urn:weave:version:v2",
  added: [{ subject: "urn:s1", predicate: "urn:p1", object: "urn:o1" }],
  removed: [{ subject: "urn:s2", predicate: "urn:p2", object: "urn:o2" }],
  modified: [{ subject: "urn:s3", predicate: "urn:p3", before: "urn:before", after: "urn:after" }],
  versions: [{ version_iri: "urn:weave:version:v2", breaking: false }],
};

const BREAKING_DIFF = {
  ...NON_BREAKING_DIFF,
  versions: [{ version_iri: "urn:weave:version:v2", breaking: true }],
};

async function openDialog(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /review upgrade/i }));
}

describe("PinUpgradeSection", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    HTMLDialogElement.prototype.showModal ??= function mockShowModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close ??= function mockClose(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  });

  it("hides the review-upgrade trigger for a non-admin caller (AC-6)", () => {
    render(<PinUpgradeSection projectId="p-1" canManage={false} />);
    expect(screen.queryByRole("button", { name: /review upgrade/i })).not.toBeInTheDocument();
  });

  it("shows the trigger for an admin and loads the diff on open (AC-1)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(NON_BREAKING_DIFF)));
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/build/projects/p-1/pin-diff");
  });

  it("renders a no-diff empty state when the pin is already latest", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(EMPTY_DIFF)));
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    await waitFor(() => expect(screen.getByText(/up to date/i)).toBeInTheDocument());
  });

  it("shows an alert when CE-DIFF-1 is unavailable (AC-2)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "diff_unavailable" }, 503)));
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("labels each diff row with text, not colour alone", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(NON_BREAKING_DIFF)));
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());
    expect(screen.getByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Removed")).toBeInTheDocument();
    expect(screen.getByText("Changed")).toBeInTheDocument();
  });

  it("requires the breaking acknowledgement before confirm enables (AC-5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(BREAKING_DIFF)));
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    await waitFor(() =>
      expect(screen.getByText(/this upgrade includes breaking changes/i)).toBeInTheDocument()
    );
    const confirmButton = screen.getByRole("button", { name: /^confirm upgrade$/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /breaking change/i }));
    expect(confirmButton).toBeEnabled();
  });

  it("confirms the upgrade with the reviewed version and shows success (AC-4)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(NON_BREAKING_DIFF))
      .mockResolvedValueOnce(jsonResponse({ pinned_graph_version_iri: "urn:weave:version:v2" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();
    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^confirm upgrade$/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/upgraded/i));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/build/projects/p-1/pin-upgrade",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ confirm_version_iri: "urn:weave:version:v2" }),
      })
    );
  });

  it("disables confirm while a submit is in flight, preventing double-submit", async () => {
    let resolvePost!: (value: Response) => void;
    const postPromise = new Promise<Response>((resolve) => {
      resolvePost = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(NON_BREAKING_DIFF))
      .mockReturnValueOnce(postPromise);
    vi.stubGlobal("fetch", fetchMock);
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();
    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());

    const confirmButton = screen.getByRole("button", { name: /^confirm upgrade$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(confirmButton).toHaveAttribute("aria-busy", "true");

    // second click while confirming must not fire a second POST (no double-submit)
    fireEvent.click(confirmButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolvePost(jsonResponse({ pinned_graph_version_iri: "urn:weave:version:v2" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/upgraded/i));
  });

  it("resets to a clean error state when confirm fails for a non-409 reason", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(NON_BREAKING_DIFF))
      .mockResolvedValueOnce(jsonResponse({ error: "internal_error" }, 500));
    vi.stubGlobal("fetch", fetchMock);
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();
    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^confirm upgrade$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    // clean reset, not stuck mid-submit: no leftover conflict/success text, confirm re-enabled
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm upgrade$/i })).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });

  it("shows an alert on a network failure while loading the diff", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("shows a conflict message and re-fetches the diff on 409 (AC-3)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(NON_BREAKING_DIFF))
      .mockResolvedValueOnce(
        jsonResponse({ error: "pin_moved", latest_version_iri: "urn:weave:version:v3" }, 409)
      )
      .mockResolvedValueOnce(jsonResponse({ ...NON_BREAKING_DIFF, to_version_iri: "urn:weave:version:v3" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PinUpgradeSection projectId="p-1" canManage={true} />);

    await openDialog();
    await waitFor(() => expect(screen.getByText(/urn:s1/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^confirm upgrade$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/changed again/i));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
