import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ProjectDecisionsPage from "../page";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("ProjectDecisionsPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // B4: reached from the left nav (refit-mock #sub-bld-decisions), not a
  // settings sub-page -- the "Back to settings" link didn't belong here.
  it("B4: renders the decision log without a stray Back to settings link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ entries: [], next_cursor: null }))
    );

    const page = await ProjectDecisionsPage({ params: Promise.resolve({ id: "p-1" }) });
    render(page);

    expect(screen.getByRole("heading", { name: "Decision log" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("decisions-empty")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Back to settings" })).not.toBeInTheDocument();
  });
});
