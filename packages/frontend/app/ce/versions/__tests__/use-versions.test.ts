import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVersions } from "../use-versions";
import type { VersionEntry } from "../types";

const VERSION: VersionEntry = {
  version_iri: "urn:workspace:demo:v1",
  semver: "0.1.0",
  status: "published",
  created_at: "2026-07-01T10:00:00Z",
  published_at: "2026-07-01T10:05:00Z",
  actor_iri: "urn:weave:user:client",
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useVersions", () => {
  // Bug 4: the proxy returns a bare VersionEntry[] (unwrapped for the
  // Explorer VersionsPanel), not the `{ versions: [...] }` envelope.
  it("populates versions from a bare array response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [VERSION])));

    const { result } = renderHook(() => useVersions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.versions).toEqual([VERSION]);
    expect(result.current.error).toBe(false);
  });

  it("still populates versions from a wrapped { versions } envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { versions: [VERSION] })));

    const { result } = renderHook(() => useVersions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.versions).toEqual([VERSION]);
  });

  it("defaults to an empty list when the body has neither shape", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, {})));

    const { result } = renderHook(() => useVersions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.versions).toEqual([]);
  });
});
