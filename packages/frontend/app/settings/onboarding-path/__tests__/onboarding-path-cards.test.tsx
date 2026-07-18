import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingPathCards } from "../onboarding-path-cards";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const BASE_PATH = {
  role_path: "business",
  path_variant: "default",
  path_chosen_manually: false,
  needs_choice: false,
};

describe("OnboardingPathCards (mock #sub-set-onboarding)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders all 4 path cards with the current one badged (AC-006-04)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(BASE_PATH)));

    render(<OnboardingPathCards />);

    await waitFor(() => expect(screen.getByText("Model the business")).toBeInTheDocument());
    expect(screen.getByText("Build with Weave")).toBeInTheDocument();
    expect(screen.getByText("Operate & approve")).toBeInTheDocument();
    expect(screen.getByText("Observe & audit")).toBeInTheDocument();

    const currentCard = screen.getByText("Model the business").closest("button");
    expect(currentCard).not.toBeNull();
    expect(currentCard).toHaveTextContent("current");
  });

  it("clicking another card PUTs the new role_path and moves the badge (AC-006-04)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonResponse({ ...BASE_PATH, role_path: "technical", path_chosen_manually: true });
      }
      return jsonResponse(BASE_PATH);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingPathCards />);
    await waitFor(() => expect(screen.getByText("Build with Weave")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Build with Weave").closest("button") as HTMLElement);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding/path",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ role_path: "technical" }) })
      )
    );
    await waitFor(() => expect(screen.getByText("Build with Weave").closest("button")).toHaveTextContent("current"));
  });

  it("clicking the already-current card issues no PUT", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(BASE_PATH));
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingPathCards />);
    await waitFor(() => expect(screen.getByText("Model the business")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Model the business").closest("button") as HTMLElement);

    expect(fetchMock).not.toHaveBeenCalledWith("/api/onboarding/path", expect.objectContaining({ method: "PUT" }));
  });

  it("restart-tour button resets the platform tour's stored progress", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return jsonResponse({ saved: true });
      return jsonResponse(BASE_PATH);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<OnboardingPathCards />);
    await waitFor(() => expect(screen.getByText("Model the business")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /restart the guided tour/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/onboarding/tours/tour.plat.role-home/progress",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ last_completed_step: 0, completed: false, skipped: false }),
        })
      )
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/tour progress reset/i));
  });

  it("shows a load-error message when the path fails to load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));

    render(<OnboardingPathCards />);

    await waitFor(() => expect(screen.getByTestId("onboarding-path-error")).toBeInTheDocument());
  });
});
