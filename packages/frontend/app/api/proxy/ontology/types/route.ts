import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ponytail: throwing stub -- real body lands next commit (keeps tsc green
// while the test is red on assertion, not on a missing export).
export async function GET(): Promise<NextResponse> {
  throw new Error("not implemented");
}
