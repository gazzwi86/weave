// jsdom's File isn't the same class NextRequest's undici-based FormData
// parsing checks against -- this proxy exercises real multipart bodies, so
// it needs Node's native File/FormData.
// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { POST } from "../route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

function makeUploadRequest(form: FormData): NextRequest {
  return new NextRequest("http://localhost:3000/api/ingest/artefacts", {
    method: "POST",
    body: form,
  });
}

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    )
  );
}

describe("POST /api/ingest/artefacts", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    stubFetch({}, 201);
  });

  it("returns 401 when no session", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const form = new FormData();
    form.set("file", new File(["hi"], "notes.md", { type: "text/markdown" }));

    const response = await POST(makeUploadRequest(form));

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is attached", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    const form = new FormData();
    form.set("owner", "alice");

    const response = await POST(makeUploadRequest(form));

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the file and optional context fields as multipart to the backend", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ artefact_iri: "urn:weave:artefact:1", job_id: "job-1" }, 201);
    const form = new FormData();
    form.set("file", new File(["# Title"], "runbook.md", { type: "text/markdown" }));
    form.set("owner", "alice");

    const response = await POST(makeUploadRequest(form));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ artefact_iri: "urn:weave:artefact:1", job_id: "job-1" });
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8000/api/ingest/artefacts");
    expect(init.headers).toMatchObject({ Authorization: "Bearer token-abc" });
    const forwarded = init.body as FormData;
    expect((forwarded.get("file") as File).name).toBe("runbook.md");
    expect(forwarded.get("owner")).toBe("alice");
  });

  it("passes a 503 model_unavailable response straight through (AC-002-06)", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: "token-abc" } as never);
    stubFetch({ error: "model_unavailable" }, 503);
    const form = new FormData();
    form.set("file", new File(["hi"], "notes.md", { type: "text/markdown" }));

    const response = await POST(makeUploadRequest(form));

    expect(response.status).toBe(503);
  });
});
