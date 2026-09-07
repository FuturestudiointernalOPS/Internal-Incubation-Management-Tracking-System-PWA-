import db, { initDb } from "@/lib/db";

/**
 * Proper many-to-many contact <-> group membership.
 *
 * The table is created idempotently. If it is not available in the current
 * environment, calls gracefully fall back to the legacy denormalized
 * `contacts.group_name` field so the app never hard-fails.
 */

async function ensureMembershipTable() {
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS contact_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
        family_id TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'invitation',
        added_by TEXT,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(contact_cid, family_id)
      )`,
      args: [],
    });
    await db.execute({
      sql: "CREATE INDEX IF NOT EXISTS idx_cgm_contact ON contact_group_members(contact_cid)",
      args: [],
    });
    await db.execute({
      sql: "CREATE INDEX IF NOT EXISTS idx_cgm_family ON contact_group_members(family_id)",
      args: [],
    });
    return true;
  } catch (_) {
    return false;
  }
}

export async function addContactToGroup({ contactCid, familyId, source = "invitation", addedBy }) {
  if (!contactCid || !familyId) return;
  await initDb();

  // Keep the legacy single-group field in sync (first assigned group wins).
  try {
    await db.execute({
      sql: "UPDATE contacts SET group_name = COALESCE(NULLIF(TRIM(group_name), ''), ?) WHERE cid = ?",
      args: [familyId, contactCid],
    });
  } catch (_) {}

  const ok = await ensureMembershipTable();
  if (!ok) return;

  await db.execute({
    sql: `INSERT INTO contact_group_members (contact_cid, family_id, source, added_by)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (contact_cid, family_id) DO NOTHING`,
    args: [contactCid, familyId, source, addedBy || null],
  });
}

export async function removeContactFromGroup(contactCid, familyId) {
  if (!contactCid || !familyId) return;
  await initDb();
  const ok = await ensureMembershipTable();
  if (!ok) return;
  await db.execute({
    sql: "DELETE FROM contact_group_members WHERE contact_cid = ? AND family_id = ?",
    args: [contactCid, familyId],
  });
}

export async function listContactGroups(contactCid) {
  if (!contactCid) return [];
  await initDb();
  const ok = await ensureMembershipTable();
  if (!ok) return [];
  const res = await db.execute({
    sql: "SELECT family_id FROM contact_group_members WHERE contact_cid = ? ORDER BY added_at ASC",
    args: [contactCid],
  });
  return res.rows.map((r) => r.family_id);
}
