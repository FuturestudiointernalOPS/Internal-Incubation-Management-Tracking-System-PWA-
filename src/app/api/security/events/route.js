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
    const s = new URL(req.url).searchParams;
    const type = s.get("type") || "list";

    if (type === "stats") {
      const hours = parseInt(s.get("hours")) || 24;
      const stats = await getSecurityStats(hours);
      return NextResponse.json({ success: true, ...stats });
    }

    const filters = {
      eventType: s.get("event_type") || undefined,
      actorCid: s.get("actor_cid") || undefined,
      severity: s.get("severity") || undefined,
      isResolved: s.has("is_resolved") ? s.get("is_resolved") === "true" : undefined,
      limit: parseInt(s.get("limit")) || 50,
      offset: parseInt(s.get("offset")) || 0,
      fromDate: s.get("from") || undefined,
      toDate: s.get("to") || undefined,
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
