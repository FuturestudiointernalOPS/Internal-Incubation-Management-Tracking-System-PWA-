import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, enforceFacilitatorProgramAccess, getFacilitatorTeamScope } from "@/lib/auth";

/**
 * PARTICIPANTS API — ENROLLMENT ENGINE
 * Handles direct participant registration and contact credential sync.
 */

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;
    const body = await req.json();
    const { program_id, name, email, phone, screening_status } = body;

    if (!program_id || !name || !email) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 1. Fetch Program Details
    const progRes = await db.execute({
      sql: "SELECT name FROM v2_programs WHERE id = ?",
      args: [program_id],
    });
    const programName = progRes.rows[0]?.name || "Unassigned Program";

    // 2. Insert into V2 Participants (Standardized for Postgres)
    const result = await db.execute({
      sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status)
             VALUES (?, ?, ?, ?, ?) RETURNING id`,
      args: [
        program_id,
        name,
        email,
        phone || null,
        screening_status || "applied",
      ],
    });

    const participantId = result.lastInsertRowid;

    // 3. FLEXIBLE SYNC: Upsert into V1 Contacts
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    const generatedPassword = `FSP${randomStr}`;
    const cid = `c-${Math.random().toString(36).substr(2, 9)}`;

    await db.execute({
      sql: `INSERT INTO contacts (cid, name, email, phone, program_id, program_name, role, password)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
              name = EXCLUDED.name,
              phone = EXCLUDED.phone,
              program_id = EXCLUDED.program_id,
              program_name = EXCLUDED.program_name,
              role = EXCLUDED.role`,
      args: [
        cid,
        name,
        email,
        phone || null,
        program_id,
        programName,
        "participant",
        generatedPassword,
      ],
    });

    // Resolve the actual contact cid (the upsert above may have matched an
    // existing email, in which case the generated cid is not the real one).
    let contactCid = cid;
    try {
      const cRes = await db.execute({
        sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
        args: [email],
      });
      if (cRes.rows.length > 0) contactCid = cRes.rows[0].cid;
    } catch (_) {}

    // Keep participant_programs (canonical membership) in sync so direct-add
    // participants show up in the Program Participants view once active.
    try {
      await db.execute({
        sql: "INSERT INTO participant_programs (participant_id, program_id, status, accepted_at) VALUES (?, ?, 'pending', NOW()) ON CONFLICT (participant_id, program_id) DO NOTHING",
        args: [contactCid, program_id],
      });
    } catch (_) {}

    // Timeline event
    try {
      await db.execute({
        sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'participant_enrolled', 'Enrolled in program', 'programs', ?, 'system', '{}'::jsonb)`,
        args: [cid, program_id],
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        program_id,
        name,
        email,
        phone,
        screening_status,
      },
    });
  } catch (error) {
    console.error("Participant POST Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin", "program_manager", "teacher", "facilitator"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");

    if (!program_id) {
      return NextResponse.json({ success: true, participants: [] });
    }

    // Server-side enforcement: facilitators must be assigned to the program
    // and hold participants.view at level >= 1.
    const facError = await enforceFacilitatorProgramAccess(
      program_id,
      "participants.view",
      1,
    );
    if (facError) return facError;

    const session = await getSession();

    // Canonical participant source: participant_programs (program membership)
    // + contacts (active account). id is contacts.cid so attendance and team
    // links use one consistent identifier. Form submissions and v2_participants
    // are NOT treated as operational participant membership.
    let sql = `
      SELECT CAST(c.cid AS TEXT) as id,
             c.cid,
             CAST(c.cid AS TEXT) as user_id,
             c.name, c.email, c.phone,
             c.status, c.created_at, c.group_name, c.v2_team_id,
             pp.program_id, 'enrolled' as source
      FROM participant_programs pp
      JOIN contacts c ON pp.participant_id = c.cid
      WHERE CAST(pp.program_id AS TEXT) = ?
        AND c.deleted = 0
        AND c.deleted_at IS NULL
        AND c.archived_at IS NULL
        AND LOWER(COALESCE(c.status, '')) = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM v2_program_staff ps
          WHERE CAST(ps.program_id AS TEXT) = ?
            AND ps.role = 'facilitator'
            AND (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
        )
    `;
    const args = [String(program_id), String(program_id)];

    // Facilitator team scope: only participants assigned to the facilitator's
    // v2_teams (where handler_id = facilitator cid).
    if (session?.role === "facilitator") {
      const scope = await getFacilitatorTeamScope(program_id, session.cid);
      if (scope.scope !== "all") {
        if (scope.teamIds.length === 0) {
          return NextResponse.json({ success: true, participants: [] });
        }
        sql += " AND c.v2_team_id IN (" + scope.teamIds.map(() => "?").join(",") + ")";
        args.push(...scope.teamIds);
      }
    }

    sql += " ORDER BY c.created_at DESC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, participants: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
