import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
