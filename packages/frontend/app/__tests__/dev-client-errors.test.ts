import { describe, expect, it } from "vitest";

import { POST } from "../api/dev/client-errors/route";

const post = (body: string) =>
  POST(new Request("http://localhost/api/dev/client-errors", { method: "POST", body }));

describe("dev client-errors sink", () => {
  it("rejects oversized payloads", async () => {
    const res = await post("x".repeat(20_000));
    expect(res.status).toBe(413);
  });

  it("rejects non-JSON payloads", async () => {
    const res = await post("not json {");
    expect(res.status).toBe(400);
  });
});
