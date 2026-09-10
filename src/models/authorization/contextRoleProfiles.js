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
    profile_name: "Program Manager",
    notes: "Mirrors the existing role default (program_manager → Program Manager).",
  },
  {
    context: "program",
    role_key: "facilitator",
    profile_name: null,
    notes:
      "No facilitator profile seeded yet — program access currently resolves per program from v2_program_staff.permissions. Default pending review.",
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
    profile_name: null,
    notes:
      "No team-member profile seeded yet — venture team membership (venture_members) has no profile mapping today; Phase 5 material.",
  },
  {
    context: "lms",
    role_key: "learner",
    profile_name: null,
    notes:
      "Learning access is enrollment-derived (lms_enrollments) today; a learner profile mapping is pending review.",
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
    })().catch((e) => {
      console.warn("[Authz] ensureContextRoleProfilesSchema failed:", e.message);
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
      let profileId = null;
      if (row.profile_name) {
        const profile = await db.execute({
          sql: "SELECT id FROM access_profiles WHERE name = ?",
          args: [row.profile_name],
        });
        profileId = profile.rows[0]?.id ?? null;
      }
      await db.execute({
        sql: `INSERT INTO context_role_profiles
                (context, role_key, profile_id, is_active, notes)
              VALUES (?, ?, ?, 1, ?)
              ON CONFLICT (context, role_key) DO NOTHING`,
        args: [row.context, row.role_key, profileId, row.notes || ""],
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** Every registry row, with the mapped profile name (LEFT JOIN, never hidden). */
export async function listContextRoleProfiles() {
  return db.execute({
    sql: `SELECT crp.id, crp.context, crp.role_key, crp.profile_id,
                 crp.is_active, crp.notes, crp.updated_at,
                 ap.name AS profile_name
          FROM context_role_profiles crp
          LEFT JOIN access_profiles ap ON ap.id = crp.profile_id
          ORDER BY crp.context, crp.role_key`,
  });
}

/** Single registry row — the resolution helper future phases will consume. */
export async function getContextRoleProfile(context, roleKey) {
  return db.execute({
    sql: `SELECT crp.id, crp.context, crp.role_key, crp.profile_id,
                 crp.is_active, crp.notes,
                 ap.name AS profile_name
          FROM context_role_profiles crp
          LEFT JOIN access_profiles ap ON ap.id = crp.profile_id
          WHERE crp.context = ? AND crp.role_key = ?
          LIMIT 1`,
    args: [context, roleKey],
  });
}

/** Upsert one mapping (create-or-update; used by the Permission Center). */
export async function upsertContextRoleProfile({
  context,
  roleKey,
  profileId,
  isActive,
  notes,
}) {
  return db.execute({
    sql: `INSERT INTO context_role_profiles
            (context, role_key, profile_id, is_active, notes)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (context, role_key) DO UPDATE SET
            profile_id = EXCLUDED.profile_id,
            is_active = EXCLUDED.is_active,
            notes = EXCLUDED.notes,
            updated_at = NOW()`,
    args: [context, roleKey, profileId, isActive ? 1 : 0, notes || ""],
  });
}

/**
 * Informational count of relationships that currently exist for a context
 * role — READ-ONLY governance context for the registry UI ("how many people
 * hold this today?"). Unknown pairs return null (the UI shows "—"); the
 * lookup is fail-soft so a missing legacy table never breaks the registry.
 */
export async function countContextRoleHolders(context, roleKey) {
  const queries = {
    "program:participant": `SELECT COUNT(DISTINCT participant_id)::int AS c
        FROM participant_programs`,
    "program:program_manager": `SELECT COUNT(DISTINCT assigned_pm_id)::int AS c
        FROM v2_programs WHERE assigned_pm_id IS NOT NULL`,
    "program:facilitator": `SELECT COUNT(DISTINCT staff_id)::int AS c
        FROM v2_program_staff WHERE role = 'facilitator'`,
    "venture:founder": `SELECT COUNT(DISTINCT contact_id)::int AS c
        FROM venture_members
        WHERE member_type = 'founder' AND removed_at IS NULL`,
    "venture:team_member": `SELECT COUNT(DISTINCT contact_id)::int AS c
        FROM venture_members
        WHERE member_type = 'team_member' AND removed_at IS NULL`,
    "lms:learner": `SELECT COUNT(DISTINCT user_cid)::int AS c
        FROM lms_enrollments WHERE status <> 'suspended'`,
    "investor:investor": `SELECT COUNT(*)::int AS c FROM investor_profiles`,
  };
  const sql = queries[`${context}:${roleKey}`];
  if (!sql) return null;
  try {
    const res = await db.execute(sql);
    return Number(res.rows[0]?.c ?? 0);
  } catch (e) {
    console.warn(
      `[Authz] countContextRoleHolders(${context}:${roleKey}) failed:`,
      e.message,
    );
    return null;
  }
}
