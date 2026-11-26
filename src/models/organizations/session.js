import db from "@/lib/db";

// Authentication for the client boundary never initialises or repairs schema,
// backfills token hashes or borrows the internal session cache.
export async function findOrganizationSession(token, tokenHash) {
  return db.transaction(async (query) => {
    await query("SET TRANSACTION READ ONLY");
    await query("SET LOCAL statement_timeout = '3s'");
    const result = await query(`SELECT s.user_cid AS cid, lower(btrim(c.role)) AS role
      FROM user_sessions s JOIN contacts c ON c.cid=s.user_cid
      WHERE s.expires_at>clock_timestamp() AND c.deleted=0
        AND c.status IN ('active','approved')
        AND (s.token_hash=? OR (s.token_hash IS NULL AND s.token=?)) LIMIT 1`, [tokenHash, token]);
    return result.rows[0] || null;
  });
}
