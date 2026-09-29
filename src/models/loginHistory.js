import db from "@/lib/db";
import { summarizeUserAgent } from "@/lib/userAgent";

/**
 * Login-history WRITES (the missing half of the Security console).
 *
 * The tables `venture_login_history` / `venture_failed_logins` are defined by
 * `ensureVentureSchema` (src/lib/ventures.js) and read by
 * `/api/security/login-history`. Until this module existed nothing ever inserted
 * a row, so the console showed permanent zeros and no failed sign-in was
 * recorded anywhere.
 *
 * Every write here is BEST-EFFORT: recording a sign-in attempt must never break
 * the sign-in itself, so failures are logged and swallowed. The model layer holds
 * all SQL (see docs/MVC_REFACTOR.md) — the routes call the audit helper in
 * src/lib/loginAudit.js, never this file's SQL directly.
 *
 * `session_id` is intentionally never populated from a live session token: those
 * tokens are secrets and must not be persisted in a readable audit table.
 */

let schemaPromise = null;

/**
 * Create the two tables (and their indexes) on first use, idempotently. They
 * normally ship with the Venture schema, but a sign-in must not depend on the
 * Venture intake path having run first. Cached once per process; a failed attempt
 * clears the cache so a later call can retry.
 */
export function ensureLoginHistorySchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute({
        sql: "CREATE TABLE IF NOT EXISTS venture_login_history (id SERIAL PRIMARY KEY, user_cid TEXT, user_name TEXT, user_email TEXT, action TEXT NOT NULL, ip_address TEXT, user_agent TEXT, device TEXT, browser TEXT, os TEXT, country TEXT, city TEXT, is_success BOOLEAN DEFAULT TRUE, failure_reason TEXT, session_id TEXT, created_at TIMESTAMP DEFAULT NOW())",
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_venture_login_history_user ON venture_login_history(user_cid)",
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_venture_login_history_created ON venture_login_history(created_at DESC)",
        args: [],
      });
      await db.execute({
        sql: "CREATE TABLE IF NOT EXISTS venture_failed_logins (id SERIAL PRIMARY KEY, identifier TEXT NOT NULL, ip_address TEXT, attempted_at TIMESTAMP DEFAULT NOW())",
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_venture_failed_logins_identifier ON venture_failed_logins(identifier)",
        args: [],
      });
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

/**
 * Append one sign-in attempt (success or failure) to the login history.
 * `action` is a machine code the console maps to a translated label — never a
 * hardcoded English sentence. `failureReason` is likewise a code, not prose.
 */
export async function recordLoginAttempt({
  userCid = null,
  userName = null,
  userEmail = null,
  action,
  isSuccess = true,
  failureReason = null,
  ipAddress = null,
  userAgent = null,
  sessionId = null,
} = {}) {
  try {
    await ensureLoginHistorySchema();
    const { browser, os, device } = summarizeUserAgent(userAgent);
    await db.execute({
      sql: `INSERT INTO venture_login_history (user_cid, user_name, user_email, action, ip_address, user_agent, device, browser, os, is_success, failure_reason, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        userCid,
        userName,
        userEmail,
        action,
        ipAddress,
        userAgent,
        device,
        browser,
        os,
        isSuccess ? true : false,
        failureReason,
        sessionId,
      ],
    });
    return { success: true };
  } catch (error) {
    console.error("Login history write failed:", error.message);
    return null;
  }
}

/**
 * Append a failed attempt keyed by the identifier the caller typed (email or
 * username), for lockout detection. Case-folded so the same account produces one
 * identifier regardless of how it was typed.
 */
export async function recordFailedLogin({ identifier, ipAddress = null } = {}) {
  if (!identifier) return null;
  try {
    await ensureLoginHistorySchema();
    await db.execute({
      sql: "INSERT INTO venture_failed_logins (identifier, ip_address) VALUES (?, ?)",
      args: [String(identifier).trim().toLowerCase(), ipAddress],
    });
    return { success: true };
  } catch (error) {
    console.error("Failed-login write failed:", error.message);
    return null;
  }
}

export default { ensureLoginHistorySchema, recordLoginAttempt, recordFailedLogin };
