/**
 * VENTURE EVENT LOG + INTERVIEW EVIDENCE — use cases.
 *
 * Both exist for one reason: the stage rules are evidence-based (spec §4.4), so
 * a claim like "we signed 3 pilots" has to arrive with a date and, for the
 * events the spec lists, a document or a link.
 *
 * Guarding writes is the route's job (`ventures.edit`, scoped to the founder's
 * Venture). This module decides what is a well-formed event, and keeps the
 * interview count the stage engine will later read.
 */

import {
  runInTransaction,
  selectBands,
  selectCurrentProfile,
  selectEvents,
  insertEvent,
  softDeleteEvent,
  selectInterviews,
  insertInterview,
  countEvidenceBackedInterviews,
} from "@/models/ventureReportingStore";
import { ensureReportingSchema, getReportingSettings } from "./settings";
import { groupBands } from "./rules";
import { validateEvent, eventRowValues, isValidEvidenceValue, isValidEventDate } from "./eventRules";
import { dateStringOrNull } from "./monthlyRules";
import { currentReportingCurrency } from "./monthly";

// ── Shaping ────────────────────────────────────────────────────────────────

function shapeEvent(row) {
  const evidence = row.evidence || null;
  return {
    id: row.id,
    type: row.event_type,
    date: dateStringOrNull(row.event_date),
    title: row.title || null,
    description: row.description || null,
    customerName: row.customer_name || null,
    amount:
      row.amount_mode === "exact"
        ? { mode: "exact", value: Number(row.amount_value) }
        : row.amount_mode === "band"
          ? { mode: "band", band: row.amount_band }
          : null,
    financingType: row.financing_type || null,
    source: row.source || null,
    marketDescription: row.market_description || null,
    statusFrom: row.status_from || null,
    statusTo: row.status_to || null,
    evidence,
    evidenceName: row.evidence_name || null,
    // The currency the amount was entered in (older rows carry none).
    currency: row.currency ? String(row.currency).toUpperCase() : null,
    // The reviewer must never have to guess whether a value is a link or a
    // private file: the shape says so.
    evidenceIsLink: Boolean(evidence) && /^https?:\/\//i.test(evidence),
    createdAt: row.created_at || null,
  };
}

function shapeInterview(row) {
  const evidence = row.evidence || null;
  return {
    id: row.id,
    date: dateStringOrNull(row.interview_date),
    customerSegment: row.customer_segment || null,
    intervieweeName: row.interviewee_name || null,
    notes: row.notes || null,
    insights: row.insights || null,
    evidence,
    evidenceName: row.evidence_name || null,
    evidenceIsLink: Boolean(evidence) && /^https?:\/\//i.test(evidence),
    createdAt: row.created_at || null,
  };
}

// ── Events ─────────────────────────────────────────────────────────────────

export async function listEvents({ ventureUuid }) {
  await ensureReportingSchema();
  const [result, profile] = await Promise.all([
    selectEvents(ventureUuid),
    selectCurrentProfile(ventureUuid),
  ]);
  // The fallback unit for an event recorded before it was stamped.
  const currency = String(profile.rows?.[0]?.reporting_currency || "XOF").toUpperCase();
  // Only this Venture's currency ladder: amounts are absolute, not symbolic.
  const settings = await getReportingSettings({ currency });
  return {
    events: (result.rows || []).map(shapeEvent),
    bands: settings.bands,
    currency,
  };
}

/**
 * Record one event. Returns `{ event }` or `{ errors: [i18nKey] }`.
 *
 * `stage_change` is refused here: the system writes it when a stage proposal is
 * approved, so a form can never fabricate a promotion.
 */
export async function createEvent({ ventureUuid, ventureCode, actorCid, input = {} }) {
  await ensureReportingSchema();

  const bandsResult = await selectBands();
  // Validate the band code against the ladder of the Venture's own currency.
  const filingCurrency = await currentReportingCurrency(ventureUuid);
  const bands = groupBands(bandsResult.rows || [], filingCurrency);

  const errors = validateEvent(input, { bands });
  if (errors.length) return { errors };

  // Stamped server-side: the amount was entered in the Venture's currency at
  // the moment the event was recorded.
  const currency = filingCurrency;
  const values = eventRowValues({ input: { ...input, currency }, actorCid });

  const created = await runInTransaction(async (query) =>
    insertEvent(query, { ventureUuid, ventureCode, ...values }),
  );

  return { event: shapeEvent((created.rows || [])[0]) };
}

/** A mistaken entry is hidden, never destroyed — the row keeps its trace. */
export async function deleteEvent({ ventureUuid, id, actorCid }) {
  await ensureReportingSchema();
  if (!id) return { errors: ["venture.reporting.events.validation.id"] };
  await runInTransaction(async (query) => softDeleteEvent(query, { ventureUuid, id, actorCid }));
  return { deleted: true };
}

// ── Interviews ─────────────────────────────────────────────────────────────

export async function listInterviews({ ventureUuid }) {
  await ensureReportingSchema();
  const result = await selectInterviews(ventureUuid);
  return { interviews: (result.rows || []).map(shapeInterview) };
}

/**
 * One customer-discovery interview, with the document or link the studio asked
 * for. Evidence is REQUIRED here: the stage criterion is "10 interviews, count
 * confirmed", and an interview nobody can check is not confirmation.
 */
export async function createInterview({ ventureUuid, actorCid, input = {} }) {
  await ensureReportingSchema();

  const errors = [];
  if (!isValidEventDate(input.interviewDate)) {
    errors.push("venture.reporting.interviews.validation.date");
  }
  const evidence = String(input.evidence || "").trim();
  if (!evidence) {
    errors.push("venture.reporting.interviews.validation.evidenceRequired");
  } else if (!isValidEvidenceValue(evidence)) {
    errors.push("venture.reporting.interviews.validation.evidence");
  }
  if (errors.length) return { errors };

  const created = await runInTransaction(async (query) =>
    insertInterview(query, {
      ventureUuid,
      customerSegment: String(input.customerSegment || "").trim() || null,
      intervieweeName: String(input.intervieweeName || "").trim() || null,
      interviewDate: String(input.interviewDate),
      notes: String(input.notes || "").trim() || null,
      insights: String(input.insights || "").trim() || null,
      evidence,
      evidenceName: String(input.evidenceName || "").trim() || null,
      actorCid,
    }),
  );

  return { interview: shapeInterview((created.rows || [])[0]) };
}

/**
 * How many interviews carry evidence, against the studio's threshold.
 *
 * The threshold is `validation_min_interviews` in the settings table, so the
 * studio can move the bar without a deploy (the value seeded today is the
 * spec's placeholder of 10).
 */
export async function interviewSummary({ ventureUuid, businessModel = "default" }) {
  await ensureReportingSchema();
  const [countResult, settings] = await Promise.all([
    countEvidenceBackedInterviews(ventureUuid),
    getReportingSettings({ businessModel }),
  ]);
  const withEvidence = Number(countResult.rows?.[0]?.total || 0);
  const minimum = Number(settings.settings?.validation_min_interviews ?? 0);
  return {
    withEvidence,
    minimum,
    met: minimum > 0 ? withEvidence >= minimum : false,
  };
}
