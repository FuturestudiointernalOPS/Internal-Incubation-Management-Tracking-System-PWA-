import db, { initDb } from "@/lib/db";

/**
 * CONTACT ↔ PROGRAM/GROUP SYNCHRONIZATION
 *
 * Ensures that a person who enters through a Form Run (or is assigned as a
 * facilitator) is linked to the correct CRM group (`contacts.group_name`) and
 * program (`contacts.program_id` / `participant_programs`), without overwriting
 * an existing group/program or changing their global `contacts.role`.
 *
 * All writes are idempotent, additive, and fill-only.
 */

async function resolveContactId(submitterId) {
  if (!submitterId) return null;
  if (String(submitterId).includes("@")) {
    const res = await db.execute({
      sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
      args: [submitterId],
    });
    return res.rows[0]?.cid || null;
  }
  const res = await db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ? AND deleted = 0 LIMIT 1",
    args: [submitterId],
  });
  return res.rows[0]?.cid || null;
}

async function fillGroupAndProgram(contactCid, groupName, programId) {
  if (!contactCid) return;

  if (groupName) {
    await db.execute({
      sql: `UPDATE contacts SET group_name = ?
            WHERE cid = ?
              AND (group_name IS NULL OR TRIM(group_name) = '' OR LOWER(group_name) = 'unassigned')`,
      args: [groupName, contactCid],
    });
  }

  if (programId) {
    // participant_programs is the authoritative membership (Phase 5); the
    // legacy contacts.program_id write has been removed.
    await db.execute({
      sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
            VALUES (?, ?, 'active', NOW())
            ON CONFLICT (participant_id, program_id) DO NOTHING`,
      args: [contactCid, programId],
    });
  }
}

/**
 * Synchronous sync after a form submission is approved. This does NOT depend on
 * the fire-and-forget background automation, so the CRM group/program link is
 * established in the request that approves the person.
 */
export async function syncApprovedSubmissionToProgramGroup(submission) {
  if (!submission?.run_id || !submission?.submitter_id) return;
  try {
    await initDb();

    const contactCid = await resolveContactId(submission.submitter_id);

    const groupRes = await db.execute({
      sql: `SELECT f.name, f.program_id
            FROM platform_form_run_assignments a
            JOIN families f
              ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
            WHERE a.run_id = ? AND a.target_type = 'group'
            LIMIT 1`,
      args: [submission.run_id],
    });

    let groupName = groupRes.rows[0]?.name || null;
    let programId = groupRes.rows[0]?.program_id || null;

    if (!programId) {
      const progRes = await db.execute({
        sql: "SELECT target_id FROM platform_form_run_assignments WHERE run_id = ? AND target_type = 'program' LIMIT 1",
        args: [submission.run_id],
      });
      programId = progRes.rows[0]?.target_id || null;
    }

    await fillGroupAndProgram(contactCid, groupName, programId);
  } catch (e) {
    console.error("[contact-group-sync] approval sync failed:", e.message);
  }
}

/**
 * Idempotent reconciliation for existing records. Safe to run repeatedly.
 * - Backfills missing `contacts.group_name` / `contacts.program_id` for people
 *   who submitted through an assigned run.
 * - Backfills `participant_programs`.
 * - Backfills program links and contextual roles for facilitators.
 */
export async function reconcileProgramGroups() {
  try {
    await initDb();

    // 1. Backfill group_name for participants (fill-only).
    await db.execute({
      sql: `WITH links AS (
              SELECT
                c.cid AS contact_cid,
                COALESCE(f.name, p.target_id)      AS group_name,
                COALESCE(f.program_id, p.target_id) AS program_id
              FROM platform_form_submissions s
              JOIN platform_form_runs r ON r.id = s.run_id
              JOIN platform_form_run_assignments a
                ON a.run_id = s.run_id AND a.target_type = 'group'
              LEFT JOIN families f
                ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
              LEFT JOIN platform_form_run_assignments p
                ON p.run_id = s.run_id AND p.target_type = 'program'
              JOIN contacts c
                ON (LOWER(c.email) = LOWER(s.submitter_id) OR c.cid = s.submitter_id)
              WHERE s.status IN ('submitted','approved')
                AND (f.name IS NOT NULL OR p.target_id IS NOT NULL)
            ),
            unambiguous AS (
              SELECT
                contact_cid,
                MIN(group_name) FILTER (WHERE group_name IS NOT NULL) AS group_name,
                MIN(program_id) FILTER (WHERE program_id IS NOT NULL) AS program_id
              FROM links
              GROUP BY contact_cid
              HAVING COUNT(DISTINCT COALESCE(group_name, '')) <= 1
                 AND COUNT(DISTINCT COALESCE(program_id, '')) <= 1
            )
            UPDATE contacts c
            SET
              group_name = CASE
                WHEN c.group_name IS NULL OR TRIM(c.group_name) = '' OR LOWER(c.group_name) = 'unassigned'
                  THEN u.group_name
                ELSE c.group_name
              END
            FROM unambiguous u
            WHERE c.cid = u.contact_cid
              AND c.deleted = 0`,
      args: [],
    });

    // 2. Backfill participant_programs.
    await db.execute({
      sql: `WITH links AS (
              SELECT
                c.cid AS participant_id,
                COALESCE(f.program_id, p.target_id) AS program_id
              FROM platform_form_submissions s
              JOIN platform_form_runs r ON r.id = s.run_id
              JOIN platform_form_run_assignments a
                ON a.run_id = s.run_id AND a.target_type = 'group'
              LEFT JOIN families f
                ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
              LEFT JOIN platform_form_run_assignments p
                ON p.run_id = s.run_id AND p.target_type = 'program'
              JOIN contacts c
                ON (LOWER(c.email) = LOWER(s.submitter_id) OR c.cid = s.submitter_id)
              WHERE s.status IN ('submitted','approved')
                AND COALESCE(f.program_id, p.target_id) IS NOT NULL
            ),
            unambiguous AS (
              SELECT participant_id, MIN(program_id) AS program_id
              FROM links
              WHERE program_id IS NOT NULL
              GROUP BY participant_id
              HAVING COUNT(DISTINCT program_id) = 1
            )
            INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
            SELECT participant_id, program_id, 'active', NOW()
            FROM unambiguous
            ON CONFLICT (participant_id, program_id) DO NOTHING`,
      args: [],
    });

    // 3. (Removed in Phase 1) The legacy contacts.program_id backfill for
    //    facilitators is no longer performed; participant_programs is
    //    authoritative and facilitator scope comes from v2_program_staff/families.

    // 4. Add contextual facilitator roles (additive; contact_roles may not exist
    //    in older schemas, so this is best-effort).
    await db.execute({
      sql: `INSERT INTO contact_roles
              (contact_cid, role, context_type, context_id, is_current, title, scope, status, capability_overrides, assigned_by)
            SELECT
              c.cid,
              'facilitator',
              'program',
              CAST(ps.program_id AS TEXT),
              true,
              'facilitator',
              '{"type":"program"}'::jsonb,
              'active',
              COALESCE(ps.permissions, '{}'::jsonb),
              'system'
            FROM v2_program_staff ps
            JOIN contacts c
              ON (c.cid = ps.staff_id OR LOWER(c.email) = LOWER(ps.staff_id))
            WHERE ps.role = 'facilitator'
              AND c.deleted = 0
              AND NOT EXISTS (
                SELECT 1 FROM contact_roles cr
                WHERE cr.contact_cid = c.cid
                  AND cr.role = 'facilitator'
                  AND cr.context_type = 'program'
                  AND cr.context_id = CAST(ps.program_id AS TEXT)
                  AND cr.is_current = true
              )`,
      args: [],
    });

    // 5. Participant-architecture cleanup (Phase 1): backfill
    //    participant_programs from the remaining legacy sources so it can
    //    become the single source of truth for Person -> Program membership.
    await reconcileParticipantPrograms();
  } catch (e) {
    console.error("[contact-group-sync] reconciliation failed:", e.message);
  }
}

/**
 * Phase 1 (participant-architecture cleanup): backfill `participant_programs`
 * from the legacy sources so it can become the single source of truth.
 *
 * This is additive and idempotent — it only INSERTs rows that are missing and
 * never deletes or overwrites existing membership.
 *
 * Legacy sources covered:
 *   - `v2_participants` (legacy intake): joined to `contacts` by email or
 *     `user_id`, and only when the program still exists.
 *   - `contacts.program_id` (legacy single-value field): only when it holds a
 *     single program id (not comma-separated) and the program exists.
 *
 * Deliberately NOT reconciled here: `contacts.group_name` name-lookup. Group
 * membership is a separate concept from program membership and must not be
 * re-introduced as a program source.
 */
export async function reconcileParticipantPrograms() {
  try {
    await initDb();

    await db.execute({
      sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
            SELECT c.cid, CAST(vp.program_id AS TEXT), 'active', NOW()
            FROM v2_participants vp
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(vp.program_id AS TEXT)
            JOIN contacts c
              ON (LOWER(c.email) = LOWER(vp.email) OR c.cid = vp.user_id)
            WHERE c.deleted = 0
            ON CONFLICT (participant_id, program_id) DO NOTHING`,
      args: [],
    });

    await db.execute({
      sql: `INSERT INTO participant_programs (participant_id, program_id, status, accepted_at)
            SELECT c.cid, CAST(c.program_id AS TEXT), 'active', NOW()
            FROM contacts c
            JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(c.program_id AS TEXT)
            WHERE c.deleted = 0
              AND c.program_id IS NOT NULL
              AND TRIM(c.program_id) <> ''
              AND c.program_id NOT LIKE '%,%'
            ON CONFLICT (participant_id, program_id) DO NOTHING`,
      args: [],
    });

    return { success: true };
  } catch (e) {
    console.error("[participant-programs] reconciliation failed:", e.message);
    return { success: false, error: e.message };
  }
}
