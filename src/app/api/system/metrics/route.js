import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getMetrics, getRecentMetrics } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");

    if (type === "recent") {
      const hours = searchParams.get("hours") ? parseInt(searchParams.get("hours"), 10) : undefined;
      const results = await getRecentMetrics(hours);
      return NextResponse.json({ success: true, results });
    }

    const name = searchParams.get("name") || undefined;
    const hours = searchParams.get("hours") ? parseInt(searchParams.get("hours"), 10) : undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit"), 10) : undefined;
    const aggregate = searchParams.get("aggregate") || undefined;

    const results = await getMetrics(name, {
      hoursAgo: hours,
      limit,
      aggregate,
    });
    return NextResponse.json({ success: true, results });
  }
);
