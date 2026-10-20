/**
 * Authorization — profile assignments registry (REPOSITORY layer).
 *
 * Phase C of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. Every statement the unified
 * assignment registry runs: the self-healing schema, the three reads the later
 * phases consume, and the create/close writes. The rules (date normalization,
 * "one period = one record", relation → source) live in
 * `@/services/authorization/profileAssignments`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
 * no decisions. The registry DESCRIBES who held which profile and when; it does
 * not decide access on its own.
 */

import db from "@/lib/db";

let schemaPromise = null;

/**
 * Idempotent runtime self-healing for the registry (same pattern as
 * ensureProfilesSchema / ensureContextRoleProfilesSchema — no migration
 * required, fail-soft on error so the next call retries).
 */
export function ensureProfileAssignmentsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS profile_assignments (
        id SERIAL PRIMARY KEY,
        contact_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
        profile_key TEXT NOT NULL,
        context_type TEXT NOT NULL,
        context_id TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL DEFAULT 'manual',
        source_ref TEXT,
        notes TEXT DEFAULT '',
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ended_at TIMESTAMPTZ
      )`);
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_profile_assignments_lookup
           ON profile_assignments(contact_cid, profile_key, status)`,
      );
      await db.execute(
        `CREATE INDEX IF NOT EXISTS idx_profile_assignments_context
           ON profile_assignments(context_type, context_id) WHERE status = 'active'`,
      );
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureProfileAssignmentsSchema failed:", error.message);
      schemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return schemaPromise;
}

/** Every assignment row for one person, most recent first (all periods). */
export function listProfileAssignments(cid) {
  return db.execute({
    sql: `SELECT id, profile_key, context_type, context_id, started_at, ends_at,
                 status, source, source_ref, notes, created_by, created_at, ended_at
          FROM profile_assignments
          WHERE contact_cid = ?
          ORDER BY started_at DESC, id DESC`,
    args: [String(cid)],
  });
}

/**
 * The profile KEYS a person holds RIGHT NOW — active and not past their end
 * date. This is the read Phase D consumes to feed eligibility.
 */
export function listActiveProfileKeys(cid) {
  return db.execute({
    sql: `SELECT DISTINCT profile_key
          FROM profile_assignments
          WHERE contact_cid = ?
            AND status = 'active'
            AND (ends_at IS NULL OR ends_at > NOW())
            AND (started_at IS NULL OR started_at <= NOW())
          ORDER BY profile_key`,
    args: [String(cid)],
  });
}

/**
 * How many people CURRENTLY hold a profile (active, unexpired) — the delete
 * guard's read, so a profile still carried by someone is never removed under
 * them.
 */
export function countActiveAssignmentsForProfileKey(profileKey) {
  return db.execute({
    sql: `SELECT COUNT(DISTINCT contact_cid)::int AS n
          FROM profile_assignments
          WHERE profile_key = ? AND status = 'active'
            AND (ends_at IS NULL OR ends_at > NOW())
            AND (started_at IS NULL OR started_at <= NOW())`,
    args: [String(profileKey)],
  });
}

/** Every row of one (context, profile) pair — the sweep's read (Phase E). */
export function listAssignmentsForContextAndProfile(
  contextType,
  contextId,
  profileKey,
) {
  return db.execute({
    sql: `SELECT id, contact_cid, profile_key, context_type, context_id, started_at,
                 ends_at, status, source, source_ref, created_by, created_at, ended_at
          FROM profile_assignments
          WHERE context_type = ?
            AND context_id IS NOT DISTINCT FROM ?
            AND profile_key = ?
          ORDER BY started_at DESC, id DESC`,
    args: [String(contextType), contextId == null ? null : String(contextId), String(profileKey)],
  });
}

/**
 * The ACTIVE AUTOMATIC rows of one (person, profile, context) — the read the
 * Phase E reconcile diffs against the relationship ids it just resolved, to
 * decide which periods to open, re-date or close.
 */
export function listActiveAutomaticAssignments({ contactCid, profileKey, contextType }) {
  return db.execute({
    sql: `SELECT id, context_id, source_ref, ends_at
          FROM profile_assignments
          WHERE contact_cid = ?
            AND profile_key = ?
            AND context_type = ?
            AND source = 'automatic'
            AND status = 'active'
            AND (started_at IS NULL OR started_at <= NOW())
          ORDER BY started_at DESC, id DESC`,
    args: [String(contactCid), String(profileKey), String(contextType)],
  });
}

/**
 * Re-date / re-point an ACTIVE automatic row (a program whose end date moved).
 * The `IS DISTINCT FROM` guard makes the statement a no-op when the period
 * already carries the right values, so a replayed reconcile changes nothing.
 */
/**
 * The statement runner. `db.execute` by default; inside
 * `withAssignmentTransaction` the caller passes the transaction's
 * `query(sql, args)` so every card write joins the SAME transaction.
 */
const runner = (run) => run || ((sql, args) => db.execute({ sql, args }));

/**
 * Run a set of registry writes atomically: every card write succeeds, or none
 * does. `syncContextGrantsAssignments` applies an open/refresh/close plan; a
 * failure halfway through would otherwise leave a person with a half-written
 * history (a card opened for a relationship the same reconcile then failed to
 * close, or the reverse).
 *
 * Lives in the MODEL layer so services never import `@/lib/db`.
 */
export function withAssignmentTransaction(callback) {
  return db.transaction(async (query) => callback(query));
}

export function refreshAutomaticAssignmentPeriod({ id, sourceRef, endsAt }, run = null) {
  return runner(run)(
    `UPDATE profile_assignments
      SET source_ref = ?, ends_at = ?
      WHERE id = ? AND status = 'active'
        AND (source_ref IS DISTINCT FROM ? OR ends_at IS DISTINCT FROM ?)`,
    [sourceRef, endsAt, Number(id), sourceRef, endsAt],
  );
}

/** The ACTIVE row of one exact (person, profile, context), or an empty set. */
export function findActiveAssignment({
  contactCid,
  profileKey,
  contextType,
  contextId,
}) {
  return db.execute({
    sql: `SELECT id
          FROM profile_assignments
          WHERE contact_cid = ?
            AND profile_key = ?
            AND context_type = ?
            AND context_id IS NOT DISTINCT FROM ?
            AND status = 'active'
            AND (ends_at IS NULL OR ends_at > NOW())
            AND (started_at IS NULL OR started_at <= NOW())
          LIMIT 1`,
    args: [
      String(contactCid),
      String(profileKey),
      String(contextType),
      contextId == null ? null : String(contextId),
    ],
  });
}

/** One row by id (or an empty result set). */
export function getProfileAssignmentById(id) {
  return db.execute({
    sql: `SELECT id, contact_cid, profile_key, context_type, context_id, started_at,
                 ends_at, status, source, source_ref, notes, created_by, created_at, ended_at
          FROM profile_assignments
          WHERE id = ?`,
    args: [Number(id)],
  });
}

/**
 * Open a NEW record. A reactivation after a close writes a second row here — the
 * rule "one period = one record" is the service's, enforced by never updating an
 * existing row into a new period.
 */
export function insertProfileAssignment(
  {
    contactCid,
    profileKey,
    contextType,
    contextId = null,
    startedAt,
    endsAt = null,
    source = "manual",
    sourceRef = null,
    notes = "",
    createdBy = null,
  },
  run = null,
) {
  return runner(run)(
    `INSERT INTO profile_assignments
      (contact_cid, profile_key, context_type, context_id, started_at, ends_at,
       status, source, source_ref, notes, created_by)
     VALUES (?, ?, ?, ?, COALESCE(?, NOW()), ?, 'active', ?, ?, ?, ?)
     RETURNING id`,
    [
      String(contactCid),
      String(profileKey),
      String(contextType),
      contextId == null ? null : String(contextId),
      startedAt,
      endsAt,
      String(source),
      sourceRef,
      notes || "",
      createdBy,
    ],
  );
}

/**
 * Close an ACTIVE record. Idempotent by construction: the `status = 'active'`
 * guard means a second close touches no row (the caller reports 0 rows
 * affected), and an already-ended period is never rewritten.
 */
export function closeProfileAssignment({ id, status = "ended", endedAt = null }, run = null) {
  return runner(run)(
    `UPDATE profile_assignments
      SET status = ?, ended_at = COALESCE(?, NOW())
      WHERE id = ? AND status = 'active'`,
    [String(status), endedAt, Number(id)],
  );
}

/**
 * The ENDED AUTOMATIC rows of one (person, profile, context) — the read Phase F
 * consumes to derive the residual read-only consultation. Automatic only: a card
 * written by hand is never turned into (or taken away as) a residual read.
 */
export function listEndedAutomaticAssignments({ contactCid, profileKey, contextType }) {
  return db.execute({
    sql: `SELECT context_id, started_at, ends_at, ended_at
          FROM profile_assignments
          WHERE contact_cid = ?
            AND profile_key = ?
            AND context_type = ?
            AND source = 'automatic'
            AND status = 'ended'
          ORDER BY ended_at DESC, id DESC`,
    args: [String(contactCid), String(profileKey), String(contextType)],
  });
}

/**
 * Everyone with an ENDED automatic row for one (profile, context) — the extra
 * population the sweep includes, so a residual read is applied (or withdrawn)
 * even for people who no longer hold the relationship (Phase F).
 */
export function listEndedAssignmentContacts(contextType, profileKey) {
  return db.execute({
    sql: `SELECT DISTINCT contact_cid AS cid
          FROM profile_assignments
          WHERE context_type = ?
            AND profile_key = ?
            AND source = 'automatic'
            AND status = 'ended'`,
    args: [contextType, profileKey],
  });
}

/**
 * CONSISTENCY REPORT — read-only, never repairs.
 *
 * Two states that must never exist silently:
 *   - an ACTIVE card pointing at a profile that is missing or inactive
 *     (`profile_without_rights`): the card claims a function that grants
 *     nothing;
 *   - an ACTIVE card whose profile has no capability row at all
 *     (`profile_without_capabilities`): the same break, one level down.
 *
 * The reverse direction (rights without an assignment card) is the readiness
 * report's `driftToAdd` / `driftToRemove`; it is reported there, per person.
 *
 * Grouped by profile key so an alert can name the broken profile without
 * listing people. A caller that finds `broken > 0` raises an alert; nothing in
 * this module ever edits a row.
 */
export function listProfileAssignmentConsistency() {
  return db.execute({
    sql: `SELECT pa.profile_key,
                 COUNT(*)::int AS active_cards,
                 SUM(CASE WHEN p.key IS NULL OR p.is_active = 0 THEN 1 ELSE 0 END)::int
                   AS profile_without_rights,
                 SUM(CASE WHEN p.key IS NOT NULL AND NOT EXISTS (
                       SELECT 1 FROM profile_capabilities pc
                       WHERE pc.profile_key = pa.profile_key
                     ) THEN 1 ELSE 0 END)::int
                   AS profile_without_capabilities
          FROM profile_assignments pa
          LEFT JOIN profiles p ON p.key = pa.profile_key
          WHERE pa.status = 'active'
          GROUP BY pa.profile_key
          ORDER BY pa.profile_key`,
    args: [],
  });
}
