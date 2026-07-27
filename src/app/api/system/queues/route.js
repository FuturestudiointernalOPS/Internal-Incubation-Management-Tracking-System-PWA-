import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getQueueStats, getLatestQueueStats } from "@/lib/ventures";

export const GET = createHandler(
  async (req) => {
    const s = new URL(req.url).searchParams;
    const type = s.get("type");

    if (type === "latest") {
      const results = await getLatestQueueStats();
      return NextResponse.json({ success: true, results });
    }

    const queueName = s.get("queue_name") || undefined;
    const limit = s.get("limit") ? parseInt(s.get("limit"), 10) : undefined;
    const offset = s.get("offset") ? parseInt(s.get("offset"), 10) : undefined;

    const results = await getQueueStats({ queueName, limit, offset });
    return NextResponse.json({ success: true, results });
  },
  { roles: ["super_admin"] }
);
