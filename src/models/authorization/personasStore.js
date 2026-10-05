/**
 * Authorization — personas store (REPOSITORY layer).
 *
 * Phase A of docs/ROADMAP_ROLES_PERSONAS_ACCESS.md. Every statement the persona
 * catalogue runs: the self-healing schema, the insert-only seed, the read, and
 * the single-row edit. The validation and the decisions live in
 * `@/services/authorization/personaCatalog`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions.
 */

import db from "@/lib/db";
import { PERSONA_CATALOG } from "./persona-catalog";

let personasSchemaPromise = null;

/**
 * Idempotent runtime self-healing for the catalogue table (same pattern as
 * ensureContextRoleProfilesSchema / ensureEligibilitySchema — no migration
 * required, fail-soft on error so the next call retries).
 */
export function ensurePersonasSchema() {
  if (!personasSchemaPromise) {
    personasSchemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        context TEXT NOT NULL,
        allowed_roles JSONB NOT NULL DEFAULT '[]',
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_personas_context ON personas(context)`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensurePersonasSchema failed:", error.message);
      personasSchemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return personasSchemaPromise;
}

/**
 * Seed the catalogue rows. Idempotent: ON CONFLICT DO NOTHING means an
 * administrator's edit (allowed_roles / is_active / notes) is never overwritten,
 * and a later reseed only adds personas this build introduces.
 *
 * Deliberately THROWS on failure: the one-time migration records itself only
 * when the work resolves, so a failed seed must propagate to be retried on the
 * next boot. The read path wraps this call and tolerates a failure.
 */
export async function seedPersonas() {
  await ensurePersonasSchema();
  for (const persona of PERSONA_CATALOG) {
    await db.execute({
      sql: `INSERT INTO personas (key, context, allowed_roles, is_active)
            VALUES (?, ?, ?, 1)
            ON CONFLICT (key) DO NOTHING`,
      args: [persona.key, persona.context, JSON.stringify(persona.allowedRoles)],
    });
  }
  return { success: true };
}

/** Every catalogue row, in context then key order. */
export function listPersonas() {
  return db.execute(
    `SELECT key, context, allowed_roles, is_active, notes, updated_at
     FROM personas
     ORDER BY context, key`,
  );
}

/** One catalogue row by key (or an empty result set). */
export function getPersonaRow(key) {
  return db.execute({
    sql: `SELECT key, context, allowed_roles, is_active, notes, updated_at
          FROM personas WHERE key = ?`,
    args: [String(key)],
  });
}

/**
 * Persist an administrator's edit of one persona. `context` and `key` are
 * identity columns and are never changed here.
 */
export function updatePersona({ key, allowedRoles, isActive, notes }) {
  return db.execute({
    sql: `UPDATE personas
          SET allowed_roles = ?, is_active = ?, notes = ?, updated_at = NOW()
          WHERE key = ?`,
    args: [JSON.stringify(allowedRoles || []), isActive ? 1 : 0, notes || "", String(key)],
  });
}
