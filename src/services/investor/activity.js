import { insertActivityEvent, selectInvestorContext } from "@/models/investor/activityLog";
import { selectEuroRates, selectLatestEuroRateDate } from "@/models/fxRateStore";

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;
const DEDUPE_TYPES = new Set(["venture_viewed", "deck_opened", "list_viewed", "search_used"]);

/**
 * A stable dedupe key for repeat views inside a 30-minute window. Only the
 * view-like events dedupe; a stage change or an intro must always be recorded.
 */
export function dedupeKeyFor({ eventType, actorId, target }) {
  if (!DEDUPE_TYPES.has(eventType)) return null;
  const bucket = Math.floor(Date.now() / DEDUPE_WINDOW_MS);
  return `${eventType}:${actorId || "anon"}:${target || "none"}:${bucket}`;
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
    return { userId, investorId: row?.id ?? null, visibilityMode: row?.visibility_mode ?? null };
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
      actor_type: actorType,
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
    });
  } catch (error) {
    console.error("[investor activity] emit failed:", error?.message || error);
    return null;
  }
}
