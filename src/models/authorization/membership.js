/**
 * ImpactOS — Authorization Foundation: ORGANIZATIONAL MEMBERSHIP (Phase 1)
 *
 * The membership layer sits BETWEEN identity and eligibility:
 *
 *     Identity / Role  →  Group Membership  →  Eligibility  →  Capabilities
 *
 * Membership answers: "Which organization/group does this person CURRENTLY
 * belong to?" — with a lifecycle (start/expiry/status/history).
 *
 * Layer (see docs/LAYER_SPLIT.md): this module is the REPOSITORY — the schema,
 * the one-time bootstrap writes, the raw reads and the shared vocabulary. The
 * membership DECISIONS (`isEffectiveMembership`, `selectEffectiveGroups`,
 * `applyMembershipAction`) and the effective-group composition live in
 * `@/services/authorization/membership`.
 *
 * Design rules:
 * - `groups` metadata: FUTURE STUDIO is a PROTECTED group (is_protected=1).
 *   Protected-group writes require the dedicated org_membership.manage
 *   capability — generic CRM access or assign_capabilities must NEVER grant
 *   the ability to manage the internal organization.
 * - `group_memberships`: the current lifecycle state. expires_at = NULL means
 *   no expiry. Expiry/ending NEVER deletes the person, account, CRM record,
 *   program history or previous memberships — it only stops contributing to
 *   authorization (resolver + login read EFFECTIVE memberships).
 * - `group_membership_events`: immutable history (joined/activated/
 *   deactivated/renewed/expired/ended + actor + note). A renewal updates the
 *   EXISTING membership row and records an event — never a duplicate person.
 * - Legacy zero-loss: user_groups edges WITHOUT a membership record are
 *   treated as active (auto-heal), so no write path or pre-bootstrap state
 *   can ever cause silent access loss. The one-time bootstrap migration
 *   (membership-bootstrap-v1) creates active, no-expiry memberships for every
 *   existing edge — cutover is behavior-neutral.
 */

import db from "@/lib/db";

export const INTERNAL_GROUP = "FUTURE STUDIO";

export const MEMBERSHIP_ACTIONS = [
  "joined",
  "activated",
  "deactivated",
  "renewed",
  "expired",
  "ended",
];

let membershipSchemaPromise = null;

/** Self-healing schema (no formal migrations required — same pattern as the
 *  rest of the authorization foundation). */
export function ensureMembershipSchema() {
  if (!membershipSchemaPromise) {
    membershipSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        is_protected INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS group_memberships (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        group_name TEXT NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT,
        updated_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, group_name)
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_group_memberships_user
        ON group_memberships(user_cid, status)`);
      await db.execute(`CREATE TABLE IF NOT EXISTS group_membership_events (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        group_name TEXT NOT NULL,
        action TEXT NOT NULL,
        actor_cid TEXT,
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_membership_events_lookup
        ON group_membership_events(user_cid, group_name)`);
      return true;
    })().catch((error) => {
      console.warn("[Membership] ensureMembershipSchema failed:", error.message);
      membershipSchemaPromise = null; // allow retry
      return false;
    });
  }
  return membershipSchemaPromise;
}

/** Group names are normalized to UPPERCASE everywhere (matches user_groups). */
export function normalizeGroupName(name) {
  return String(name || "").trim().toUpperCase();
}

// ─── Database reads ──────────────────────────────────────────────────────────

/** True when the user has any participant_programs row (transitional legacy-role derivation, I2). */
export async function hasActiveParticipantProgram(cid) {
  const result = await db.execute({
    sql: "SELECT 1 FROM participant_programs WHERE participant_id = ? LIMIT 1",
    args: [cid],
  });
  return result.rows.length > 0;
}

/** True when the user is an active venture owner/founder (transitional derivation, I2). */
export async function isActiveVentureOwner(cid) {
  const result = await db.execute({
    sql: `SELECT 1 FROM venture_members
          WHERE (user_cid = ? OR contact_id = ?) AND is_owner = TRUE AND removed_at IS NULL LIMIT 1`,
    args: [cid, cid],
  });
  return result.rows.length > 0;
}

/** Is this group protected (only Super Admin / org_membership.manage)? */
export async function isGroupProtected(groupName) {
  await ensureMembershipSchema();
  const name = normalizeGroupName(groupName);
  const result = await db.execute({
    sql: "SELECT is_protected FROM groups WHERE name = ?",
    args: [name],
  });
  return result.rows.length > 0 && Number(result.rows[0].is_protected) === 1;
}

/**
 * The SAME answer as isGroupProtected for a LIST of groups, in ONE statement.
 *
 * A membership listing holds N rows spread over G groups; asking per group sent
 * G statements on the widest screen of the org-membership tab. This read takes
 * the whole set at once and returns a map, so the caller does not keep a cache
 * on top of a loop.
 *
 * A group with no row is absent from the map — not protected, which is exactly
 * what isGroupProtected returned for it.
 *
 * @param {string[]} groupNames
 * @returns {Promise<Object<string, boolean>>} normalized name → is_protected
 */
export async function getProtectedGroupFlags(groupNames) {
  const names = [...new Set((groupNames || []).map((name) => normalizeGroupName(name)))];
  if (names.length === 0) return {};

  const placeholders = names.map(() => "?").join(",");
  const result = await db.execute({
    sql: `SELECT name, is_protected FROM groups WHERE name IN (${placeholders})`,
    args: names,
  });

  const flags = {};
  for (const row of result.rows) {
    flags[row.name] = Number(row.is_protected) === 1;
  }
  return flags;
}

/**
 * The person's raw membership rows, membership-sourced and legacy-sourced, from
 * ONE query.
 *
 * Both questions read the SAME rows for the same person: which groups count
 * right now, and which memberships have ended. Asking them separately sent the
 * same table twice, and then discarded the ended rows the first read had already
 * fetched - a whole statement on the widest burst of the post-login screen. The
 * extra columns are carried for the history; the resolution still sees exactly
 * the rows it saw before.
 *
 * The decision about which rows are EFFECTIVE lives in the service.
 *
 * @returns {Promise<{rows: Array<{group_name, source, status, started_at, expires_at}>}>}
 */
export async function getMembershipRowsForUser(cid) {
  await ensureMembershipSchema();
  return db.execute({
    sql: `SELECT gm.group_name AS group_name, 'membership' AS source,
                 gm.status AS status, gm.started_at AS started_at, gm.expires_at AS expires_at
          FROM group_memberships gm
          WHERE gm.user_cid = ?
          UNION ALL
          SELECT ug.group_name, 'legacy', NULL, NULL, NULL
          FROM user_groups ug
          LEFT JOIN group_memberships gm2
            ON gm2.user_cid = ug.user_cid AND gm2.group_name = ug.group_name
          WHERE ug.user_cid = ? AND gm2.user_cid IS NULL`,
    args: [cid, cid],
  });
}

/** Current membership row for a user+group (or null). */
export async function getMembership(userCid, groupName) {
  await ensureMembershipSchema();
  const result = await db.execute({
    sql: `SELECT user_cid, group_name, started_at, expires_at, status
          FROM group_memberships WHERE user_cid = ? AND group_name = ?`,
    args: [userCid, normalizeGroupName(groupName)],
  });
  return result.rows[0] || null;
}

// ─── One-time bootstrap (idempotent; wired into backfill.js) ─────────────────

/**
 * Bootstrap existing group data into the membership layer with ZERO behavior
 * change: every existing user_groups / contacts.group_name edge becomes an
 * active, no-expiry membership (plus a 'joined' event, actor=system). Also
 * seeds `groups` metadata for every distinct group name (FUTURE STUDIO is the
 * only protected one). Runs once per database via runAuthzMigration.
 */
export async function ensureMembershipBootstrap() {
  await ensureMembershipSchema();

  // 1. Distinct group names from user_groups + contacts.group_name.
  const [userGroupsResult, contactsResult] = await Promise.all([
    db.execute({
      sql: "SELECT DISTINCT group_name FROM user_groups WHERE group_name IS NOT NULL AND group_name != ''",
      args: [],
    }),
    db.execute({
      sql: `SELECT DISTINCT group_name FROM contacts
            WHERE group_name IS NOT NULL AND group_name != ''
              AND UPPER(group_name) != 'UNASSIGNED'`,
      args: [],
    }),
  ]);
  const groupNames = [
    ...new Set([...userGroupsResult.rows, ...contactsResult.rows].map((row) => row.group_name)),
  ];

  // 2. groups metadata (INSERT-only; never overwrites admin metadata).
  //    Names are normalized to UPPERCASE so one group can never exist as
  //    multiple case variants in the metadata table.
  for (const rawGroupName of groupNames) {
    const name = normalizeGroupName(rawGroupName);
    await db.execute({
      sql: `INSERT INTO groups (name, description, is_protected, is_active)
            VALUES (?, '', CASE WHEN UPPER(?) = ? THEN 1 ELSE 0 END, 1)
            ON CONFLICT (name) DO NOTHING`,
      args: [name, name, INTERNAL_GROUP],
    });
  }
  // FUTURE STUDIO is protected even if no current members exist.
  await db.execute({
    sql: `INSERT INTO groups (name, description, is_protected, is_active)
          VALUES (?, '', 1, 1) ON CONFLICT (name) DO NOTHING`,
    args: [INTERNAL_GROUP],
  });

  // 3. Active memberships for every existing edge (user_groups + contacts).
  const [userGroupEdges, contactEdges] = await Promise.all([
    db.execute({
      sql: "SELECT user_cid, group_name FROM user_groups WHERE group_name IS NOT NULL AND group_name != ''",
      args: [],
    }),
    db.execute({
      sql: `SELECT cid AS user_cid, group_name FROM contacts
            WHERE group_name IS NOT NULL AND group_name != ''
              AND UPPER(group_name) != 'UNASSIGNED'`,
      args: [],
    }),
  ]);
  const seen = new Set();
  for (const edge of [...userGroupEdges.rows, ...contactEdges.rows]) {
    const key = `${edge.user_cid}|${normalizeGroupName(edge.group_name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const insertResult = await db.execute({
      sql: `INSERT INTO group_memberships
              (user_cid, group_name, started_at, expires_at, status, created_by)
            VALUES (?, ?, NOW(), NULL, 'active', 'system')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
      args: [edge.user_cid, normalizeGroupName(edge.group_name)],
    });
    // Mirror into user_groups so legacy consumers (workspaces hub org
    // memberships, role_in_group lookups) see the same edge. Production
    // membership lives on contacts.group_name with an empty user_groups, so
    // without this mirror the hub would stay blank after bootstrap.
    await db.execute({
      sql: `INSERT INTO user_groups (user_cid, group_name, assigned_by)
            VALUES (?, ?, 'system')
            ON CONFLICT (user_cid, group_name) DO NOTHING`,
      args: [edge.user_cid, normalizeGroupName(edge.group_name)],
    });
    // Event only when the membership was actually inserted (idempotent retry).
    if (insertResult.rowsAffected > 0) {
      await db.execute({
        sql: `INSERT INTO group_membership_events
                (user_cid, group_name, action, actor_cid, note)
              VALUES (?, ?, 'joined', 'system', 'bootstrap')`,
        args: [edge.user_cid, normalizeGroupName(edge.group_name)],
      });
    }
  }
  return { success: true, groups: groupNames.length };
}
