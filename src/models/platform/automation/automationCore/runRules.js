/** Run lifecycle rules: launch/created audit and calendar sync. */

import { audit } from "@/models/platform/integrations";
import { PLATFORM_EVENTS } from "./events";

export const runRules = [
  // ── Run launched ──
  {
    event: PLATFORM_EVENTS.RUN_LAUNCHED,
    description: "Log audit when a run is launched",
    action: async (ctx) => {
      const { run, session } = ctx;
      await audit({
        entity_type: "form_run",
        entity_id: run.id,
        user_id: session?.cid,
        user_name: null,
        action: "launched",
        details: `Form Run "${run.name}" launched`,
        meta: { form_id: run.form_id },
      });
    },
  },

  // ── Run created ──
  {
    event: PLATFORM_EVENTS.RUN_CREATED,
    description: "Log audit when a run is created",
    action: async (ctx) => {
      const { run, session } = ctx;
      await audit({
        entity_type: "form_run",
        entity_id: run.id,
        user_id: session?.cid,
        user_name: null,
        action: "created",
        details: `Form Run "${run.name}" created`,
        meta: { form_id: run.form_id },
      });
    },
  },

  // ── Run launched → sync deadlines to calendar ──
  {
    event: PLATFORM_EVENTS.RUN_LAUNCHED,
    description: "Sync run deadlines to external calendar (if configured)",
    action: async (ctx) => {
      const { run } = ctx;
      try {
        const { syncRunDeadlines } = await import("@/models/integrations/calendar/sync");
        await syncRunDeadlines(run.id);
      } catch (error) {
        console.error("[Automation] Calendar sync failed:", error.message);
      }
    },
  },
];