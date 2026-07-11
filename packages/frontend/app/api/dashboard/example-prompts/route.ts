import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

/** AC-8: role-tailored, GA-scoped prompt catalogue for the empty prompt
 * bar. Plain JSON proxy (unlike the generate route) -- `forwardToBackend`
 * is safe here since there's no stream to preserve.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return forwardToBackend("/api/dashboard/widgets/example-prompts", session.accessToken);
}
