import db from "@/lib/db";

/**
 * Authorization bootstrap — runtime schema self-heal (REPOSITORY layer).
 *
 * The idempotent DDL that creates the authorization and responsibility tables
 * and columns on first use, so a database that has not run the migrations yet
 * does not 500 the permission screens. Split verbatim out of
 * `models/authorization/bootstrap.js` — see docs/LAYER_SPLIT.md.
 *
 * Each heal runs ONCE per process (the memos below), and each memo clears
 * itself on failure: a transient database error must be retried on the next
 * call, never cached as "done".
 */

let responsibilitiesSchemaPromise = null;

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
