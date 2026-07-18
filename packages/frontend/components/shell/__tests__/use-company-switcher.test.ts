import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCompanySwitcher } from "../use-company-switcher";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
}

describe("useCompanySwitcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch until refresh() is called", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useCompanySwitcher(true));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refresh() loads the workspace list and the active id when enabled", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/active")) return jsonResponse({ workspace_id: "ws-hammerbarn" });
      return jsonResponse([
        { id: "ws-hammerbarn", slug: "hammerbarn", display_name: "Hammerbarn" },
        { id: "ws-acme", slug: "acme", display_name: "Acme Industrial" },
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCompanySwitcher(true));
    act(() => result.current.refresh());
    await flushMicrotasks();

    expect(result.current.companies).toEqual([
      { id: "ws-hammerbarn", name: "Hammerbarn" },
      { id: "ws-acme", name: "Acme Industrial" },
    ]);
    expect(result.current.activeId).toBe("ws-hammerbarn");
    expect(result.current.error).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("refresh() is a no-op when disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCompanySwitcher(false));
    act(() => result.current.refresh());
    await flushMicrotasks();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when a fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, { status: 500 }))
    );

    const { result } = renderHook(() => useCompanySwitcher(true));
    act(() => result.current.refresh());
    await flushMicrotasks();

    expect(result.current.error).toBe(true);
  });

  it("switchTo posts to the switch endpoint and reloads", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ workspace_id: "ws-acme" }));
    vi.stubGlobal("fetch", fetchMock);
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, reload }, writable: true });

    const { result } = renderHook(() => useCompanySwitcher(true));
    await act(async () => {
      await result.current.switchTo("ws-acme");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/tenancy/workspaces/ws-acme/switch", { method: "POST" });
    expect(reload).toHaveBeenCalled();
  });
});
