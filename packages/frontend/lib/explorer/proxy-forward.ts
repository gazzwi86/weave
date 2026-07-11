import { NextResponse } from "next/server";

/** Shared by the TASK-026 proxy routes (views/comments/events) -- same
 * network/non-JSON-failure collapse as app/api/proxy/layout-positions'
 * local `forward()`, plus unwrapping FastAPI's `{"detail": {...}}`
 * envelope (every backend route here raises `HTTPException(detail={...})`,
 * e.g. the AC-1 409 `name_collision` body) so callers read `body.error`
 * directly instead of `body.detail.error`. */
export async function forward(upstream: Promise<Response>): Promise<NextResponse> {
  let response: Response;
  try {
    response = await upstream;
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
  const body = (await response.json()) as unknown;
  return NextResponse.json(unwrapErrorEnvelope(body, response.status), { status: response.status });
}

function unwrapErrorEnvelope(body: unknown, status: number): unknown {
  if (status < 400 || typeof body !== "object" || body === null || !("detail" in body)) {
    return body;
  }
  return (body as { detail: unknown }).detail;
}

export function unauthorised(): NextResponse {
  return NextResponse.json({ error: "unauthorised" }, { status: 401 });
}

export function backendUrl(): string {
  return process.env.BACKEND_API_URL ?? "http://localhost:8000";
}
