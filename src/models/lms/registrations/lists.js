import db from "@/lib/db";

import { ensureCheckoutSchema } from "./schema";
import { REGISTRATION_SELECT, parseRegistration, normalizeRegistrationEmail } from "./helpers";

/**
 * CHECKOUT REGISTRATIONS — the team-view lists, counters and sweeps.
 *
 * Split verbatim out of `models/lms/registrations.js` — see docs/LAYER_SPLIT.md.
 */

function buildRegistrationFilters({ runId, courseId, status, access, emailStatus } = {}) {
  const clauses = [];
  const args = [];
  if (runId) {
    clauses.push("run_id = ?");
    args.push(runId);
  }
  if (courseId) {
    clauses.push("course_id = ?");
    args.push(courseId);
  }
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  if (access) {
    clauses.push("access_status = ?");
    args.push(access);
  }
  if (emailStatus) {
    clauses.push("email_status = ?");
    args.push(emailStatus);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

/** Team view: registrations, optionally filtered by Execution / course / states. */
export async function listRegistrations(filters = {}) {
  await ensureCheckoutSchema();
  const { where, args } = buildRegistrationFilters(filters);
  const limit = Number(filters.limit);
  const offset = Number(filters.offset);
  let tail = " ORDER BY created_at DESC";
  if (Number.isFinite(limit) && limit > 0) {
    tail += " LIMIT ?";
    args.push(limit);
  }
  if (Number.isFinite(offset) && offset > 0) {
    tail += " OFFSET ?";
    args.push(offset);
  }
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} ${where}${tail}`,
    args,
  });
  return res.rows.map(parseRegistration);
}

/**
 * The Executions that actually have registrations — used to POPULATE the team
 * view's filter (a bounded derivation, not a counter; the header counters are
 * aggregated in the database by getRegistrationStats).
 */
export async function listRegistrationsRunOptions() {
  const res = await db.execute({
    sql: "SELECT run_id, course_id, status FROM lms_registrations",
    args: [],
  });
  const byRun = new Map();
  for (const row of res.rows) {
    const key = String(row.run_id ?? "none");
    const entry = byRun.get(key) || { run_id: row.run_id ?? null, course_id: row.course_id ?? null, total: 0, paid: 0 };
    entry.total += 1;
    if (row.status === "paid") entry.paid += 1;
    byRun.set(key, entry);
  }
  return [...byRun.values()];
}

export async function countRegistrations(filters = {}) {
  await ensureCheckoutSchema();
  const { where, args } = buildRegistrationFilters(filters);
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM lms_registrations ${where}`,
    args,
  });
  return Number(res.rows[0]?.n || 0);
}

/** Every registration captured for one email, newest first (resend / resume). */
export async function listRegistrationsByEmail(email) {
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanEmail) return [];
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE email = ? ORDER BY created_at DESC`,
    args: [cleanEmail],
  });
  return res.rows.map(parseRegistration);
}

/**
 * "À examiner" queue: registrations that need a human — a confirmed payment whose
 * access step failed, or a payment that failed. Two DB-filtered reads, merged
 * (failures are rare, so the set stays small), never a scan of every row.
 */
export async function listRegistrationsToReview(filters = {}) {
  const [accessFailed, paymentFailed] = await Promise.all([
    listRegistrations({ ...filters, access: "failed" }),
    listRegistrations({ ...filters, status: "failed" }),
  ]);
  const seen = new Set();
  const merged = [];
  for (const row of [...accessFailed, ...paymentFailed]) {
    const key = String(row.id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

/**
 * Counters, aggregated IN THE DATABASE (one count per state) so the team view
 * never loads every row to count them.
 */
export async function getRegistrationStats(filters = {}) {
  const { runId, courseId } = filters;
  const base = { runId, courseId };
  const [
    total,
    paid,
    pending,
    failed,
    cancelled,
    refunded,
    accessGranted,
    accessFailed,
    emailSent,
    emailFailed,
  ] = await Promise.all([
    countRegistrations(base),
    countRegistrations({ ...base, status: "paid" }),
    countRegistrations({ ...base, status: "pending" }),
    countRegistrations({ ...base, status: "failed" }),
    countRegistrations({ ...base, status: "cancelled" }),
    countRegistrations({ ...base, status: "refunded" }),
    countRegistrations({ ...base, access: "granted" }),
    countRegistrations({ ...base, access: "failed" }),
    countRegistrations({ ...base, emailStatus: "sent" }),
    countRegistrations({ ...base, emailStatus: "failed" }),
  ]);

  return {
    total,
    registered: total,
    paid,
    pending,
    failed,
    cancelled,
    refunded,
    accessGranted,
    accessFailed,
    emailSent,
    emailFailed,
  };
}

/**
 * Registrations that a confirmed payment is attached to but whose access was
 * never granted — the reconciliation sweep retries the VERIFICATION for those
 * that were never verified, and the ACCESS step for those already paid.
 */
export async function listPaidRegistrationsNeedingAccess() {
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE status = 'paid' AND access_status = ? ORDER BY paid_at DESC`,
    args: ["failed"],
  });
  return res.rows.map(parseRegistration);
}

/** Paid registrations whose access is still pending (claimed success, not yet closed). */
export async function listPaidRegistrationsPendingAccess() {
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE status = 'paid' AND access_status = ? ORDER BY paid_at DESC`,
    args: ["pending"],
  });
  return res.rows.map(parseRegistration);
}

/**
 * Pending registrations that carry a transaction id — a browser reported one, or
 * a notification did, but nothing ever settled them. The reconciliation sweep
 * re-asks the PROVIDER for these, so a MISSED Kkiapay notification is not a dead
 * end even after the payer has closed their tab.
 */
export async function listPendingRegistrationsWithTransactionId(limit = 25) {
  await ensureCheckoutSchema();
  const take = Math.max(1, Math.min(Number(limit) || 25, 100));
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT}
          WHERE status = 'pending' AND provider_transaction_id IS NOT NULL
          ORDER BY updated_at DESC
          LIMIT ?`,
    args: [take],
  });
  return res.rows.map(parseRegistration);
}
