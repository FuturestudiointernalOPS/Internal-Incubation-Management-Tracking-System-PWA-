import db from "@/lib/db";

/**
 * Invitation/account activation status helpers.
 *
 * Reuses the existing `password_setup_tokens` table and `contacts` model —
 * no new tables are required. Status is derived, never stored separately:
 *
 *   - "activated"     -> account is active (or a password has been set)
 *   - "sent"          -> an unused, non-expired invitation token exists
 *   - "expired"       -> invitation token(s) exist but all are expired
 *   - "not_invited"   -> contact exists with no invitation token and no account
 */

export function isInvitationExpired(expiresAt) {
  if (!expiresAt) return true;
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() <= Date.now();
}

export function isContactActivated(contact) {
  if (!contact) return false;
  return (
    contact.status === "active" ||
    !!(contact.password && String(contact.password).trim())
  );
}

export function deriveInvitationStatus(contact, tokens = []) {
  if (isContactActivated(contact)) return "activated";
  if (!tokens || tokens.length === 0) return "not_invited";
  return tokens.some((t) => !isInvitationExpired(t.expires_at))
    ? "sent"
    : "expired";
}

/**
 * Given a list of contact rows, attach `invitation_status` and
 * `invitation_expires_at` using a single bulk token query (no N+1).
 */
export async function attachInvitationStatus(contacts) {
  if (!contacts || contacts.length === 0) return contacts;

  const cids = [...new Set(contacts.map((c) => c.cid).filter(Boolean))];
  if (cids.length === 0) return contacts;

  const placeholders = cids.map(() => "?").join(",");
  let rows = [];
  try {
    const res = await db.execute({
      sql: `SELECT contact_cid, used, expires_at, created_at
            FROM password_setup_tokens
            WHERE used = 0 AND contact_cid IN (${placeholders})
            ORDER BY created_at DESC`,
      args: cids,
    });
    rows = res.rows || [];
  } catch (_) {
    rows = [];
  }

  const byCid = {};
  for (const row of rows) {
    if (!byCid[row.contact_cid]) byCid[row.contact_cid] = [];
    byCid[row.contact_cid].push(row);
  }

  return contacts.map((c) => {
    const tokens = byCid[c.cid] || [];
    const latest = tokens[0];
    return {
      ...c,
      invitation_status: deriveInvitationStatus(c, tokens),
      invitation_expires_at: latest?.expires_at || null,
    };
  });
}
