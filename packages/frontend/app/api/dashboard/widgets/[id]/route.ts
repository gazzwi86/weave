import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { forwardToBackend } from "@/lib/build/backend-proxy";

export const runtime = "nodejs";

// Law 13: mirrors schemas/dashboard.py's ComponentType (m2-delta.md §2's
// closed 9-component catalogue) -- never a free-form string.
const updateWidgetSchema = z.object({
  spec: z.object({
    component_type: z.enum([
      "kpi_card",
      "line_area_chart",
      "bar_chart",
      "ranked_list",
      "activity_feed",
      "pie_donut",
      "heatmap",
      "alert_banner",
      "table",
    ]),
  }),
});

type RouteParams = { params: Promise<{ id: string }> };

/** Proxies `PATCH /api/dashboard/widgets/{id}` (TASK-012 AC-5:
 * change-visualisation persistence). Owner-only / IDOR-safe-404 shape is
 * the backend's job -- this proxy validates request shape only. */
export async function PATCH(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = updateWidgetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { id } = await params;
  return forwardToBackend(`/api/dashboard/widgets/${encodeURIComponent(id)}`, session.accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
}
