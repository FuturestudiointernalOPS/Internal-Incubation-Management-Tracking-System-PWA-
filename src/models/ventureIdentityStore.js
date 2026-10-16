/**
 * Venture identity — statements (REPOSITORY layer).
 *
 * ONE resolver for the whole application: the internal id of a Venture referred
 * to EITHER by its decorative code ("VNT-…" — what a URL and an API path carry)
 * or by its internal id (what a stored reference carries). See
 * docs/VENTURE_IDENTITY_PHASE0.md.
 *
 * This replaces the scattered per-module variants (`getVentureIdByCode`,
 * `selectVentureIdByCode`, `getVentureDbIdForProgress`, …) that each answered the
 * same question. New code resolves through here; the old ones are left in place
 * until their callers migrate.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/**
 * The internal id (`ventures.id`) for a code OR an internal id, as text.
 *
 * `id::text` so a uuid and the legacy integer come back in the same shape the
 * reference columns store. One row: `venture_id` is UNIQUE.
 */
export function selectVentureInternalId(ref, database = db) {
  const value = String(ref ?? "");
  return database.execute({
    sql: "SELECT id::text AS id FROM ventures WHERE venture_id = ? OR id::text = ? LIMIT 1",
    args: [value, value],
  });
}

/**
 * The internal id for a code-or-id reference.
 *
 * Falls back to the reference itself when nothing matches, so a caller that
 * already holds an internal id passes through unchanged and a stale caller is
 * never left writing NOTHING. The fallback is visible on purpose: a reference
 * that resolves to no Venture is a bug upstream, and preserving it keeps the
 * symptom local instead of hiding it.
 *
 * Lives in the model layer so model files can use it without importing from
 * `@/services` (which would invert the layering). `database` lets a statement
 * that takes an injectable connection resolve against that same connection.
 */
export async function resolveVentureInternalId(ref, database = db) {
  const value = ref === null || ref === undefined ? "" : String(ref).trim();
  if (!value) return ref;
  const result = await selectVentureInternalId(value, database);
  return result.rows?.[0]?.id || ref;
}

/**
 * The internal ids for MANY references at once — codes, internal ids, or a mix.
 *
 * A list read must not run one resolve per row, and must not ASSUME which form
 * its caller sends: before the storage was unified the code WAS the stored value,
 * so a caller that still hands over a code now makes the read raise "invalid input
 * syntax for type uuid" against the retyped column — and a screen goes blank for a
 * reason that looks nothing like an identifier problem.
 *
 * One statement resolves both forms, and the ORDER of the caller's list is kept.
 * A reference that resolves to no Venture comes back unchanged, the same fallback
 * the single-value resolver makes: a stale reference stays visible instead of
 * becoming an empty result that reads as "nothing recorded".
 */
export async function resolveVentureInternalIds(refs = [], database = db) {
  const list = (Array.isArray(refs) ? refs : [])
    .map((ref) => (ref === null || ref === undefined ? "" : String(ref).trim()))
    .filter(Boolean);
  if (list.length === 0) return [];
  const placeholders = list.map(() => "?").join(", ");
  const result = await database.execute({
    sql: `SELECT venture_id AS code, id::text AS id FROM ventures
           WHERE venture_id IN (${placeholders}) OR id::text IN (${placeholders})`,
    args: [...list, ...list],
  });
  const byRef = new Map();
  for (const row of result.rows || []) {
    if (row.code) byRef.set(String(row.code), String(row.id));
    if (row.id) byRef.set(String(row.id), String(row.id));
  }
  return list.map((ref) => byRef.get(ref) || ref);
}
