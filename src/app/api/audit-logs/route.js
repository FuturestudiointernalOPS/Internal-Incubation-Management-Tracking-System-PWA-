import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  queryAuditLogs,
  getAuditLogStats,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req) => {
    const s = new URL(req.url).searchParams;
    const type = s.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(s.get("hours")) || 24;
      const stats = await getAuditLogStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      eventType: s.get("event_type") || undefined,
      actorCid: s.get("actor_cid") || undefined,
      ventureId: s.get("venture_id") || undefined,
      entityType: s.get("entity_type") || undefined,
      entityId: s.get("entity_id") || undefined,
      severity: s.get("severity") || undefined,
      limit: parseInt(s.get("limit")) || 50,
      offset: parseInt(s.get("offset")) || 0,
      fromDate: s.get("from") || undefined,
      toDate: s.get("to") || undefined,
    };

    const logs = await queryAuditLogs(filters);
    return NextResponse.json({ success: true, logs });
  },
);
