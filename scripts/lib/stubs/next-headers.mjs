/**
 * Minimal stub so src/lib/auth.js can be imported from plain Node scripts.
 * Only import-time evaluation matters for the dry-run — getSession() is never
 * called because the dry-run resolves authorization contexts directly from
 * the database.
 */
export async function cookies() {
  return { get: () => undefined };
}
