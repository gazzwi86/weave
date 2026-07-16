import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

// ONB-TASK-008: shared proxy plumbing, extracted from TASK-006's
// path/route.ts pattern -- now reused by state + dismissal routes too.
export const backendUrl = (): string => backendApiUrl();

export function proxyJson(upstream: Response): Promise<NextResponse> {
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return Promise.resolve(NextResponse.json({ error: "upstream_unavailable" }, { status: 502 }));
  }
  return upstream.json().then((body: unknown) => NextResponse.json(body, { status: upstream.status }));
}

/** Resolves the caller's bearer token, or `null` if unauthenticated. */
export async function requireBearerToken(): Promise<string | null> {
  const session = await auth();
  return session?.accessToken ?? null;
}

export async function fetchUpstream(path: string, init: RequestInit, token: string): Promise<Response | null> {
  try {
    return await fetch(`${backendUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
