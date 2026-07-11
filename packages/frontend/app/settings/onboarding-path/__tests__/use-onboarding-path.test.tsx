import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useOnboardingPath } from "../use-onboarding-path";

function stubFetch(response: Response): void {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

const resolvedBody = {
  role_path: "business",
  path_variant: "default",
  path_chosen_manually: false,
  needs_choice: false,
};

describe("useOnboardingPath (AC-006-04)", () => {
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

  it("loads the resolved path on mount", async () => {
    const { result } = renderHook(() => useOnboardingPath());

    await waitFor(() => expect(result.current.path).not.toBeNull());

    expect(result.current.path?.role_path).toBe("business");
    expect(result.current.loadError).toBe(false);
  });

  it("flags a load error without throwing", async () => {
    stubFetch(new Response("nope", { status: 500 }));

    const { result } = renderHook(() => useOnboardingPath());

    await waitFor(() => expect(result.current.loadError).toBe(true));
    expect(result.current.path).toBeNull();
  });

  it("changePath PUTs the new path and updates state on success", async () => {
    const { result } = renderHook(() => useOnboardingPath());
    await waitFor(() => expect(result.current.path).not.toBeNull());

    stubFetch(
      new Response(
        JSON.stringify({ ...resolvedBody, role_path: "technical", path_chosen_manually: true }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await act(async () => {
      await result.current.changePath("technical");
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/onboarding/path",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ role_path: "technical" }),
      })
    );
    expect(result.current.path?.role_path).toBe("technical");
    expect(result.current.path?.path_chosen_manually).toBe(true);
  });
});
