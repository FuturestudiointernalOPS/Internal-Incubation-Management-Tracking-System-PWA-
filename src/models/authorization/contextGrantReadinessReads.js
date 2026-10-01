/**
 * Authorization — context grant readiness reads (REPOSITORY layer).
 *
 * The two statements the readiness report needs. They used to sit inline in the
 * report module, which also decided what the report says — the split keeps the
 * report deciding and this file reading.
 *
 * SQL is byte-identical to what was inline before.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per query, no
 * decisions.
 */

import db from "@/lib/db";

/** A person's display name and role, for the readiness report. */
export function getContactNameAndRole(cid) {
  return db.execute({
    sql: "SELECT name, role FROM contacts WHERE cid = ?",
    args: [String(cid)],
  });
}

/**
 * The capability rows a given sentinel granted to a person — i.e. what the
 * assignment-derived model has already applied (expired rows included, so the
 * report can surface them separately).
 */
export function getSentinelGrantedCapabilities(cid, sentinel) {
  return db.execute({
    sql: `SELECT module, capability, access_level, expires_at
              FROM user_capabilities
              WHERE user_cid = ? AND granted_by = ?`,
    args: [String(cid), sentinel],
  });
}
