import { insertActivityEvent, selectInvestorContext } from "@/models/investor/activityLog";
import { selectEuroRates, selectLatestEuroRateDate } from "@/models/fxRateStore";
import { insertErrorLog } from "@/models/adminOps/reportsAndErrors";
import { logger } from "@/lib/logger";
import { readInvestorFlags } from "./featureFlags";

const DEDUPE_TYPES = new Set(["venture_viewed"]);

/** New interaction hooks are opt-in and can never break their primary action. */
export async function recordInvestorInteraction(event) {
  try {
    const flags = await readInvestorFlags();
    if (!flags.activity) return null;
    if (event.eventType === "login") {
      const context = await resolveInvestorContext(event.session);
      if (!context.investorId || context.approvalStatus !== "approved") return null;
    }
    return await emitInvestorEvent(event);
  } catch (_error) {
    try {
      await insertErrorLog({ message: "Investor interaction hook failed", severity: "error",
        action_attempted: "investor_interaction_hook" }, "investor", "investor_interaction_hook");
    } catch (_registerError) {
      logger.error("investor_interaction_hook_failed");
    }
    return null;
  }
}

/**
 * Stable lock identity; the model checks a rolling thirty-minute interval.
 * Searches/deck opens and all mutations remain distinct recorded actions.
 */
export function dedupeKeyFor({ eventType, actorId, target }) {
  if (!DEDUPE_TYPES.has(eventType)) return null;
  if (!actorId || !target) return null;
  return JSON.stringify([eventType, String(actorId), String(target)]);
}

/**
 * Best-effort dated FX snapshot (units of `currency` per EUR). Never throws:
 * a missing rate is stored as null, never as zero.
 */
export async function snapshotFx(currency, amount) {
  if (!currency || amount == null) {
    return { currency: currency || null, fx_rate: null, fx_rate_date: null };
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const latest = await selectLatestEuroRateDate(today);
    const date = latest.rows?.[0]?.rate_date;
    if (!date) return { currency, fx_rate: null, fx_rate_date: null };
    const rates = await selectEuroRates(date);
    const row = (rates.rows || []).find(
      (entry) => String(entry.quote_currency).toUpperCase() === String(currency).toUpperCase(),
    );
    return { currency, fx_rate: row?.rate ?? null, fx_rate_date: date };
  } catch (_) {
    return { currency, fx_rate: null, fx_rate_date: null };
  }
}

/** The caller's investor profile id and the visibility mode at call time. */
export async function resolveInvestorContext(session) {
  const userId = session?.cid || session?.id || null;
  if (!userId) return { userId: null, investorId: null, visibilityMode: null };
  try {
    const result = await selectInvestorContext(userId);
    const row = result.rows?.[0];
    return {
      userId, investorId: row?.id ?? null,
      visibilityMode: row?.visibility_mode === "full_pipeline" ? "full_pipeline" : "deal_flow_only",
      isTest: row?.is_test === true,
      approvalStatus: row?.approval_status ?? null,
    };
  } catch (_) {
    return { userId, investorId: null, visibilityMode: null };
  }
}

/**
 * Emit one investor event. Never throws — logging must not break a request.
 */
export async function emitInvestorEvent({
  session,
  investorId = null,
  eventType,
  ventureId = null,
  relatedId = null,
  actorType = "investor",
  metadata = null,
  sessionId = null,
  currency = null,
  amount = null,
  timezone = null,
}) {
  try {
    const ctx = await resolveInvestorContext(session);
    const effectiveInvestorId = investorId ?? ctx.investorId;
    const fx = await snapshotFx(currency, amount);
    const dedupe_key = dedupeKeyFor({
      eventType,
      actorId: effectiveInvestorId || ctx.userId,
      target: ventureId || relatedId,
    });

    return await insertActivityEvent({
      event_type: eventType,
      investor_id: effectiveInvestorId,
      venture_id: ventureId,
      related_id: relatedId,
      actor_type: ["super_admin", "staff", "program_manager"].includes(session?.role) ? "studio" : actorType,
      actor_id: ctx.userId,
      visibility_mode: ctx.visibilityMode,
      currency: fx.currency,
      amount,
      fx_rate: fx.fx_rate,
      fx_rate_date: fx.fx_rate_date,
      timezone,
      metadata,
      dedupe_key,
      session_id: sessionId,
      is_test: ctx.isTest,
    });
  } catch (_error) {
    // Diagnostic register is best-effort too. Never log arbitrary metadata,
    // message contents, credentials or a raw SQL exception to a user response.
    try {
      await insertErrorLog({
        message: "Investor activity write failed",
        action_attempted: "investor_activity_append",
        severity: "error",
      }, "investor", "investor_activity_append");
    } catch (_registerError) {
      logger.error("investor_activity_register_failed", { eventType });
    }
    return null;
  }
}
