import { NextResponse } from "next/server";

/** Forwards a validated request to the backend with the caller's bearer
 * token, normalising network/non-JSON failures to a 502 envelope. Shared
 * by every `/api/build/**` proxy route (TASK-015) -- mirrors the
 * fetch/error-shape pattern already used by `app/api/tenancy/workspaces`.
 */
export async function forwardToBackend(
  path: string,
  token: string,
  init?: RequestInit
): Promise<NextResponse> {
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  let upstream: Response;
  try {
    upstream = await fetch(`${backendUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "upstream_unavailable" }, { status: 502 });
  }
  const body = (await upstream.json()) as unknown;
  return NextResponse.json(unwrapErrorEnvelope(body, upstream.status), { status: upstream.status });
}

/** Every route this helper serves raises `HTTPException(detail={...})`,
 * which Starlette always nests under a `detail` key -- unwrap it once here
 * (only for non-2xx responses, so a legitimate 2xx body that happens to
 * have its own `detail` field is left alone) instead of every route
 * re-implementing the same unwrap. */
function unwrapErrorEnvelope(body: unknown, status: number): unknown {
  if (status < 400 || typeof body !== "object" || body === null || !("detail" in body)) {
    return body;
  }
  return (body as { detail: unknown }).detail;
}
