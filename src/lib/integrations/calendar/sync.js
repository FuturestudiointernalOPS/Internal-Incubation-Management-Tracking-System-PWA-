/**
 * Calendar Sync Engine
 *
 * Watches for calendar-syncable events in the app and pushes them
 * to the configured external calendar provider (Microsoft/Google).
 *
 * How it works:
 *   1. When an event is created/updated in ImpactOS, call `syncEvent()`
 *   2. The engine pushes it to the external calendar
 *   3. The external calendar event ID is stored alongside the local event
 *      so future updates/deletes stay in sync
 *
 * This is called from API routes — it never touches existing functionality.
 */

import db from "@/lib/db";
import { getCalendarProvider } from "./provider";

/**
 * Sync an event to the external calendar.
 * Creates if no externalId exists, updates if it does.
 *
 * @param {Object} event - from v2_events or similar
 * @param {string} event.id - local database ID
 * @param {string} event.title
 * @param {string} [event.description]
 * @param {string} event.start_time - ISO 8601
 * @param {string} [event.end_time] - ISO 8601
 * @param {string} [event.location]
 * @param {string} [event.participant_email]
 */
export async function syncEvent(event) {
  if (!event.start_time) return { skipped: true, reason: "No start_time" };

  const provider = await getCalendarProvider();

  try {
    // Check if we already synced this event
    const existing = await db.execute({
      sql: "SELECT external_calendar_id FROM v2_events WHERE id = ? AND external_calendar_id IS NOT NULL",
      args: [event.id],
    });

    const externalId = existing.rows[0]?.external_calendar_id;

    // Build attendees list if participant email available
    const attendees = [];
    if (event.participant_email) {
      attendees.push(event.participant_email);
    }

    const calendarEvent = {
      title: event.title,
      description: event.description || "",
      startTime: event.start_time,
      endTime: event.end_time || event.start_time,
      location: event.location || undefined,
      ...(attendees.length && { attendees }),
    };

    let result;

    if (externalId) {
      // Update existing external event
      result = await provider.updateEvent(externalId, calendarEvent);
    } else {
      // Create new external event
      result = await provider.createEvent(calendarEvent);

      // Store the external ID back on the local event
      if (result.externalId) {
        await db.execute({
          sql: "UPDATE v2_events SET external_calendar_id = ?, external_calendar_url = ? WHERE id = ?",
          args: [result.externalId, result.url || null, event.id],
        });
      }
    }

    return { success: true, externalId: result.externalId, url: result.url };
  } catch (error) {
    console.error("Calendar sync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a synced event from the external calendar
 * @param {string} localEventId - ID in v2_events
 */
export async function unsyncEvent(localEventId) {
  // Get the external ID before deleting locally
  const existing = await db.execute({
    sql: "SELECT external_calendar_id FROM v2_events WHERE id = ?",
    args: [localEventId],
  });

  const externalId = existing.rows[0]?.external_calendar_id;
  if (!externalId) return { skipped: true };

  try {
    const provider = await getCalendarProvider();
    await provider.deleteEvent(externalId);
    return { success: true };
  } catch (error) {
    console.error("Calendar unsync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if the calendar integration is configured and working
 */
export async function checkCalendarHealth() {
  try {
    const provider = await getCalendarProvider();
    const health = await provider.healthCheck();
    return {
      configured: true,
      provider: process.env.CALENDAR_PROVIDER || "microsoft",
      ...health,
    };
  } catch (e) {
    return {
      configured: false,
      provider: process.env.CALENDAR_PROVIDER || "microsoft",
      healthy: false,
      error: e.message,
    };
  }
}
