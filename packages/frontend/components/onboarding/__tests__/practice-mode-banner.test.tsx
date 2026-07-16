import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PracticeModeBanner } from "../practice-mode-banner";

function stubState(body: { sandbox_forked_at: string | null; sandbox_batch_semver?: string | null }) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
}

afterEach(() => vi.unstubAllGlobals());

describe("PracticeModeBanner", () => {
  it("renders nothing outside a sandbox", async () => {
    stubState({ sandbox_forked_at: null });
    const { container } = render(<PracticeModeBanner />);
    // Give the state fetch a tick; banner must stay absent.
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the demo version and a reset control when in a sandbox", async () => {
    stubState({ sandbox_forked_at: "2026-07-16T10:00:00Z", sandbox_batch_semver: "1.4.0" });
    render(<PracticeModeBanner />);
    expect(await screen.findByText("Practice mode")).toBeInTheDocument();
    expect(screen.getByText("demo v1.4.0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset demo" })).toBeInTheDocument();
  });
});
