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

export const MEMBERSHIP_STATUSES = ["active", "expired", "ended"];
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
    })().catch((e) => {
      console.warn("[Membership] ensureMembershipSchema failed:", e.message);
      membershipSchemaPromise = null; // allow retry
      return false;
    });
  }
  return membershipSchemaPromise;
}

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

/** Group names are normalized to UPPERCASE everywhere (matches user_groups). */
export function normalizeGroupName(name) {
  return String(name || "").trim().toUpperCase();
}

/** A membership contributes to authorization only while active and unexpired. */
export function isEffectiveMembership(status, expiresAt, now = new Date()) {
  if (String(status || "").toLowerCase() !== "active") return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > now.getTime();
}

/**
 * Pure effective-group selection.
 *
 * - Active, unexpired membership rows are effective.
 * - Legacy rows (user_groups edges with NO membership record) are treated as
 *   active — auto-heal so nothing ever silently loses access. Expired
 *   memberships are authoritative over any legacy edge (callers should only
 *   emit legacy rows when no membership record exists).
 *
 * @param {Array<{group_name, status, expires_at}>} membershipRows
 * @param {Array<{group_name}>} legacyRows
 * @param {Date} [now]
 * @returns {string[]} effective group names
 */
export function selectEffectiveGroups(membershipRows = [], legacyRows = [], now = new Date()) {
  const effective = [];
  const seen = new Set();
  // Any group with a membership record is governed by that record — a stale
  // legacy edge must never resurrect an expired/ended membership.
  const hasMembershipRecord = new Set(
    (membershipRows || []).map((r) => r.group_name),
  );
  for (const r of membershipRows || []) {
    if (isEffectiveMembership(r.status, r.expires_at, now) && !seen.has(r.group_name)) {
      seen.add(r.group_name);
      effective.push(r.group_name);
    }
  }
  for (const r of legacyRows || []) {
    if (hasMembershipRecord.has(r.group_name)) continue;
    if (!seen.has(r.group_name)) {
      seen.add(r.group_name);
      effective.push(r.group_name);
    }
  }
  return effective;
}

/**
 * Pure lifecycle transition: computes the new membership row + the event to
 * record for an action. NEVER duplicates the person — renewal updates the
 * existing row.
 *
 * @param {{user_cid, group_name, started_at, expires_at, status}} current
 * @param {string} action  one of MEMBERSHIP_ACTIONS
 * @param {{actor?: string, note?: string, expires_at?: string|null}} opts
 *   opts.expires_at applies to joined/activated/renewed (null = no expiry).
 * @param {Date} [now]
 * @returns {{row: {status, started_at, expires_at}, event: {action, actor_cid, note}}}
 */
export function applyMembershipAction(current, action, opts = {}, now = new Date()) {
  const a = String(action || "").toLowerCase();
  if (!MEMBERSHIP_ACTIONS.includes(a)) {
    throw new Error(`Unknown membership action: ${action}`);
  }
  const event = {
    action: a,
    actor_cid: opts.actor || null,
    note: opts.note || null,
  };
  switch (a) {
    case "joined":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          expires_at: opts.expires_at !== undefined ? opts.expires_at : current.expires_at ?? null,
        },
        event,
      };
    case "activated":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          expires_at: opts.expires_at !== undefined ? opts.expires_at : current.expires_at ?? null,
        },
        event,
      };
    case "renewed":
      return {
        row: {
          status: "active",
          started_at: current.started_at || now,
          // Renewal keeps the original start and sets a new expiry (null = no expiry).
          expires_at: opts.expires_at !== undefined ? opts.expires_at : null,
        },
        event,
      };
    case "deactivated":
      return { row: { status: "ended", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    case "expired":
      return { row: { status: "expired", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    case "ended":
      return { row: { status: "ended", started_at: current.started_at || now, expires_at: current.expires_at ?? null }, event };
    default:
      throw new Error(`Unknown membership action: ${action}`);
  }
}

// ─── Database helpers ────────────────────────────────────────────────────────

/** Is this group protected (only Super Admin / org_membership.manage)? */
export async function isGroupProtected(groupName) {
  await ensureMembershipSchema();
  const name = normalizeGroupName(groupName);
  const r = await db.execute({
    sql: "SELECT is_protected FROM groups WHERE name = ?",
    args: [name],
  });
  return r.rows.length > 0 && Number(r.rows[0].is_protected) === 1;
}

/**
 * Effective groups for a user (single query, egress-neutral):
 * active memberships + legacy user_groups edges without a membership record.
 */
export async function getEffectiveGroupsForUser(cid) {
  await ensureMembershipSchema();
  const r = await db.execute({
    sql: `SELECT gm.group_name AS group_name, 'membership' AS source
          FROM group_memberships gm
          WHERE gm.user_cid = ?
          UNION ALL
          SELECT ug.group_name, 'legacy'
          FROM user_groups ug
          LEFT JOIN group_memberships gm2
            ON gm2.user_cid = ug.user_cid AND gm2.group_name = ug.group_name
          WHERE ug.user_cid = ? AND gm2.user_cid IS NULL`,
    args: [cid, cid],
  });
  return selectEffectiveGroups(
    r.rows.filter((x) => x.source === "membership"),
    r.rows.filter((x) => x.source === "legacy"),
  );
}

/** Current membership row for a user+group (or null). */
export async function getMembership(userCid, groupName) {
  await ensureMembershipSchema();
  const r = await db.execute({
    sql: `SELECT user_cid, group_name, started_at, expires_at, status
          FROM group_memberships WHERE user_cid = ? AND group_name = ?`,
    args: [userCid, normalizeGroupName(groupName)],
  });
  return r.rows[0] || null;
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
  const [ug, cc] = await Promise.all([
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
    ...new Set([...ug.rows, ...cc.rows].map((r) => r.group_name)),
  ];

  // 2. groups metadata (INSERT-only; never overwrites admin metadata).
  for (const name of groupNames) {
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
  const [ugEdges, ccEdges] = await Promise.all([
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
  for (const edge of [...ugEdges.rows, ...ccEdges.rows]) {
    const key = `${edge.user_cid}|${normalizeGroupName(edge.group_name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ins = await db.execute({
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
    if (ins.rowsAffected > 0) {
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
