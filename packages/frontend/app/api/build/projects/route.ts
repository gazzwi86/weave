import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: request body is untrusted input. Mirrors weave_backend's
// CreateProjectRequest (schemas/projects.py) -- name required, max 120.
const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().nullish(),
  source_control: z
    .object({
      provider: z.enum(["github", "gitlab"]),
      token_secret_ref: z.string().min(1),
    })
    .nullish(),
});

// Query params are client-supplied (filter bar), so validated the same way.
const gridQuerySchema = z.object({
  lifecycle_phase: z.enum(["Speccing", "Building", "Live monitoring", "Archived"]).nullish(),
  owner: z.string().nullish(),
  search: z.string().nullish(),
  cursor: z.string().nullish(),
  limit: z.coerce.number().int().min(1).max(100).nullish(),
});

async function resolveSession(): Promise<{ token: string } | null> {
  const session = await auth();
  if (!session?.accessToken) return null;
  const { tenantId } = getSessionClaims(session.accessToken);
  if (!tenantId) return null;
  return { token: session.accessToken };
}

function toBackendQuery(parsed: z.infer<typeof gridQuerySchema>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Registry grid (AC-1/AC-2): forwards filter/search/cursor to
 * `GET /api/projects` (TASK-014), tenant-scoped via the caller's token. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = gridQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  return forwardToBackend(`/api/projects${toBackendQuery(parsed.data)}`, caller.token);
}

/** "New project" modal (AC-8): forwards to `POST /api/projects`
 * (TASK-014) -- no request/sign-off step, no project-role guard at
 * create time (any tenant member may create; TASK-014 summary). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await resolveSession();
  if (!caller) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  return forwardToBackend("/api/projects", caller.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
