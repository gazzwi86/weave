import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";

import { GET as getTasks } from "../route";
import { GET as getTask } from "../[taskId]/route";
import { GET as getAudit } from "../[taskId]/audit/route";
import { GET as getConsoleLog } from "../[taskId]/console-log/route";
import { GET as getCaptures } from "../[taskId]/captures/route";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

const TOKEN = `header.${Buffer.from(
  JSON.stringify({ tenant_id: "tenant-1", role: "admin" })
).toString("base64url")}.sig`;

function stubFetch(body: unknown, status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        })
    )
  );
}

function taskParams(): { params: Promise<{ id: string; taskId: string }> } {
  return { params: Promise.resolve({ id: "p-1", taskId: "task-1" }) };
}

function projectParams(): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: "p-1" }) };
}

describe("BE-V1-TASK-018 task-detail proxy routes", () => {
  beforeEach(() => {
    vi.mocked(auth).mockReset();
    vi.unstubAllGlobals();
  });

  it("returns 401 with no session on every route", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    stubFetch({}, 200);
    const req = new NextRequest("http://localhost:3000/x");
    expect((await getTasks(req, projectParams())).status).toBe(401);
    expect((await getTask(req, taskParams())).status).toBe(401);
    expect((await getAudit(req, taskParams())).status).toBe(401);
    expect((await getConsoleLog(req, taskParams())).status).toBe(401);
    expect((await getCaptures(req, taskParams())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("forwards the task list to GET /api/state/{project_iri}", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ tasks: [] }, 200);
    const response = await getTasks(new NextRequest("http://localhost:3000/x"), projectParams());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/state/p-1"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    );
    expect(response.status).toBe(200);
  });

  it("forwards the task detail read", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ brief: null, handoff: [] }, 200);
    await getTask(new NextRequest("http://localhost:3000/x"), taskParams());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/tasks/task-1"),
      expect.anything()
    );
  });

  it("forwards the audit proxy, including a 503 audit_unavailable body", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ error: "audit_unavailable" }, 503);
    const response = await getAudit(new NextRequest("http://localhost:3000/x"), taskParams());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/tasks/task-1/audit"),
      expect.anything()
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "audit_unavailable" });
  });

  it("forwards the console-log content read", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ log: null }, 200);
    await getConsoleLog(new NextRequest("http://localhost:3000/x"), taskParams());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/tasks/task-1/console-log"),
      expect.anything()
    );
  });

  it("forwards the captures content read", async () => {
    vi.mocked(auth).mockResolvedValue({ accessToken: TOKEN } as never);
    stubFetch({ manifest: null }, 200);
    await getCaptures(new NextRequest("http://localhost:3000/x"), taskParams());
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/projects/p-1/tasks/task-1/captures"),
      expect.anything()
    );
  });
});
