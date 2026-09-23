import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  querySecurityEvents,
  resolveSecurityEvent,
  getSecurityStats,
  logAuditEvent,
} from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req) => {
    const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(searchParams.get("hours")) || 24;
      const stats = await getSecurityStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      eventType: searchParams.get("event_type") || undefined,
      actorCid: searchParams.get("actor_cid") || undefined,
      severity: searchParams.get("severity") || undefined,
      isResolved: searchParams.has("is_resolved") ? searchParams.get("is_resolved") === "true" : undefined,
      limit: parseInt(searchParams.get("limit")) || 50,
      offset: parseInt(searchParams.get("offset")) || 0,
      fromDate: searchParams.get("from") || undefined,
      toDate: searchParams.get("to") || undefined,
    };

    const events = await querySecurityEvents(filters);
    return NextResponse.json({ success: true, events });
  },
);

export const PATCH = createHandler(
  { roles: ["super_admin", "security_officer"] },
  async (req) => {
    const body = await req.json();
    const { action, event_id, resolution_notes } = body;

    if (action === "resolve") {
      await resolveSecurityEvent(event_id, req.session?.cid, resolution_notes);
      await logAuditEvent({
        eventType: "SECURITY_ALERT",
        actorCid: req.session.cid,
        actorName: req.session.name,
        entityType: "security_event",
        entityId: String(event_id),
        description: "Security event resolved",
        severity: "info",
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action." },
      { status: 400 },
    );
  },
);
