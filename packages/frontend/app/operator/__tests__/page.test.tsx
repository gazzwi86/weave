import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

import OperatorPage from "../page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/auth/session-claims", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/session-claims")>()),
  getSessionClaims: vi.fn(),
}));

describe("OperatorPage (super-admin gate)", () => {
  it("renders the operator console for a platform operator (role admin)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.mocked(getSessionClaims).mockReturnValue({ role: "admin", tenantId: "tenant-1" });

    render(await OperatorPage());

    expect(screen.getByRole("heading", { name: "Companies" })).toBeInTheDocument();
    expect(screen.queryByTestId("operator-denied")).not.toBeInTheDocument();
  });

  it("denies a non-operator (role author) with a message, no console", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    vi.mocked(getSessionClaims).mockReturnValue({ role: "author", tenantId: "tenant-1" });

    render(await OperatorPage());

    expect(screen.getByTestId("operator-denied")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Companies" })).not.toBeInTheDocument();
  });
});
