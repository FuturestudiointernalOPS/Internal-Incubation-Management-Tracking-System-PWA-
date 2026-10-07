/**
 * ImpactOS — Authorization Foundation: CONTEXT ROLE → PROFILE REGISTRY (Phase 4)
 *
 * The identity correction established that Founder, Investor, Participant,
 * Facilitator, Learner, … are CONTEXTUAL relationships layered on the three
 * baseline identities (Super Admin / Staff / Member) — see the Phase 1–3 map.
 * This registry is the single governance surface that answers, per context:
 *
 *     "When someone holds role X inside context Y, which access profile
 *      should seed their capabilities?"
 *
 * Semantics (deliberately conservative, Phase 4):
 *   - REGISTRY ONLY. Nothing in the authorization resolver reads this table
 *     yet — it is a mapping registry, not an enforcement mechanism. The
 *     resolver, gates and caches are untouched, so this phase cannot change
 *     anyone's effective access.
 *   - No new capabilities and no new profiles are created here. Rows point at
 *     EXISTING access profiles; an unmapped role is stored as profile_id NULL
 *     and stays visible (never hidden) — the honest "no default yet" state.
 *   - Scope is NOT encoded in the mapping. Applying the profile inside the
 *     right record boundaries is Phase 5 (Scope Engine) work; contextual
 *     application-at-membership-creation is a later, explicitly-approved step.
 *   - Seed rows are INSERT ... DO NOTHING: administrator edits always win and
 *     reseeding is idempotent.
 *
 * Consumers of the registry (future phases) MUST invalidate authorization
 * context caches on write; this phase intentionally does not, because no
 * resolver path consumes it yet.
 */

import db from "@/lib/db";
import { profileKeyForAccessProfileName } from "./profileTakeoverBackfill";

let contextRoleProfilesSchemaPromise = null;

/** Contexts a contextual role can belong to. */
export const CONTEXT_ROLE_CONTEXTS = ["program", "venture", "lms", "investor"];

/**
 * Seed catalogue — the initial registry.
 *
 * `profile_name` must match a profile created by seedDefaultAccessProfiles()
 * in src/lib/auth.js; NULL means "no default mapped yet" and is displayed as
 * an open gap, not hidden. `notes` records why (data, not UI copy).
 */
export const CONTEXT_ROLE_SEED = [
  {
    context: "program",
    role_key: "participant",
    profile_name: "Participant Default",
    notes: "Mirrors the existing role default (participant → Participant Default).",
  },
  {
    context: "program",
    role_key: "program_manager",
    profile_name: "Assigned Program Manager",
    notes:
      "Assignment-derived: managing ONE program needs the program module only, not the whole portfolio template (which also carries venture, reporting and CRM access). The role default program_manager → 'Program Manager' is untouched — this mapping is about the assignment.",
  },
  {
    context: "program",
    role_key: "facilitator",
    profile_name: null,
    notes:
      "INTENTIONALLY unmapped to a profile: a facilitator's grant is DERIVED from the per-program tick list (union of the levels the assignments actually grant), not from a template — see src/models/authorization/programAssignments.js. Pointing this row at a profile would grant capabilities the program manager never ticked. Left NULL on purpose; the reconcile reports the derivation.",
  },
  {
    context: "venture",
    role_key: "founder",
    profile_name: "Founder",
    notes:
      "Filled in Phase 5b: Founder profile (ventures.view) + venture_own scope — the mapping is metadata until a consuming phase applies it.",
  },
  {
    context: "venture",
    role_key: "team_member",
    profile_name: "Venture Member",
    notes:
      "Team members are members first (venture_members row), then given a team role — the Venture Member profile carries ventures.view; venture_own scope limits them to the Venture they were added to.",
  },
  {
    context: "lms",
    role_key: "learner",
    profile_name: "Learner",
    notes:
      "Enrollment-derived: anyone with access to a course is a learner. Phase E maps it to the 'Learner' template (lms.view), scoped by learning_own.",
  },
  {
    context: "venture",
    role_key: "venture_manager",
    profile_name: "Venture Manager",
    notes:
      "Phase E: the LEAD MANAGER of a venture (venture_staff_assignments.responsibility_code = 'lead_manager'). The 'Venture Manager' template carries ventures.view + ventures.edit, scoped by venture_own.",
  },
  {
    context: "investor",
    role_key: "investor",
    profile_name: "Mentor",
    notes: "Mirrors the existing role default (investor → Mentor).",
  },
];

/** Is this a context the registry knows how to store? */
export function isValidContextRoleContext(context) {
  return CONTEXT_ROLE_CONTEXTS.includes(String(context || ""));
}

/** Role keys are opaque lowercase identifiers (program_manager, team_member…). */
export function isValidContextRoleKey(roleKey) {
  return /^[a-z][a-z0-9_]{1,63}$/.test(String(roleKey || ""));
}

/**
 * Idempotent runtime self-healing for the registry table (same pattern as
 * ensureEligibilitySchema — no migration required, fail-soft on error).
 *
 * No FK to access_profiles on purpose: the table must be creatable even when
 * profiles are not seeded yet, and a dangling profile_id degrades to an
 * unmapped row on read. Writes validate profile existence in the controller.
 */
export function ensureContextRoleProfilesSchema() {
  if (!contextRoleProfilesSchemaPromise) {
    contextRoleProfilesSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS context_role_profiles (
        id SERIAL PRIMARY KEY,
        context TEXT NOT NULL,
        role_key TEXT NOT NULL,
        profile_id INTEGER,
        profile_key TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(context, role_key)
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_context_role_profiles_lookup
         ON context_role_profiles(context, role_key)`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureContextRoleProfilesSchema failed:", error.message);
      contextRoleProfilesSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return contextRoleProfilesSchemaPromise;
}

/**
 * Seed the initial registry rows. Idempotent: ON CONFLICT DO NOTHING means an
 * administrator's edit (including "removed the default") is never overwritten
 * by a later reseed. Rows whose profile name does not exist yet are stored
 * with profile_id NULL — the gap stays visible.
 */
export async function seedContextRoleProfiles() {
  try {
    await ensureContextRoleProfilesSchema();
    for (const row of CONTEXT_ROLE_SEED) {
      const profileKey = row.profile_name
        ? profileKeyForAccessProfileName(row.profile_name)
        : null;
      await db.execute({
        sql: `INSERT INTO context_role_profiles
                (context, role_key, profile_key, is_active, notes)
              VALUES (?, ?, ?, 1, ?)
              ON CONFLICT (context, role_key) DO NOTHING`,
        args: [row.context, row.role_key, profileKey, row.notes || ""],
      });
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Phase 6 repair: rows seeded BEFORE their mapped profile existed were stored
 * with profile_id NULL, and the seed's ON CONFLICT DO NOTHING kept them that
 * way (e.g. `venture:founder` was seeded in Phase 4; the "Founder" profile
 * only arrived in Phase 5b). Fill a NULL mapping once the named profile exists.
 *
 * Safety: only NULL rows are touched — a non-NULL profile_id is an
 * administrator decision and is never overwritten, and `is_active` is never
 * changed. Runs once per database via runAuthzMigration (see backfill.js) and
 * throws on failure so a failed pass is retried on the next boot.
 */
export async function backfillContextRoleProfileMappings() {
  await ensureContextRoleProfilesSchema();
  // Ensure the seed rows exist first (INSERT … DO NOTHING — admin rows win).
  const seeded = await seedContextRoleProfiles();
  if (!seeded.success) {
    throw new Error(seeded.error || "context role profile seed failed");
  }

  const updated = [];
  for (const row of CONTEXT_ROLE_SEED) {
    if (!row.profile_name) continue;
    const profileKey = profileKeyForAccessProfileName(row.profile_name);
    if (!profileKey) continue;
    const res = await db.execute({
      sql: `UPDATE context_role_profiles
            SET profile_key = ?, updated_at = NOW()
            WHERE context = ? AND role_key = ? AND profile_key IS NULL`,
      args: [profileKey, row.context, row.role_key],
    });
    updated.push({
      context: row.context,
      role_key: row.role_key,
      profile: row.profile_name,
      rowsAffected: res?.rowsAffected ?? 0,
    });
  }
  return { success: true, updated };
}

/**
 * How many registry rows map to a profile KEY — the delete guard's read, so a
 * profile the context registry still points at is not removed underneath it.
 */
export function countContextRoleProfilesByKey(profileKey) {
  return db.execute({
    sql: "SELECT COUNT(*)::int AS n FROM context_role_profiles WHERE profile_key = ?",
    args: [String(profileKey)],
  });
}

/** Every registry row, with the mapped profile name (LEFT JOIN, never hidden). */
export async function listContextRoleProfiles() {
  return db.execute({
    sql: `SELECT crp.id, crp.context, crp.role_key, crp.profile_key,
                 crp.is_active, crp.notes, crp.updated_at,
                 p.label AS profile_name
          FROM context_role_profiles crp
          LEFT JOIN profiles p ON p.key = crp.profile_key
          ORDER BY crp.context, crp.role_key`,
  });
}

/** Single registry row — the resolution helper future phases will consume. */
export async function getContextRoleProfile(context, roleKey) {
  return db.execute({
    sql: `SELECT crp.id, crp.context, crp.role_key, crp.profile_key,
                 crp.is_active, crp.notes,
                 p.label AS profile_name
          FROM context_role_profiles crp
          LEFT JOIN profiles p ON p.key = crp.profile_key
          WHERE crp.context = ? AND crp.role_key = ?
          LIMIT 1`,
    args: [context, roleKey],
  });
}

/** Upsert one mapping (create-or-update; used by the Permission Center). */
export async function upsertContextRoleProfile({
  context,
  roleKey,
  profileKey,
  isActive,
  notes,
}) {
  return db.execute({
    sql: `INSERT INTO context_role_profiles
            (context, role_key, profile_key, is_active, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (context, role_key) DO UPDATE SET
            profile_key = EXCLUDED.profile_key,
            is_active = EXCLUDED.is_active,
            notes = EXCLUDED.notes,
            updated_at = NOW()`,
    args: [context, roleKey, profileKey, isActive ? 1 : 0, notes || ""],
  });
}

/**
 * Informational count of relationships that currently exist for a context
 * role — READ-ONLY governance context for the registry UI ("how many people
 * hold this today?"). Unknown pairs return null (the UI shows "—"); the
 * lookup is fail-soft so a missing legacy table never breaks the registry.
 *
 * The pair → statement map is hoisted to a module constant: it was rebuilt on
 * every call, and the batch read below needs it as data rather than as a local.
 */
const CONTEXT_ROLE_HOLDER_QUERIES = {
  "program:participant": `COUNT(DISTINCT participant_id)::int FROM participant_programs`,
  "program:program_manager": `COUNT(DISTINCT assigned_pm_id)::int FROM v2_programs WHERE assigned_pm_id IS NOT NULL`,
  "program:facilitator": `COUNT(DISTINCT staff_id)::int FROM v2_program_staff WHERE role = 'facilitator'`,
  "venture:founder": `COUNT(DISTINCT contact_id)::int FROM venture_members
        WHERE member_type = 'founder' AND removed_at IS NULL`,
  "venture:team_member": `COUNT(DISTINCT contact_id)::int FROM venture_members
        WHERE member_type = 'team_member' AND removed_at IS NULL`,
  "lms:learner": `COUNT(DISTINCT user_cid)::int FROM lms_enrollments WHERE status <> 'suspended'`,
  "investor:investor": `COUNT(*)::int FROM investor_profiles`,
  "venture:venture_manager": `COUNT(DISTINCT staff_contact_id)::int FROM venture_staff_assignments WHERE responsibility_code = 'lead_manager' AND status = 'active'`,
};

/**
 * The holder counts for SEVERAL context roles in ONE statement.
 *
 * The registry lists every context role on screen, so counting one at a time
 * sent one statement per row — seven for the seeded catalogue. The counts are
 * independent subselects, so a single UNION ALL answers them all at once.
 *
 * Fail-soft semantics are preserved exactly: if the union fails (a missing
 * LEGACY table takes the whole statement down, whereas one row's table would
 * only have nulled that row), it falls back to counting pair by pair, so one
 * absent table still only costs its own row.
 *
 * A pair the map does not know is ABSENT from the result, which the caller
 * reads as null ("—" in the UI) — same as countContextRoleHolders.
 *
 * @param {Array<{context: string, roleKey: string}>} pairs
 * @returns {Promise<Object<string, number>>} "context:role_key" → count
 */
export async function countContextRoleHoldersBatch(pairs) {
  const wanted = [];
  for (const pair of pairs || []) {
    const key = `${pair.context}:${pair.roleKey}`;
    if (CONTEXT_ROLE_HOLDER_QUERIES[key] && !wanted.includes(key)) wanted.push(key);
  }
  if (wanted.length === 0) return {};

  // The labels come from the map's own keys, never from caller input.
  const sql = wanted
    .map(
      (key) =>
        `SELECT '${key}' AS pair, ${CONTEXT_ROLE_HOLDER_QUERIES[key]} AS c`,
    )
    .join("\nUNION ALL\n");

  try {
    const res = await db.execute({ sql, args: [] });
    const counts = {};
    for (const row of res.rows || []) {
      counts[row.pair] = Number(row.c ?? 0);
    }
    return counts;
  } catch (error) {
    console.warn(
      `[Authz] countContextRoleHoldersBatch(${wanted.length} pairs) failed, falling back:`,
      error.message,
    );
    const counts = {};
    for (const key of wanted) {
      const [context, roleKey] = key.split(":");
      counts[key] = await countContextRoleHolders(context, roleKey);
    }
    return counts;
  }
}

export async function countContextRoleHolders(context, roleKey) {
  const sql = CONTEXT_ROLE_HOLDER_QUERIES[`${context}:${roleKey}`];
  if (!sql) return null;
  try {
    const res = await db.execute(`SELECT ${sql} AS c`);
    return Number(res.rows[0]?.c ?? 0);
  } catch (error) {
    console.warn(
      `[Authz] countContextRoleHolders(${context}:${roleKey}) failed:`,
      error.message,
    );
    return null;
  }
}
