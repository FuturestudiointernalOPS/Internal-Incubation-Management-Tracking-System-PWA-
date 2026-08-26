import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getMetrics, getRecentMetrics } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const type = s.get("type");

    if (type === "recent") {
      const hours = s.get("hours") ? parseInt(s.get("hours"), 10) : undefined;
      const results = await getRecentMetrics(hours);
      return NextResponse.json({ success: true, results });
    }

    const name = s.get("name") || undefined;
    const hours = s.get("hours") ? parseInt(s.get("hours"), 10) : undefined;
    const limit = s.get("limit") ? parseInt(s.get("limit"), 10) : undefined;
    const aggregate = s.get("aggregate") || undefined;

    const results = await getMetrics(name, {
      hoursAgo: hours,
      limit,
      aggregate,
    });
    return NextResponse.json({ success: true, results });
  }
);
