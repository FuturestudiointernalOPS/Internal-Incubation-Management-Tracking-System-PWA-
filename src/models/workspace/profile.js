import db from "@/lib/db";

/**
 * Workspace model — profile reads/writes and the contact identity guards
 * (REPOSITORY layer).
 *
 * Split verbatim out of `models/workspace.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Core profile fields of a contact. */
export async function getContactProfileFields(cid) {
  return db.execute({
    sql: "SELECT name, email, phone, address, language, role, group_name, image, status, created_at FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Optional secondary contact fields (may not exist in every environment). */
export async function getContactSecondaryFields(cid) {
  return db.execute({
    sql: "SELECT alternative_email, alternative_phone, country, country_code FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Login activity counters of a contact (may not exist in every environment). */
export async function getContactLoginActivity(cid) {
  return db.execute({
    sql: "SELECT last_login_at, login_count FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/**
 * Update core contact columns with a caller-built set clause list. The
 * generated SQL is identical to the original inline
 * `UPDATE contacts SET name = ?, ... WHERE cid = ?` query.
 */
export async function updateContactCoreFields(cid, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE contacts SET ${setClauses.join(", ")} WHERE cid = ?`,
    args: [...setArgs, cid],
  });
}

/** Update optional secondary contact columns (best-effort, caller try/catch). */
export async function updateContactSecondaryFields(cid, setClauses, setArgs) {
  return db.execute({
    sql: `UPDATE contacts SET ${setClauses.join(", ")} WHERE cid = ?`,
    args: [...setArgs, cid],
  });
}

/** Contact existence check (row restricted to cid). */
export async function findContactByCid(cid) {
  return db.execute({ sql: "SELECT cid FROM contacts WHERE cid = ?", args: [cid] });
}
