import { ensureCrmStageTargetColumn } from "@/models/crm/schema";
import { getActiveRulesByEvent } from "@/models/crm/intelligence";
import {
  getStaleLeadCandidates,
  getStaleOpportunityCandidates,
  getStuckOpportunityCandidates,
} from "@/models/crm/timeTriggers";
import { fireCrmEvent, evaluateConditions } from "@/services/crm/automationEngine";

/**
 * CRM — time-based automation triggers (DECISION layer).
 *
 * The engine already knows how to fire an event: it loads the active rules for
 * that event, evaluates their conditions, runs their actions and logs an
 * idempotent execution. What it does not have is a clock. This sweep supplies
 * one: it finds the records that have crossed a time threshold and fires the
 * matching event for each of them, through the same engine and the same rules.
 *
 * Triggers:
 *  - lead.stale          — open lead, no manual activity for 14 days
 *  - opportunity.stale   — active opportunity, no manual activity for 14 days
 *  - opportunity.stuck   — active opportunity past its stage's target duration
 *
 * The event id carries the day, so a rule runs at most once per record per day.
 * A candidate no rule would act on is skipped before the engine is called, so
 * conditions that do not match leave no execution row behind.
 *
 * KNOWN LIMIT: there is no scheduler in this application; the sweep runs when
 * the CRM dashboard is read. A cron should call the same function later.
 */

export const TIME_TRIGGER_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_CANDIDATES_PER_TRIGGER = 100;

const TIME_TRIGGERS = [
  { event: "lead.stale", entityType: "lead", read: getStaleLeadCandidates },
  { event: "opportunity.stale", entityType: "opportunity", read: getStaleOpportunityCandidates },
  { event: "opportunity.stuck", entityType: "opportunity", read: getStuckOpportunityCandidates },
];

let lastSweepAt = 0;

/** The rule's conditions as a list, whatever the driver handed back for jsonb. */
function conditionsOf(rule) {
  const conditions = rule?.conditions;
  if (Array.isArray(conditions)) return conditions;
  if (typeof conditions === "string") {
    try {
      const parsed = JSON.parse(conditions);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }
  return [];
}

/**
 * Evaluate every time-based trigger once.
 *
 * @returns {Promise<{skipped: boolean, fired: number, evaluated: number}>}
 */
export async function sweepCrmTimeTriggers({ force = false, now = new Date() } = {}) {
  const nowMs = Date.now();
  if (!force && nowMs - lastSweepAt < TIME_TRIGGER_SWEEP_INTERVAL_MS) {
    return { skipped: true, fired: 0, evaluated: 0 };
  }
  lastSweepAt = nowMs;

  // opportunity.stuck reads each stage's target.
  await ensureCrmStageTargetColumn();

  const day = (now instanceof Date ? now : new Date(now)).toISOString().slice(0, 10);
  let fired = 0;
  let evaluated = 0;

  for (const trigger of TIME_TRIGGERS) {
    const rules = (await getActiveRulesByEvent(trigger.event)).rows ?? [];

    // No rule listens to this event: do not even read the candidates.
    if (rules.length === 0) continue;

    const candidates = (await trigger.read(MAX_CANDIDATES_PER_TRIGGER)).rows ?? [];

    for (const candidate of candidates) {
      const context = { ...candidate, entity_type: trigger.entityType };

      // Skip records no rule would act on, so a non-match writes nothing.
      const matched = rules.some((rule) => evaluateConditions(conditionsOf(rule), context));
      if (!matched) continue;

      evaluated += 1;
      await fireCrmEvent(
        trigger.event,
        context,
        `${trigger.event}:${candidate.id}:${day}`,
        null, // the sweep is the system, not a person
      );
      fired += 1;
    }
  }

  return { skipped: false, fired, evaluated };
}
