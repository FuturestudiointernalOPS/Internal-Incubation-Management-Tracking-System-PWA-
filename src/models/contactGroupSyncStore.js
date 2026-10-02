import db, { initDb } from "@/lib/db";

/**
 * CONTACT ↔ PROGRAM/GROUP SYNC — SQL store
 *
 * Pure data access for the contact-group-sync service. No decisions, no
 * debounce windows — those live in `@/services/contacts/contactGroupSync`.
 */

export async function ensureSyncDb() {
  await initDb();
}

export async function resolveContactId(submitterId) {
  if (!submitterId) return null;
  if (String(submitterId).includes("@")) {
    const emailResult = await db.execute({
      sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
      args: [submitterId],
    });
    return emailResult.rows[0]?.cid || null;
  }
  const cidResult = await db.execute({
    sql: "SELECT cid FROM contacts WHERE cid = ? AND deleted = 0 LIMIT 1",
    args: [submitterId],
  });
  return cidResult.rows[0]?.cid || null;
}

export async function fillGroupAndProgram(contactCid, groupName, programId) {
  if (!contactCid) return;

  if (groupName) {
    await db.execute({
      sql: `UPDATE contacts SET group_name = ?
            WHERE cid = ?
              AND (group_name IS NULL OR TRIM(group_name) = '' OR LOWER(group_name) = 'unassigned')`,
      args: [String(groupName || "").trim().toUpperCase(), contactCid],
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

export async function getRunGroupAssignment(runId) {
  const groupRes = await db.execute({
    sql: `SELECT f.name, f.program_id
          FROM platform_form_run_assignments a
          JOIN families f
            ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT))
          WHERE a.run_id = ? AND a.target_type = 'group'
          LIMIT 1`,
    args: [runId],
  });
  return groupRes.rows[0] || null;
}

export async function getRunProgramAssignment(runId) {
  const progRes = await db.execute({
    sql: "SELECT target_id FROM platform_form_run_assignments WHERE run_id = ? AND target_type = 'program' LIMIT 1",
    args: [runId],
  });
  return progRes.rows[0]?.target_id || null;
}

export async function backfillGroupNamesFromFormRuns() {
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
                THEN UPPER(TRIM(u.group_name))
              ELSE c.group_name
            END
          FROM unambiguous u
          WHERE c.cid = u.contact_cid
            AND c.deleted = 0`,
    args: [],
  });
}

export async function backfillParticipantProgramsFromFormRuns() {
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
}

export async function backfillFacilitatorContactRoles() {
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
}

/**
 * Phase 1 (participant-architecture cleanup): backfill `participant_programs`
 * from the legacy sources so it can become the single source of truth.
 *
 * Additive and idempotent — only INSERTs missing rows.
 */
export async function backfillParticipantProgramsFromLegacySources() {
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
}
