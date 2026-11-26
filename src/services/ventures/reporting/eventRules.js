/**
 * VENTURE EVENT LOG — pure rules (spec §7 and §4.4).
 *
 * Six events a founder records, each with the fields and the EVIDENCE the
 * spec demands. `stage_change` is reserved for the system and is written by the
 * stage engine, never by a form.
 *
 * Evidence is ONE value that is either an external link or a private storage
 * path — the same convention the deliverables and verification features use.
 */

export const EVENT_TYPES = [
  "pilot_signed",
  "mvp_launched",
  "pilot_converted",
  "financing_received",
  "new_market",
  "status_change",
];

/** The record types the system itself writes. Never offered in a form. */
export const SYSTEM_EVENT_TYPES = ["stage_change"];

export const VENTURE_STATUSES = ["active", "dormant", "terminated", "sold"];
export const FINANCING_TYPES = ["grant", "equity", "debt"];

/**
 * What each event needs. `evidence` mirrors §4.4:
 *   • a signed pilot or LOI → a document
 *   • an MVP → a link or a screenshot
 *   • a new market → a description AND first-customer evidence
 * A pilot that converted to paid needs no document: the monthly figures prove it.
 */
export const EVENT_SPEC = {
  pilot_signed: { evidence: true, customer: true },
  mvp_launched: { evidence: true },
  pilot_converted: { customer: true },
  financing_received: { amount: true, financingType: true },
  new_market: { evidence: true, market: true },
  status_change: { status: true },
};

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

/** An external link, or a storage path (letters, digits, dot, dash, slash). */
export function isValidEvidenceValue(value) {
  const raw = text(value);
  if (!raw) return true;
  if (/^https?:\/\//i.test(raw)) return true;
  return /^[A-Za-z0-9._/-]+$/.test(raw);
}

/** True when the value is a link the browser can open directly. */
export function isLinkEvidence(value) {
  return /^https?:\/\//i.test(text(value));
}

/** `YYYY-MM-DD`, a real date, and not in the future. */
export function isValidEventDate(value, now = new Date()) {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // JS rolls 2026-02-31 over into March: compare the parts back to refuse it.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return parsed.getTime() <= today.getTime();
}

/**
 * Refuse an event that cannot be trusted. Returns i18n keys, stable order.
 *
 * `bands` is the `groupBands()` output so a financing amount entered as a band
 * must name a band the studio still publishes.
 */
export function validateEvent(input = {}, { now = new Date() } = {}) {
  const errors = [];
  const type = text(input.eventType);

  if (!EVENT_TYPES.includes(type)) {
    return ["venture.reporting.events.validation.type"];
  }

  if (!isValidEventDate(input.eventDate, now)) {
    errors.push("venture.reporting.events.validation.date");
  }

  const spec = EVENT_SPEC[type] || {};

  if (spec.customer && !text(input.customerName)) {
    errors.push("venture.reporting.events.validation.customer");
  }
  if (spec.market && !text(input.marketDescription)) {
    errors.push("venture.reporting.events.validation.market");
  }
  if (spec.status && !VENTURE_STATUSES.includes(text(input.statusTo))) {
    errors.push("venture.reporting.events.validation.status");
  }

  if (spec.amount) {
    const mode = text(input.amountMode);
    if (mode === "band") {
      // Ranges withdrawn (Phase 4): an event records what actually moved.
      errors.push("venture.reporting.validation.bandRemoved");
    } else if (mode !== "exact") {
      errors.push("venture.reporting.events.validation.amount");
    } else {
      const value = Number(input.amountValue);
      if (!Number.isFinite(value) || value < 0) {
        errors.push("venture.reporting.events.validation.amount");
      }
    }
  }

  if (spec.financingType && !FINANCING_TYPES.includes(text(input.financingType))) {
    errors.push("venture.reporting.events.validation.financingType");
  }

  if (!isValidEvidenceValue(input.evidence)) {
    errors.push("venture.reporting.events.validation.evidence");
  }
  if (spec.evidence && !text(input.evidence)) {
    errors.push("venture.reporting.events.validation.evidenceRequired");
  }

  return errors;
}

/** The column payload for one event (pure: ids and actor are passed in). */
export function eventRowValues({ input = {}, actorCid = null }) {
  const mode = text(input.amountMode);
  return {
    eventType: text(input.eventType),
    eventDate: text(input.eventDate),
    title: text(input.title) || null,
    description: text(input.description) || null,
    customerName: text(input.customerName) || null,
    amountMode: ["exact", "band"].includes(mode) ? mode : null,
    amountValue: mode === "exact" ? Number(input.amountValue) : null,
    amountBand: mode === "band" ? text(input.amountBand) || null : null,
    financingType: text(input.financingType) || null,
    source: text(input.source) || null,
    marketDescription: text(input.marketDescription) || null,
    statusFrom: text(input.statusFrom) || null,
    statusTo: text(input.statusTo) || null,
    evidence: text(input.evidence) || null,
    evidenceName: text(input.evidenceName) || null,
    // The currency this amount was entered in, frozen with the event.
    currency: input.currency ? String(input.currency).trim().toUpperCase() : null,
    actorCid,
  };
}
