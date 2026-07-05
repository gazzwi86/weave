import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ponytail: stub -- red before green (TDD step 1).
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "not_implemented" }, { status: 500 });
}
