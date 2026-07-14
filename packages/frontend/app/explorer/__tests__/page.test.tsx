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

describe("ExplorerPage", () => {
  it("renders the page heading and mounts the client-only canvas loader", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    render(await ExplorerPage());

    expect(screen.getByRole("heading", { name: "Graph Explorer" })).toBeInTheDocument();
    expect(screen.getByTestId("explorer-canvas-loader-stub")).toBeInTheDocument();
  });
});
