import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RelKind } from "@/lib/explorer/types";

import { useRelTypes } from "../use-rel-types";

describe("useRelTypes", () => {
  it("fetches the relationship-type palette once on mount", async () => {
    const relTypes: RelKind[] = [{ id: "performs", label: "Performs" }];
    const fetchRelTypes = vi.fn(async () => relTypes);
    const { result } = renderHook(() => useRelTypes(fetchRelTypes));
    await waitFor(() => expect(result.current).toEqual(relTypes));
    expect(fetchRelTypes).toHaveBeenCalledTimes(1);
  });
});
