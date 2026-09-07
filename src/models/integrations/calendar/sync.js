/**
 * Platform Calendar Sync Engine
 *
 * Syncs Platform form run deadlines to external calendar providers
 * (Microsoft Graph / Google Calendar) via the provider abstraction.
 *
 * Adapted from main branch — syncs platform_form_runs instead of v2_events.
 *
 * How it works:
 *   1. When a run is launched with opens_at/closes_at dates, call syncRunDeadline()
 *   2. The engine pushes deadline events to the external calendar
 *   3. External calendar IDs are stored on the run for future updates/deletes
 */

import db from "@/lib/db";
import { getCalendarProvider } from "./provider";

/**
 * Sync a run's open/close deadlines to the external calendar.
 * Creates "Submission Opens" and "Submission Closes" events.
 *
 * @param {number} runId - platform_form_runs.id
 */
export async function syncRunDeadlines(runId) {
  try {
    const run = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ?",
      args: [runId],
    });
    if (run.rows.length === 0) return { skipped: true, reason: "Run not found" };

    const r = run.rows[0];
    const provider = await getCalendarProvider();
    const results = [];

    // Sync "Opens" deadline
    if (r.opens_at && !r.external_calendar_id) {
      const result = await provider.createEvent({
        title: `[Opens] ${r.name}`,
        description: r.description || `Form run opens for submissions.`,
        startTime: r.opens_at,
        endTime: r.opens_at,
        location: `/platform/runs/submit/${r.id}`,
      });

      if (result.externalId) {
        await db.execute({
          sql: "UPDATE platform_form_runs SET external_calendar_id = ?, external_calendar_url = ? WHERE id = ?",
          args: [result.externalId, result.url || null, r.id],
        });
      }
      results.push({ type: "opens", ...result });
    }

    // Sync "Closes" deadline
    if (r.closes_at) {
      const closesResult = await provider.createEvent({
        title: `[Closes] ${r.name}`,
        description: r.description || `Form run submission deadline.`,
        startTime: r.closes_at,
        endTime: r.closes_at,
        location: `/platform/runs?id=${r.id}`,
      });

      if (closesResult.externalId) {
        await db.execute({
          sql: "UPDATE platform_form_runs SET external_calendar_url = COALESCE(external_calendar_url, ?) WHERE id = ?",
          args: [closesResult.url || null, r.id],
        });
      }
      results.push({ type: "closes", ...closesResult });
    }

    return { success: true, results };
  } catch (error) {
    console.error("[Platform Calendar] Sync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Remove synced calendar events for a run.
 */
export async function unsyncRunDeadlines(runId) {
  try {
    const run = await db.execute({
      sql: "SELECT external_calendar_id FROM platform_form_runs WHERE id = ? AND external_calendar_id IS NOT NULL",
      args: [runId],
    });

    if (run.rows.length === 0 || !run.rows[0].external_calendar_id) {
      return { skipped: true };
    }

    const provider = await getCalendarProvider();
    await provider.deleteEvent(run.rows[0].external_calendar_id);

    await db.execute({
      sql: "UPDATE platform_form_runs SET external_calendar_id = NULL, external_calendar_url = NULL WHERE id = ?",
      args: [runId],
    });

    return { success: true };
  } catch (error) {
    console.error("[Platform Calendar] Unsync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk sync all runs with deadlines that haven't been synced yet.
 */
export async function syncAllRunDeadlines() {
  const runs = await db.execute({
    sql: `SELECT id FROM platform_form_runs
          WHERE external_calendar_id IS NULL
            AND opens_at IS NOT NULL
            AND status = 'active'
          LIMIT 50`,
    args: [],
  });

  const results = [];
  for (const run of runs.rows) {
    const result = await syncRunDeadlines(run.id);
    results.push({ runId: run.id, ...result });
  }

  return { synced: results.length, results };
}

/**
 * Check if the calendar integration is configured and working.
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
