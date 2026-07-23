import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/ventures/promote
 *
 * Promotes an approved program team into Venture OS.
 * Business Rules:
 * 1. Only Program Managers or Super Admins can promote
 * 2. Team must have is_venture_ready = true
 * 3. Team must not already have a venture_id
 * 4. Creates venture, copies founders and members, logs activity
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { team_id } = body;

    if (!team_id) {
      return NextResponse.json(
        { success: false, error: "team_id is required." },
        { status: 400 },
      );
    }

    // ─── 1. Verify Program Manager permissions ───
    const isAuthorized =
      session.role === "super_admin" || session.role === "program_manager";
    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Only Program Managers can promote ventures." },
        { status: 403 },
      );
    }

    // ─── 2. Fetch the team ───
    const teamRes = await db.execute({
      sql: "SELECT * FROM v2_teams WHERE id = ?",
      args: [team_id],
    });
    if (teamRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Team not found." },
        { status: 404 },
      );
    }
    const team = teamRes.rows[0];

    // ─── 3. Verify the team is approved (is_venture_ready) ───
    if (!team.is_venture_ready) {
      return NextResponse.json(
        { success: false, error: "Team is not approved for venture promotion. Set is_venture_ready = true first." },
        { status: 400 },
      );
    }

    // ─── 4. Verify the team has not already been promoted ───
    if (team.venture_id) {
      return NextResponse.json(
        { success: false, error: "Team has already been promoted to Venture OS." },
        { status: 409 },
      );
    }

    // ─── 5. Verify program exists ───
    const progRes = await db.execute({
      sql: "SELECT * FROM v2_programs WHERE id = ?",
      args: [team.program_id],
    });
    if (progRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found." },
        { status: 404 },
      );
    }
    const program = progRes.rows[0];

    // Verify PM is assigned to this program (unless super_admin)
    if (
      session.role !== "super_admin" &&
      program.assigned_pm_id !== session.cid
    ) {
      return NextResponse.json(
        { success: false, error: "You are not the Program Manager for this program." },
        { status: 403 },
      );
    }

    // ─── 6. Create the Venture ───
    const ventureId = uuidv4();
    const ventureName = `${team.name} Venture`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO ventures
        (id, name, status, description, program_id, origin_team_id, owner_id, stage, business_stage, created_at, updated_at)
        VALUES (?, ?, 'active', ?, ?, ?, ?, 'ideation', 'early', ?, ?)`,
      args: [
        ventureId,
        ventureName,
        `Promoted from program: ${program.name}`,
        team.program_id,
        team.id,
        team.leader_id || team.handler_id || session.cid,
        now,
        now,
      ],
    });

    // ─── 7. Copy founders (from v2_team_members or v2_participants) ───
    // Try to get team members from v2_team_members or v2_participants
    let teamMembers = [];
    try {
      const memberRes = await db.execute({
        sql: "SELECT contact_id, name FROM v2_group_members WHERE group_id = ?",
        args: [team.id],
      });
      teamMembers = memberRes.rows || [];
    } catch (_) {}

    // If no members found, try v2_participants
    if (teamMembers.length === 0 && team.program_id) {
      try {
        const partRes = await db.execute({
          sql: "SELECT user_id as contact_id, name FROM v2_participants WHERE program_id = ?",
          args: [team.program_id],
        });
        teamMembers = partRes.rows || [];
      } catch (_) {}
    }

    // Insert founders
    const founderIds = [team.leader_id, team.handler_id].filter(Boolean);
    const uniqueFounders = new Set();

    // Add leader and handler as founders
    for (const fId of founderIds) {
      if (uniqueFounders.has(fId)) continue;
      uniqueFounders.add(fId);
      try {
        const contactRes = await db.execute({
          sql: "SELECT name, email FROM contacts WHERE cid = ?",
          args: [fId],
        });
        const contact = contactRes.rows[0] || {};
        await db.execute({
          sql: "INSERT INTO venture_founders (venture_id, contact_id, name, email, role) VALUES (?, ?, ?, ?, 'founder') ON CONFLICT DO NOTHING",
          args: [ventureId, fId, contact.name || fId, contact.email || null],
        });
      } catch (_) {}
    }

    // Add team members as venture members
    for (const member of teamMembers) {
      if (uniqueFounders.has(member.contact_id)) continue;
      try {
        await db.execute({
          sql: "INSERT INTO venture_members (venture_id, contact_id, member_type, role) VALUES (?, ?, 'member', 'member') ON CONFLICT DO NOTHING",
          args: [ventureId, member.contact_id],
        });
      } catch (_) {}
    }

    // ─── 8. Update team with venture_id ───
    await db.execute({
      sql: "UPDATE v2_teams SET venture_id = ?, promoted_at = ? WHERE id = ?",
      args: [ventureId, now, team.id],
    });

    // ─── 9. Create activity logs ───
    await db.execute({
      sql: `INSERT INTO venture_activity_log (venture_id, action, actor_id, details, metadata)
        VALUES (?, 'PROGRAM_PROMOTED', ?, ?, ?)`,
      args: [
        ventureId,
        session.cid,
        `Venture promoted from program ${program.name} by ${session.name || session.cid}`,
        JSON.stringify({
          program_id: program.id,
          program_name: program.name,
          team_id: team.id,
          team_name: team.name,
        }),
      ],
    });

    await db.execute({
      sql: `INSERT INTO venture_activity_log (venture_id, action, actor_id, details, metadata)
        VALUES (?, 'VENTURE_CREATED', ?, ?, ?)`,
      args: [
        ventureId,
        session.cid,
        `Venture "${ventureName}" created via program promotion`,
        JSON.stringify({ venture_id: ventureId, venture_name: ventureName }),
      ],
    });

    // ─── 10. Create venture history record ───
    await db.execute({
      sql: `INSERT INTO venture_history (venture_id, event_type, source, source_id, description, data)
        VALUES (?, 'PROMOTED', 'program', ?, ?, ?)`,
      args: [
        ventureId,
        program.id,
        `Program-to-Venture promotion from "${program.name}"`,
        JSON.stringify({
          program_id: program.id,
          program_name: program.name,
          team_id: team.id,
          team_name: team.name,
          team_leader: team.leader_id || team.handler_id,
        }),
      ],
    });

    // ─── 11. Send notification ───
    const notifyRecipients = [team.leader_id, team.handler_id, ...founderIds].filter(Boolean);
    for (const recipientId of new Set(notifyRecipients)) {
      try {
        await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)",
          args: [
            recipientId,
            "Promotion Successful",
            `Your team "${team.name}" has been promoted from "${program.name}" to Venture OS. Access your venture dashboard to continue.`,
            "venture_promotion",
          ],
        });
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      venture_id: ventureId,
      venture_name: ventureName,
      redirect: `/pm/ventures/${ventureId}`,
      message: `Team "${team.name}" successfully promoted to Venture OS.`,
    });
  } catch (error) {
    console.error("Venture promote error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
