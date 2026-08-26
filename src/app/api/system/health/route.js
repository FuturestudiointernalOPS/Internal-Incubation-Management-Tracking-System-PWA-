import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import {
  runHealthChecks,
  getLatestHealthChecks,
  getHealthCheckHistory,
} from "@/lib/ventures";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const s = new URL(req.url).searchParams;
    const type = s.get("type");

    if (type === "latest") {
      const results = await getLatestHealthChecks();
      return NextResponse.json({ success: true, results });
    }

    if (type === "history") {
      const component = s.get("component") || undefined;
      const results = await getHealthCheckHistory(component);
      return NextResponse.json({ success: true, results });
    }

    const results = await runHealthChecks();
    return NextResponse.json({ success: true, results });
  }
);
