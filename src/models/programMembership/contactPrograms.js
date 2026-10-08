import db from "@/lib/db";

/**
 * ProgramMembership model — contact program history (REPOSITORY layer).
 *
 * The contact email lookup used by `/api/contacts/[cid]/programs`, split
 * verbatim out of `models/programMembership.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

// ────────────────────────────────────────────────────────────
// /api/contacts/[cid]/programs — contact program history
// ────────────────────────────────────────────────────────────

/** Contact email by cid (used to look up program history). */
export async function getContactEmailForProgramHistory(cid) {
  return db.execute({
    sql: "SELECT email FROM contacts WHERE cid = ? LIMIT 1",
    args: [cid],
  });
}
