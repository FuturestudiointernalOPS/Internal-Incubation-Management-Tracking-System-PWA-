import { NextResponse } from "next/server";
import { syncEvent, unsyncEvent, checkCalendarHealth } from "@/lib/integrations/calendar/sync";
import db from "@/lib/db";

/**
 * GET /api/integrations/calendar?action=health
 *   - Check if the calendar integration is configured and working
 *
 * POST /api/integrations/calendar
 *   { action: "sync", eventId: 123 }
 *   - Sync a specific event to the external calendar
 *
 * POST /api/integrations/calendar
 *   { action: "unsync", eventId: 123 }
 *   - Remove a specific event from the external calendar
 *
 * POST /api/integrations/calendar
 *   { action: "sync-all" }
 *   - Sync all events that haven't been synced yet
 */

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "health";

  if (action === "health") {
    const health = await checkCalendarHealth();
    return NextResponse.json({ success: true, ...health });
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 },
  );
}

export async function POST(req) {
  try {
    const { action, eventId } = await req.json();

    switch (action) {
      case "sync": {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: "eventId required" },
            { status: 400 },
          );
        }

        // Fetch the event from the database
        const res = await db.execute({
          sql: `SELECT e.*, c.email as participant_email
                FROM v2_events e
                LEFT JOIN contacts c ON e.participant_id = c.cid
                WHERE e.id = ?`,
          args: [eventId],
        });

        const event = res.rows[0];
        if (!event) {
          return NextResponse.json(
            { success: false, error: "Event not found" },
            { status: 404 },
          );
        }

        const result = await syncEvent(event);
        return NextResponse.json({ success: true, ...result });
      }

      case "unsync": {
        if (!eventId) {
          return NextResponse.json(
            { success: false, error: "eventId required" },
            { status: 400 },
          );
        }

        const result = await unsyncEvent(eventId);
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-all": {
        // Sync all events that haven't been externally synced
        const events = await db.execute({
          sql: `SELECT e.*, c.email as participant_email
                FROM v2_events e
                LEFT JOIN contacts c ON e.participant_id = c.cid
                WHERE e.external_calendar_id IS NULL
                  AND e.start_time IS NOT NULL
                LIMIT 50`,
          args: [],
        });

        const results = [];
        for (const event of events.rows) {
          const result = await syncEvent(event);
          results.push({ eventId: event.id, ...result });
        }

        return NextResponse.json({
          success: true,
          synced: results.length,
          results,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Calendar integration API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
