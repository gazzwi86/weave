import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import ExplorerPage from "../page";

// Same boundary mock as app/dashboard/__tests__/page.test.tsx and
// app/role-home/__tests__/page.test.tsx -- ExplorerPage is an async server
// component that calls auth() (TASK-023 AC-7 role resolution), so the real
// next-auth server module must never load under vitest/jsdom.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("@/components/explorer/explorer-canvas-loader", () => ({
  ExplorerCanvasLoader: () => <div data-testid="explorer-canvas-loader-stub" />,
}));

// ONB-V1-TASK-002: real ExplorerTour needs the TourEngine/Driver.js stack
// mounted with real DOM anchors -- covered by its own test file. Here we
// only assert the page wires the resolved `?tour=` param through to it.
vi.mock("@/components/explorer/explorer-tour", () => ({
  ExplorerTour: ({ tourParam }: { tourParam: string | null }) => (
    <div data-testid="explorer-tour-stub">{tourParam ?? "none"}</div>
  ),
}));

describe("ExplorerPage", () => {
  it("mounts the canvas loader with a visually-hidden heading (mock shows no visible title; a11y needs an h1)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    render(await ExplorerPage({ searchParams: Promise.resolve({}) }));

    // The heading exists for a11y (axe page-has-heading-one) but is sr-only --
    // no VISIBLE page title, matching the mock's frame-filling canvas.
    const heading = screen.getByRole("heading", { name: "Graph Explorer" });
    expect(heading).toHaveClass("sr-only");
    expect(screen.getByTestId("explorer-canvas-loader-stub")).toBeInTheDocument();
    expect(screen.getByTestId("explorer-tour-stub")).toHaveTextContent("none");
  });

  it("passes the ?tour= query param through to ExplorerTour (AC-002-01 help-launcher deep-link)", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    render(await ExplorerPage({ searchParams: Promise.resolve({ tour: "completeness-map" }) }));

    expect(screen.getByTestId("explorer-tour-stub")).toHaveTextContent("completeness-map");
  });
});
