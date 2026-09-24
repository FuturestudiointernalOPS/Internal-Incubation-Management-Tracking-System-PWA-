/**
 * models/authorization — bootstrap.
 *
 * What a fresh (or partially migrated) environment needs before anything else
 * works, in two halves:
 *
 *   SELF-HEAL — creates the authorization and responsibility tables and columns
 *   on first use, so a database that has not run the migrations yet does not
 *   500 the permission screens. Every statement is idempotent, and each heal
 *   runs ONCE per process: it is dozens of statements called from request paths.
 *
 *   DEFAULT GRANTS — the catalogue every environment starts from: role
 *   capabilities, the named Access Profiles with their capability templates and
 *   role bindings, and the responsibilities catalogue. All upserts, so running
 *   them again is a no-op.
 *
 * Both memos clear themselves on failure: a transient database error must be
 * retried on the next call, never cached as "done".
 */

import db, { initDb } from "@/lib/db";
import { PERMISSION_MODULES } from "@/server/authz/capabilities";
import { RESPONSIBILITY_FEATURE_ROLES } from "@/lib/featureAccess";

let responsibilitiesSchemaPromise = null;

// The default-responsibility seed is a fixed catalogue: run it once per process
// (see seedDefaultResponsibilities). Request paths that call it on every read
// are answered from this promise after the first call.
let responsibilitiesSeedPromise = null;

/**
 * Idempotent runtime self-healing for the responsibilities tables.
 * Creates the tables on first use so the migration is optional, matching the
 * self-healing pattern used elsewhere (token hashing, email log).
 */
export async function ensureResponsibilitiesSchema() {
  if (!responsibilitiesSchemaPromise) {
    responsibilitiesSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS responsibilities (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        key TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        icon TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS user_responsibilities (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        responsibility_id INTEGER NOT NULL,
        assigned_by TEXT,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, responsibility_id)
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_resp_cid ON user_responsibilities(user_cid)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_resp_id ON user_responsibilities(responsibility_id)`);

      // Defensive self-heal: tables created by older migrations may lack the
      // columns and UNIQUE constraints that the seed (ON CONFLICT) and the
      // toggle queries rely on. All statements are idempotent.
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS name TEXT`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS key TEXT`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT ''`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS is_active INTEGER NOT NULL DEFAULT 1`);
      // allowed_roles = JSON array of roles that can access this responsibility's
      // feature. NULL means "not configured" → the seed defaults apply. An empty
      // array is a REAL state: explicitly nobody. Editable by the Super Admin.
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS allowed_roles TEXT`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
      await db.execute(`ALTER TABLE responsibilities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
      // Unique indexes (not constraints) satisfy the ON CONFLICT clauses and
      // cannot collide with pre-existing constraint names from older migrations.
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS responsibilities_name_key ON responsibilities (name)`);
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS responsibilities_key_key ON responsibilities (key)`);
      await db.execute(`ALTER TABLE user_responsibilities ADD COLUMN IF NOT EXISTS assigned_by TEXT`);
      await db.execute(`ALTER TABLE user_responsibilities ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS user_responsibilities_user_cid_responsibility_id_key ON user_responsibilities (user_cid, responsibility_id)`);

      // Grant ledger: records ONLY the capability grants a responsibility
      // CREATED, so removing the responsibility revokes exactly those (never a
      // pre-existing manual grant). See src/models/responsibilities.js.
      await db.execute(`CREATE TABLE IF NOT EXISTS responsibility_capability_grants (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        responsibility_key TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, responsibility_key, module, capability)
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_resp_cap_grants_cid ON responsibility_capability_grants(user_cid)`);
      await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS responsibility_capability_grants_key ON responsibility_capability_grants (user_cid, responsibility_key, module, capability)`);
      return true;
    })().catch((error) => {
      console.warn("[Auth] ensureResponsibilitiesSchema failed:", error.message);
      responsibilitiesSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return responsibilitiesSchemaPromise;
}

let permissionsSchemaPromise = null;

/**
 * Idempotent runtime self-healing for the full authorization tables
 * (role/group/user capabilities, restrictions, groups, access profiles).
 * Creates them on first use so the permission UI never 500s on a DB that
 * has not run the authorization migrations yet.
 */
export function ensurePermissionsSchema() {
  if (!permissionsSchemaPromise) {
    permissionsSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS role_capabilities (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        access_level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(role, module, capability)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS group_capabilities (
        id SERIAL PRIMARY KEY,
        group_name TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        access_level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(group_name, module, capability)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS user_capabilities (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        access_level INTEGER NOT NULL DEFAULT 1,
        granted_by TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, module, capability)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS user_capability_restrictions (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        restricted_by TEXT,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, module, capability)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS user_groups (
        id SERIAL PRIMARY KEY,
        user_cid TEXT NOT NULL,
        group_name TEXT NOT NULL,
        role_in_group TEXT DEFAULT 'member',
        assigned_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_cid, group_name)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS access_profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS access_profile_capabilities (
        id SERIAL PRIMARY KEY,
        profile_id INTEGER NOT NULL,
        module TEXT NOT NULL,
        capability TEXT NOT NULL,
        access_level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(profile_id, module, capability)
      )`);
      await db.execute(`CREATE TABLE IF NOT EXISTS role_access_profile_defaults (
        id SERIAL PRIMARY KEY,
        role_name TEXT NOT NULL UNIQUE,
        access_profile_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_caps_lookup ON user_capabilities(user_cid, module, capability)`);
      await db.execute(`CREATE INDEX IF NOT EXISTS idx_user_restr_lookup ON user_capability_restrictions(user_cid, module, capability)`);
      return true;
    })().catch((error) => {
      console.warn("[Auth] ensurePermissionsSchema failed:", error.message);
      permissionsSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return permissionsSchemaPromise;
}

export async function seedDefaultRoleCapabilities() {
  try {
    await initDb();
    const defaults = {
      super_admin: Object.fromEntries(
        Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => [
          moduleKey,
          Object.fromEntries(module.capabilities.map((capability) => [capability, 5])),
        ]),
      ),
      staff: {
        projects: { view: 1, create: 2, edit: 3 },
        programs: { view: 1 },
        reports: { view: 1, create: 2 },
        messaging: { view: 1, send: 2 },
        contacts: { view: 1 },
      },
      participant: {
        projects: { view: 1 },
        messaging: { view: 1, send: 2 },
      },
    };
    for (const [role, modules] of Object.entries(defaults)) {
      for (const [module, caps] of Object.entries(modules)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO role_capabilities (role, module, capability, access_level) VALUES (?, ?, ?, ?) ON CONFLICT (role, module, capability) DO UPDATE SET access_level = ?`,
            args: [role, module, capability, level, level],
          });
        }
      }
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Seed default access profiles and their capabilities.
 * Creates profiles for all common roles plus additional staff profiles.
 * Run once after migrations. Safe to re-run (upserts).
 */
export async function seedDefaultAccessProfiles() {
  try {
    await initDb();

    // ── Define profile definitions ──
    const profileDefs = {
      "Super Admin Default": {
        description: "Full system access — all modules, all capabilities",
        capabilities: Object.fromEntries(
          Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => [
            moduleKey,
            Object.fromEntries(module.capabilities.map((capability) => [capability, 5])),
          ]),
        ),
      },
      "Staff Default": {
        description: "Standard staff access — projects, messaging, reports",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3 },
          programs: { view: 1 },
          ventures: { view: 1, edit: 3 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Participant Default": {
        description:
          "Participant access — own programs, assignments, messaging",
        capabilities: {
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Program Manager": {
        description: "Program management — programs, participants, reports",
        capabilities: {
          programs: { view: 1, create: 2, edit: 3, publish: 4 },
          projects: { view: 1 },
          ventures: { view: 1, edit: 3 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1, create: 2 },
          lms: { view: 1 },
        },
      },
      // ASSIGNMENT-DERIVED program management.
      //
      // A person assigned as the manager of ONE program must get what managing
      // THAT program needs — not the whole portfolio template above, which also
      // carries venture editing, reporting and CRM access. This profile is what
      // the Context Roles registry points `program:program_manager` at, and it
      // is deliberately limited to the program module: no `create` (bringing a
      // program into existence is not a property of an existing assignment) and
      // no `delete` (destructive, and the highest risk in the catalog).
      //
      // It does NOT replace the "Program Manager" role default above: a person
      // whose platform role is program_manager keeps that template exactly as
      // before. This one is about the assignment.
      "Assigned Program Manager": {
        description:
          "Assignment-derived program management — the program you are assigned to",
        capabilities: {
          programs: { view: 1, edit: 3, publish: 4 },
        },
      },
      "Project Owner": {
        description: "Project management — own projects, tasks, team reporting",
        capabilities: {
          projects: { view: 1, create: 2, edit: 3, delete: 4 },
          engineering: { view: 1, manage_tasks: 2 },
          reports: { view: 1, create: 2 },
          messaging: { view: 1, send: 2 },
        },
      },
      "Operations Manager": {
        description: "Operations — programs, finance, CRM, reports",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          finance: { view: 1, create: 2, edit: 3, export: 4 },
          contacts: { view: 1, create: 2, edit: 3 },
          reports: { view: 1, create: 2, export: 3 },
          messaging: { view: 1, send: 2 },
        },
      },
      Instructor: {
        description: "Program delivery — programs, grading, communication",
        capabilities: {
          programs: { view: 1, edit: 3 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
          contacts: { view: 1 },
        },
      },
      "Finance Assistant": {
        description: "Finance operations — view/create/edit finance data",
        capabilities: {
          finance: { view: 1, create: 2, edit: 3 },
          reports: { view: 1 },
        },
      },
      Mentor: {
        description: "Mentor access — participant progress, messaging",
        capabilities: {
          programs: { view: 1 },
          projects: { view: 1 },
          messaging: { view: 1, send: 2 },
        },
      },
      // P1/Phase 5b: Founder is an official identity (Member + venture
      // membership), NOT a Staff profile. Phase 5c: view + edit, both scoped by
      // venture_own — a founder writes only inside their own ventures.
      Founder: {
        description: "Venture founder — own venture workspace (venture_own scope)",
        capabilities: {
          ventures: { view: 1, edit: 3 },
        },
      },
      // Team members are Venture PEOPLE, not staff: they hold a
      // venture_members row (member_type 'team_member') on a baseline Member
      // identity, so they get the read side of their own Venture and nothing
      // more. The venture_own scope is what confines them to the Venture they
      // were actually added to.
      "Venture Member": {
        description: "Venture team member — read access to their own venture",
        capabilities: {
          ventures: { view: 1 },
        },
      },
    };

    // ── Create/update profiles and capabilities ──
    for (const [name, def] of Object.entries(profileDefs)) {
      // Upsert profile
      await db.execute({
        sql: `INSERT INTO access_profiles (name, description, is_active)
              VALUES (?, ?, 1)
              ON CONFLICT (name) DO UPDATE SET description = ?, is_active = 1`,
        args: [name, def.description, def.description],
      });

      // Get profile id
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [name],
      });
      if (profile.rows.length === 0) continue;
      const profileId = profile.rows[0].id;

      // Upsert capabilities
      for (const [module, caps] of Object.entries(def.capabilities)) {
        for (const [capability, level] of Object.entries(caps)) {
          await db.execute({
            sql: `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = ?`,
            args: [profileId, module, capability, level, level],
          });
        }
      }
    }

    // ── Map roles to default profiles ──
    const roleDefaults = {
      super_admin: "Super Admin Default",
      staff: "Staff Default",
      participant: "Participant Default",
      program_manager: "Program Manager",
      investor: "Mentor",
      mentor: "Mentor",
      // Phase 5b: founder-role users resolve to the Founder profile. There is
      // no role_capabilities('founder') seed, so this mapping only ADDS
      // ventures.view (it never narrows a legacy fallback).
      founder: "Founder",
      // Venture team members are added as members FIRST (venture_members row),
      // then given a team role — so the baseline `member` role is what has to
      // carry the read capability. There is no role_capabilities('member')
      // seed, so this mapping only ADDS ventures.view (it never narrows a
      // legacy fallback). View only: scope still decides WHICH venture.
      member: "Venture Member",
    };

    for (const [role, profileName] of Object.entries(roleDefaults)) {
      const profile = await db.execute({
        sql: "SELECT id FROM access_profiles WHERE name = ?",
        args: [profileName],
      });
      if (profile.rows.length > 0) {
        await db.execute({
          sql: `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
                VALUES (?, ?)
                ON CONFLICT (role_name) DO UPDATE SET access_profile_id = ?`,
          args: [role, profile.rows[0].id, profile.rows[0].id],
        });
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Seed default responsibilities.
 */
export async function seedDefaultResponsibilities() {
  // Once per process. The definitions are a fixed catalogue that only changes
  // when the code changes, and the allowed_roles pass is fill-only by design —
  // so repeating them per request bought nothing and cost 24 round trips on
  // every read of the responsibilities screen. A failure clears the memo so the
  // next call retries instead of the process caching a broken state.
  if (!responsibilitiesSeedPromise) {
    responsibilitiesSeedPromise = seedDefaultResponsibilitiesOnce().catch((error) => {
      responsibilitiesSeedPromise = null;
      return { success: false, error: error.message };
    });
  }
  return responsibilitiesSeedPromise;
}

async function seedDefaultResponsibilitiesOnce() {
  try {
    await initDb();
    await ensureResponsibilitiesSchema();

    const defaults = [
      {
        name: "CRM",
        key: "crm",
        description: "People, contacts, timeline, membership, duplicates",
        icon: "Users",
      },
      {
        name: "Communication",
        key: "communication",
        description: "Messaging, announcements, forms — outreach suite",
        icon: "Send",
      },
      {
        name: "Programs",
        key: "programs",
        description: "Program oversight — programs, participants, submissions",
        icon: "Briefcase",
      },
      {
        name: "Ventures",
        key: "ventures",
        description: "Venture management — portfolio and registrations",
        icon: "Rocket",
      },
      {
        name: "Investors",
        key: "investors",
        description: "Investor management — records, reviews, campaigns",
        icon: "TrendingUp",
      },
      {
        name: "Finance",
        key: "finance",
        description: "Financial operations — budgets, reports",
        icon: "BarChart3",
      },
      {
        name: "Operations",
        key: "operations",
        description: "Internal operations — projects, tasks, standups, retros",
        icon: "Settings",
      },
      {
        name: "Reports",
        key: "reports",
        description: "Reports and analytics",
        icon: "BarChart3",
      },
      {
        name: "Knowledge",
        key: "knowledge",
        description: "Knowledge management",
        icon: "Library",
      },
      {
        name: "LMS",
        key: "lms",
        description: "Course management — create and maintain courses",
        icon: "GraduationCap",
      },
      {
        name: "Security",
        key: "security",
        description: "User administration — personnel, permissions",
        icon: "Users",
      },
      {
        name: "Settings",
        key: "settings",
        description: "System configuration and engineering operations",
        icon: "Settings",
      },
    ];

    // 1. Definitions — ONE multi-row statement instead of 12 round trips.
    //    Same ON CONFLICT (key) upsert as before, same values as the incoming
    //    row (EXCLUDED), so re-running is still a no-op for existing rows.
    await db.execute({
      sql: `INSERT INTO responsibilities (name, key, description, icon, allowed_roles, is_active)
            VALUES ${defaults.map(() => "(?, ?, ?, ?, ?, 1)").join(", ")}
            ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon`,
      args: defaults.flatMap((resp) => [
        resp.name,
        resp.key,
        resp.description,
        resp.icon,
        JSON.stringify(RESPONSIBILITY_FEATURE_ROLES[resp.key] || []),
      ]),
    });

    // 2. Backfill allowed_roles ONLY where it has never been configured. Manual
    //    Super Admin edits (including an explicit empty list) are never touched.
    //    ONE statement instead of 12 round trips.
    await db.execute({
      sql: `UPDATE responsibilities AS r
            SET allowed_roles = v.roles
            FROM (VALUES ${defaults
              .map(() => "(CAST(? AS TEXT), CAST(? AS TEXT))")
              .join(", ")}) AS v(key, roles)
            WHERE r.key = v.key
              AND (r.allowed_roles IS NULL OR TRIM(r.allowed_roles) = '')`,
      args: defaults.flatMap((resp) => [
        resp.key,
        JSON.stringify(RESPONSIBILITY_FEATURE_ROLES[resp.key] || []),
      ]),
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
