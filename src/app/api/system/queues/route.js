import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getQueueStats, getLatestQueueStats } from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type");

    if (type === "latest") {
      const results = await getLatestQueueStats();
      return NextResponse.json({ success: true, results });
    }

    const queueName = searchParams.get("queue_name") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit"), 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset"), 10) : undefined;

    const results = await getQueueStats({ queueName, limit, offset });
    return NextResponse.json({ success: true, results });
  }
);
