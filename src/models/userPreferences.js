import db from "@/lib/db";

/**
 * PERSONAL DISPLAY PREFERENCES.
 *
 * Deliberately separate from the venture's reporting currency: that one is a
 * filing fact about the Venture, this one is how a person likes to READ numbers.
 * Changing it must never touch a stored amount.
 *
 * Stored on the contact row (`contacts.display_currency`) so it follows the
 * account across browsers, unlike a localStorage flag.
 */

let schemaReady = null;

export function ensurePreferenceSchema() {
  if (!schemaReady) {
    schemaReady = db
      .execute({
        sql: "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS display_currency TEXT",
        args: [],
      })
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

export async function selectDisplayCurrency(cid) {
  await ensurePreferenceSchema();
  const result = await db.execute({
    sql: "SELECT display_currency FROM contacts WHERE cid = ? LIMIT 1",
    args: [String(cid)],
  });
  const value = result.rows?.[0]?.display_currency;
  return value ? String(value).toUpperCase() : null;
}

export async function updateDisplayCurrency(cid, currency) {
  await ensurePreferenceSchema();
  const value = currency ? String(currency).trim().toUpperCase() : null;
  const result = await db.execute({
    sql: "UPDATE contacts SET display_currency = ? WHERE cid = ? RETURNING display_currency",
    args: [value, String(cid)],
  });
  return result.rows?.[0]?.display_currency ?? null;
}
