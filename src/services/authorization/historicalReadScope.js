/**
 * HISTORICAL READ SCOPE (SERVICE layer).
 *
 * Decision D1 (spec §10.1–10.4, §16.3): the read an ex-manager keeps after their
 * responsibility ends is a DISTINCT rule, BOUNDED to the contexts they managed —
 * never the directory, never an assignment.
 *
 * The residual is written as a real capability row (`granted_by = 'hist:...'`), so
 * a read route needs two answers:
 *
 *   - is the person's read of a feature HISTORICAL ONLY? (no real grant backs it)
 *   - which contexts may they consult? (their ended relationships)
 *
 * A real grant (profile, group, individual) makes `readIsHistoricalOnly` FALSE:
 * the person keeps their normal access, and the historical bound never applies.
 * Fail closed: a read error, a missing row, or an unreadable date all return the
 * NEUTRAL false, so this module can only ever NARROW a read it is asked about.
 */

import { getUserCapabilityRows } from "@/models/authorization/contextGrantsStore";
import { resolveScopeIds } from "./scope";

/** The stamp every residual row carries (`historicalGrantSentinel`). */
const HISTORY_STAMP_PREFIX = "hist:";

/** The module + capability that carries a feature's consultation. */
const FEATURE_READ = {
  programs: { module: "programs", capability: "view" },
  ventures: { module: "ventures", capability: "view" },
};

/** The history scope policy that resolves a feature's ended contexts. */
const FEATURE_HISTORY_POLICY = {
  programs: "program_managed_history",
  ventures: "venture_managed_history",
};

/** A row with no expiry, an unreadable one, or a future one is still live. */
function notExpired(row, now = Date.now()) {
  if (!row?.expires_at) return true;
  const at = new Date(row.expires_at).getTime();
  return Number.isNaN(at) || at > now;
}

/**
 * True when EVERY live row granting the feature's read capability is a residual
 * row. A missing row, or any real grant, returns false — the caller then keeps
 * its normal (unbounded-by-history) behaviour.
 */
export async function readIsHistoricalOnly(cid, feature) {
  const target = FEATURE_READ[feature];
  if (!cid || !target) return false;
  const res = await getUserCapabilityRows(cid);
  const rows = (res.rows || []).filter(
    (row) =>
      row.module === target.module &&
      row.capability === target.capability &&
      notExpired(row),
  );
  if (rows.length === 0) return false;
  return rows.every((row) =>
    String(row.granted_by || "").startsWith(HISTORY_STAMP_PREFIX),
  );
}

/** The contexts the person may consult for one feature (their ended relationships). */
export async function historicalContextIdsForFeature(cid, feature) {
  const policy = FEATURE_HISTORY_POLICY[feature];
  if (!cid || !policy) return [];
  const ids = await resolveScopeIds(policy, cid);
  return Array.isArray(ids) ? ids.map(String) : [];
}

/**
 * Read-only historical access to ONE venture (D1, spec §10.1–10.4): the person's
 * only venture read is the residual AND this venture is one they formerly
 * managed. READ ONLY — a caller must never use it to authorise a write.
 *
 * The scope resolves venture CODES (like the other venture policies), while the
 * address may carry the internal UUID: the code is resolved once when the raw
 * value does not match.
 */
export async function hasHistoricalVentureAccess(cid, ventureIdOrCode) {
  if (!cid || !ventureIdOrCode) return false;
  if (!(await readIsHistoricalOnly(cid, "ventures"))) return false;
  const codes = await historicalContextIdsForFeature(cid, "ventures");
  if (codes.includes(String(ventureIdOrCode))) return true;
  try {
    const { getVentureFacts } = await import("@/services/ventures/accessFacts");
    const facts = await getVentureFacts(ventureIdOrCode);
    return Boolean(facts?.code) && codes.includes(String(facts.code));
  } catch {
    return false;
  }
}
