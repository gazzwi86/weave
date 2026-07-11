import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchOntologyTypes } from "../fetch-ontology-types";

function stubFetch(response: Response | (() => never)): void {
  vi.stubGlobal("fetch", vi.fn(typeof response === "function" ? response : async () => response));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOntologyTypes (TASK-028 AC-2)", () => {
  it("returns kinds + relationships on success", async () => {
    stubFetch(
      new Response(JSON.stringify({ kinds: [], relationships: [{ path: "https://weave.io/ontology/dependsOn" }] }), {
        status: 200,
      }),
    );

    const result = await fetchOntologyTypes(5000);

    expect(result).toEqual({ type: "ok", relationships: [{ path: "https://weave.io/ontology/dependsOn" }] });
  });

  it("never throws on an HTTP error -- resolves to a typed error", async () => {
    stubFetch(new Response(JSON.stringify({ error: "unauthorised" }), { status: 401 }));

    const result = await fetchOntologyTypes(5000);

    expect(result).toEqual({ type: "error", status: 401 });
  });

  it("never throws on a network failure -- resolves to a typed error", async () => {
    stubFetch(() => {
      throw new Error("ECONNREFUSED");
    });

    const result = await fetchOntologyTypes(5000);

    expect(result).toEqual({ type: "error", status: 0 });
  });
});
