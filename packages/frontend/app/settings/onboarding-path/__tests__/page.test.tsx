import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingPathSettingsPage from "../page";

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const resolvedBody = {
  role_path: "business",
  path_variant: "default",
  path_chosen_manually: false,
  needs_choice: false,
};

describe("OnboardingPathSettingsPage (AC-006-04)", () => {
  beforeEach(() => {
    stubFetch(
      new Response(JSON.stringify(resolvedBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the current path and a way to change it", async () => {
    render(<OnboardingPathSettingsPage />);

    await waitFor(() => expect(screen.getByText(/business/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /change/i })).toBeInTheDocument();
  });

  it("opens the picker, choosing a new path persists it and closes the dialog", async () => {
    render(<OnboardingPathSettingsPage />);
    await waitFor(() => expect(screen.getByText(/business/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /change/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    stubFetch(
      new Response(
        JSON.stringify({ ...resolvedBody, role_path: "technical", path_chosen_manually: true }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Technical" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/technical/i)).toBeInTheDocument();
  });
});
