import db, { initDb } from "@/lib/db";

/**
 * CONTACT IDENTITY & VENTURE ROLE HISTORY (Phase 2)
 *
 * Additive identity reconciliation on the existing Contact model:
 *   - contact_emails   : primary + alternative emails per Contact (new table)
 *   - contacts.phone_norm : normalized (digits-only) phone for matching
 *   - resolvePersonIdentity(): primary email → alternative email → phone →
 *     matched / conflict (manual reconciliation) / new
 *   - contact_duplicate_flags: existing CRM manual-reconciliation table used
 *     when identity evidence conflicts (never auto-merge)
 *   - syncVentureRoleHistory(): append-only mirror of Venture memberships in
 *     the existing contact_roles table (context_type='venture')
 *
 * Everything is additive and idempotent; every query is defensive so a
 * missing column/table can never break the approval pipeline.
 */

let schemaPromise = null;
let rolesSchemaPromise = null;
let duplicateFlagsSchemaPromise = null;

async function safe(sql, args = []) {
  try {
    const r = await db.execute({ sql, args });
    return r || { rows: [] };
  } catch (_) {
    return { rows: [] };
  }
}

/** Email normalization: lowercase + trimmed. */
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Phone normalization: digits only (used for matching). */
export function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function ensureContactRolesTable() {
  if (!rolesSchemaPromise) {
    rolesSchemaPromise = db
      .execute({
        sql: `CREATE TABLE IF NOT EXISTS contact_roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
          role TEXT NOT NULL,
          context_type TEXT,
          context_id TEXT,
          is_current BOOLEAN DEFAULT true,
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMPTZ,
          assigned_by TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        args: [],
      })
      .catch(() => null);
  }
  return rolesSchemaPromise;
}

function ensureDuplicateFlagsTable() {
  if (!duplicateFlagsSchemaPromise) {
    duplicateFlagsSchemaPromise = db
      .execute({
        sql: `CREATE TABLE IF NOT EXISTS contact_duplicate_flags (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          contact_cid_a TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
          contact_cid_b TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
          match_reason TEXT NOT NULL,
          confidence DECIMAL(3,2) DEFAULT 0.50,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')),
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(contact_cid_a, contact_cid_b)
        )`,
        args: [],
      })
      .catch(() => null);
  }
  return duplicateFlagsSchemaPromise;
}

/**
 * Create the additive identity schema (idempotent, runtime self-healing):
 * contact_emails table + contacts.phone_norm column/index + backfill of
 * primary emails and phone normalization from existing contact rows.
 */
export async function ensureContactIdentitySchema() {
  await initDb();
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS contact_emails (
          id SERIAL PRIMARY KEY,
          contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
          email TEXT NOT NULL,
          label TEXT NOT NULL DEFAULT 'alternative' CHECK (label IN ('primary', 'alternative')),
          is_verified BOOLEAN NOT NULL DEFAULT true,
          source TEXT NOT NULL DEFAULT 'manual',
          created_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        args: [],
      });
      await db.execute({
        sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_emails_email ON contact_emails (email)",
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_contact_emails_contact ON contact_emails (contact_cid)",
        args: [],
      });
      await db.execute({
        sql: "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phone_norm TEXT",
        args: [],
      });
      await db.execute({
        sql: "CREATE INDEX IF NOT EXISTS idx_contacts_phone_norm ON contacts (phone_norm)",
        args: [],
      });
      // Backfill primary emails (idempotent).
      await db.execute({
        sql: `INSERT INTO contact_emails (contact_cid, email, label, is_verified, source)
              SELECT cid, LOWER(TRIM(email)), 'primary', true, 'backfill'
              FROM contacts
              WHERE email IS NOT NULL AND LOWER(TRIM(email)) <> ''
              ON CONFLICT (email) DO NOTHING`,
        args: [],
      });
      // Backfill the legacy single alternative_email column into the
      // multi-email table when the column exists (guarded, additive).
      try {
        const legacyCol = await safe(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'alternative_email'",
          [],
        );
        if ((legacyCol.rows || []).length > 0) {
          await db
            .execute({
              sql: `INSERT INTO contact_emails (contact_cid, email, label, is_verified, source)
                    SELECT cid, LOWER(TRIM(alternative_email)), 'alternative', true, 'legacy_profile'
                    FROM contacts
                    WHERE alternative_email IS NOT NULL AND LOWER(TRIM(alternative_email)) <> ''
                      AND LOWER(TRIM(alternative_email)) <> LOWER(email)
                    ON CONFLICT (email) DO NOTHING`,
              args: [],
            })
            .catch(() => null);
        }
      } catch (_) {}
      // Backfill normalized phones (idempotent).
      await db.execute({
        sql: `UPDATE contacts
              SET phone_norm = regexp_replace(phone, '[^0-9]', '', 'g')
              WHERE phone IS NOT NULL AND phone <> ''
                AND (phone_norm IS NULL OR phone_norm = '')`,
        args: [],
      });
      return true;
    } catch (e) {
      console.warn("[Contact Identity] schema ensure failed:", e.message);
      return false;
    }
  })();
  return schemaPromise;
}

let backfillPromise = null;

/**
 * PHASE 2 — the neutral default role is 'member', not 'participant'.
 *
 * 1. Existing databases: change the column default so any future contact
 *    created without an explicit role is a neutral member (fresh installs
 *    already get this from supabase/v2_schema_init.sql).
 * 2. Conservative one-time backfill: contacts still carrying the legacy
 *    'participant' role WITHOUT any real program/group/venture relationship
 *    become 'member'. Genuine participants (participant_programs or
 *    v2_participants), legacy group members, and venture members are NEVER
 *    touched. The UPDATE is naturally idempotent (safe to re-run); executed
 *    once per process via a cached promise.
 */
export function backfillNeutralParticipantRoles() {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      try {
        await db.execute({
          sql: "ALTER TABLE contacts ALTER COLUMN role SET DEFAULT 'member'",
          args: [],
        });
      } catch (e) {
        console.warn("[Contact Identity] role default change skipped:", e.message);
      }
      try {
        await safe(
          `UPDATE contacts c
           SET role = 'member'
           WHERE c.role = 'participant'
             AND NOT EXISTS (SELECT 1 FROM participant_programs pp WHERE pp.participant_id = c.cid)
             AND NOT EXISTS (
               SELECT 1 FROM v2_participants vp
               WHERE vp.user_id = c.cid OR vp.email = c.email
             )
             AND NOT EXISTS (SELECT 1 FROM user_groups ug WHERE ug.user_cid = c.cid)
             AND (c.group_name IS NULL OR c.group_name = '')
             AND NOT EXISTS (
               SELECT 1 FROM venture_members vm
               WHERE vm.contact_id = c.cid AND vm.removed_at IS NULL
             )`,
          [],
        );
      } catch (e) {
        console.warn("[Contact Identity] neutral role backfill skipped:", e.message);
      }
      return true;
    })();
  }
  return backfillPromise;
}

/**
 * Resolve a person from email + phone against the existing Contact model.
 *
 * Precedence: primary email → alternative email(s) → phone.
 * Returns:
 *   { status: "matched", contact_cid, sources[] }
 *   { status: "conflict", matches: [{contact_cid, sources[]}], flagged: bool }
 *   { status: "new" }
 *
 * Never auto-merges; conflicts are flagged into contact_duplicate_flags
 * (manual CRM reconciliation is the authority).
 */
export async function resolvePersonIdentity({ email, phone } = {}) {
  const sourcesByCid = new Map();
  const addSource = (cid, source) => {
    if (!cid) return;
    if (!sourcesByCid.has(cid)) sourcesByCid.set(cid, []);
    if (!sourcesByCid.get(cid).includes(source)) sourcesByCid.get(cid).push(source);
  };

  await ensureContactIdentitySchema().catch(() => false);

  const emailNorm = normalizeEmail(email);
  if (emailNorm && emailNorm.includes("@")) {
    // Primary email (contacts.email)
    const prim = await safe(
      "SELECT cid, deleted FROM contacts WHERE LOWER(email) = ?",
      [emailNorm],
    );
    for (const row of prim.rows || []) {
      if (Number(row.deleted) === 0) addSource(row.cid, "primary_email");
    }
    // Alternative emails (contact_emails) — must still be an active contact.
    const alt = await safe(
      `SELECT ce.contact_cid AS cid
       FROM contact_emails ce
       JOIN contacts c ON c.cid = ce.contact_cid
       WHERE ce.email = ? AND c.deleted = 0`,
      [emailNorm],
    );
    for (const row of alt.rows || []) addSource(row.cid, "alternative_email");
  }

  const phoneNorm = normalizePhone(phone);
  if (phoneNorm && phoneNorm.length >= 6) {
    const ph = await safe(
      "SELECT cid FROM contacts WHERE phone_norm = ? AND deleted = 0",
      [phoneNorm],
    );
    for (const row of ph.rows || []) addSource(row.cid, "phone");
  }

  const cids = [...sourcesByCid.keys()];
  if (cids.length === 0) return { status: "new" };
  if (cids.length === 1) {
    return { status: "matched", contact_cid: cids[0], sources: sourcesByCid.get(cids[0]) };
  }

  // Conflict: different contacts matched by different identifiers.
  const flagged = await flagIdentityConflict({
    cidA: cids[0],
    cidB: cids[1],
    reason: `Identity conflict during intake: email/phone resolved to multiple contacts (${cids.join(", ")}).`,
  });
  return {
    status: "conflict",
    matches: cids.map((cid) => ({ contact_cid: cid, sources: sourcesByCid.get(cid) })),
    flagged,
  };
}

/** Flag a duplicate pair for manual CRM reconciliation (idempotent). */
export async function flagIdentityConflict({ cidA, cidB, reason }) {
  if (!cidA || !cidB || cidA === cidB) return false;
  await ensureDuplicateFlagsTable();
  const [a, b] = [String(cidA), String(cidB)].sort();
  const res = await safe(
    `INSERT INTO contact_duplicate_flags (contact_cid_a, contact_cid_b, match_reason, confidence, status)
     VALUES (?, ?, ?, 0.50, 'pending')
     ON CONFLICT (contact_cid_a, contact_cid_b) DO NOTHING
     RETURNING id`,
    [a, b, reason || "Identity conflict"],
  );
  return (res.rows || []).length > 0;
}

/** Resolve an email to an existing contact or create a minimal new one. */
export async function resolveOrCreateContactIdentity({ email, name, role = "member", status = "pending" }) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !emailNorm.includes("@")) return null;

  const ident = await resolvePersonIdentity({ email: emailNorm, phone: null });
  if (ident.status === "matched") return ident.contact_cid;
  if (ident.status === "conflict") return null; // never auto-create on conflict

  const existing = await safe("SELECT cid FROM contacts WHERE LOWER(email) = ?", [emailNorm]);
  if ((existing.rows || []).length > 0) return existing.rows[0].cid;

  const cid = "USR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
  await safe(
    `INSERT INTO contacts (cid, name, email, role, status)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET
       name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name)`,
    [cid, name || "Venture Member", emailNorm, role, status],
  );
  return cid;
}

/** Add an alternative email to a Contact (self/staff). Never duplicates across people. */
export async function addContactEmail({ contactCid, email, actorCid, source = "manual" }) {
  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !emailNorm.includes("@")) {
    return { ok: false, error: "A valid email address is required." };
  }
  await ensureContactIdentitySchema().catch(() => false);

  // Same as the contact's primary email → nothing to do.
  const prim = await safe("SELECT email FROM contacts WHERE cid = ?", [contactCid]);
  if ((prim.rows || []).length > 0 && normalizeEmail(prim.rows[0].email) === emailNorm) {
    return { ok: true, exists: "primary" };
  }
  // Belongs to another contact already?
  const other = await safe(
    `SELECT ce.contact_cid
     FROM contact_emails ce
     WHERE ce.email = ? AND ce.contact_cid <> ?`,
    [emailNorm, contactCid],
  );
  if ((other.rows || []).length > 0) {
    return { ok: false, error: "This email is already associated with another Contact." };
  }
  const phoneCheck = await safe("SELECT cid FROM contacts WHERE LOWER(email) = ? AND cid <> ?", [emailNorm, contactCid]);
  if ((phoneCheck.rows || []).length > 0) {
    return { ok: false, error: "This email is already the primary email of another Contact." };
  }

  const ins = await safe(
    `INSERT INTO contact_emails (contact_cid, email, label, is_verified, source, created_by)
     VALUES (?, ?, 'alternative', true, ?, ?)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [contactCid, emailNorm, source, actorCid || null],
  );
  if ((ins.rows || []).length === 0) {
    return { ok: false, error: "This email is already on this Contact." };
  }
  return { ok: true, id: ins.rows[0].id };
}

export async function listContactEmails(contactCid) {
  if (!contactCid) return [];
  await ensureContactIdentitySchema().catch(() => false);
  const res = await safe(
    "SELECT id, email, label, is_verified, source, created_at FROM contact_emails WHERE contact_cid = ? ORDER BY label, created_at",
    [contactCid],
  );
  return res.rows || [];
}

export async function removeContactEmail({ id, contactCid }) {
  const row = await safe(
    "SELECT id, label FROM contact_emails WHERE id = ? AND contact_cid = ?",
    [id, contactCid],
  );
  if ((row.rows || []).length === 0) return { ok: false, error: "Email not found." };
  if (row.rows[0].label === "primary") {
    return { ok: false, error: "The primary email cannot be removed here." };
  }
  await safe("DELETE FROM contact_emails WHERE id = ? AND contact_cid = ?", [id, contactCid]);
  return { ok: true };
}

/**
 * Append-only Venture membership history mirrored into contact_roles
 * (context_type='venture'). active=true opens a new current row (closing the
 * previous current one for that person+venture); active=false only closes.
 */
export async function syncVentureRoleHistory({ contactCid, ventureId, role, active = true, actorCid = null, notes = null }) {
  if (!contactCid || !ventureId) return;
  await ensureContactRolesTable();

  await db
    .execute({
      sql: `UPDATE contact_roles
            SET is_current = false, ended_at = NOW()
            WHERE contact_cid = ? AND context_type = 'venture' AND context_id = ? AND is_current = true`,
      args: [contactCid, ventureId],
    })
    .catch(() => null);

  if (!active) return;
  await db
    .execute({
      sql: `INSERT INTO contact_roles (contact_cid, role, context_type, context_id, is_current, started_at, assigned_by, notes)
            VALUES (?, ?, 'venture', ?, true, NOW(), ?, ?)`,
      args: [contactCid, role || "member", ventureId, actorCid || null, notes || null],
    })
    .catch(() => null);
}

export default {
  ensureContactIdentitySchema,
  normalizeEmail,
  normalizePhone,
  resolvePersonIdentity,
  flagIdentityConflict,
  resolveOrCreateContactIdentity,
  addContactEmail,
  listContactEmails,
  removeContactEmail,
  syncVentureRoleHistory,
  backfillNeutralParticipantRoles,
};
