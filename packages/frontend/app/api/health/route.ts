import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
}

export function GET(): NextResponse<HealthResponse> {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.0.0",
  });
}
