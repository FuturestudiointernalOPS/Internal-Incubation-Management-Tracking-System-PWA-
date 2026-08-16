import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, enforceFacilitatorProgramAccess, getFacilitatorParticipantScope } from "@/lib/auth";

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

    // Server-side enforcement: facilitators must be assigned to the program
    // and hold participants.view at level >= 1.
    const facError = await enforceFacilitatorProgramAccess(
      program_id,
      "participants.view",
      1,
    );
    if (facError) return facError;

    let sql = "SELECT * FROM v2_participants";
    let args = [];

    if (program_id) {
      sql += " WHERE program_id = ?";
      args.push(program_id);
    }

    // Scope enforcement: facilitators with 'assigned_groups' scope only see
    // participants belonging to their assigned groups (group membership is
    // tracked via contacts.group_name matching the family name).
    const session = await getSession();
    if (session?.role === "facilitator" && program_id) {
      const scope = await getFacilitatorParticipantScope(program_id, session.cid);
      if (scope.scope === "groups") {
        if (scope.groupNames.length === 0) {
          return NextResponse.json({ success: true, participants: [] });
        }
        sql += " AND email IN (SELECT email FROM contacts WHERE UPPER(TRIM(group_name)) IN (" + scope.groupNames.map(() => "?").join(",") + "))";
        args.push(...scope.groupNames.map((n) => n.toUpperCase()));
      }
    }

    sql += " ORDER BY created_at DESC";

    const { rows } = await db.execute({ sql, args });
    return NextResponse.json({ success: true, participants: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
