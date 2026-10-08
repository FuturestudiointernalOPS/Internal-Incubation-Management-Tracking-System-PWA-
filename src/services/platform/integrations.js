/**
 * Platform — the calendar integration (SERVICE layer).
 *
 * The domain work behind `/api/platform/integrations/calendar`: the health probe
 * and the sync action vocabulary (sync one, unsync one, sync all). The
 * CONTROLLER keeps the `settings.view` gate on the health reads, the
 * `super_admin`/`program_manager` gate on the writes and the envelope.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**` and `@/lib/**`.
 */

import {
  checkCalendarHealth,
  syncAllRunDeadlines,
  syncRunDeadlines,
  unsyncRunDeadlines,
} from "@/models/integrations/calendar/sync";

// ── Calendar ────────────────────────────────────────────────────────────────

/** @returns {Promise<{status: number, body: Object}>} */
export async function getCalendarHealth() {
  const health = await checkCalendarHealth();
  return { status: 200, body: { success: true, ...health } };
}

/** @returns {Promise<{status: number, body: Object}>} */
export async function runCalendarAction({ action, runId }) {
  switch (action) {
    case "sync": {
      if (!runId) return { status: 400, body: { success: false, error: "runId required" } };
      const result = await syncRunDeadlines(runId);
      return { status: 200, body: { success: true, ...result } };
    }

    case "unsync": {
      if (!runId) return { status: 400, body: { success: false, error: "runId required" } };
      const result = await unsyncRunDeadlines(runId);
      return { status: 200, body: { success: true, ...result } };
    }

    case "sync-all": {
      const result = await syncAllRunDeadlines();
      return { status: 200, body: { success: true, ...result } };
    }

    default:
      return { status: 400, body: { success: false, error: `Unknown action: ${action}` } };
  }
}
