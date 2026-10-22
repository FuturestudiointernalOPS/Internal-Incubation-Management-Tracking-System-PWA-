import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { queryAuditLogs, getAuditLogStats } from "@/services/ventures/auditSecurity";

export const GET = createHandler(
  async (req) => {
    const capError = await requireAuthorization("users", "view");
    if (capError) return capError;

    const queryParams = new URL(req.url).searchParams;
    const type = queryParams.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(queryParams.get("hours")) || 24;
      const stats = await getAuditLogStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      eventType: queryParams.get("event_type") || undefined,
      actorCid: queryParams.get("actor_cid") || undefined,
      ventureId: queryParams.get("venture_id") || undefined,
      entityType: queryParams.get("entity_type") || undefined,
      entityId: queryParams.get("entity_id") || undefined,
      severity: queryParams.get("severity") || undefined,
      limit: parseInt(queryParams.get("limit")) || 50,
      offset: parseInt(queryParams.get("offset")) || 0,
      fromDate: queryParams.get("from") || undefined,
      toDate: queryParams.get("to") || undefined,
    };

    const logs = await queryAuditLogs(filters);
    return NextResponse.json({ success: true, logs });
  },
);
