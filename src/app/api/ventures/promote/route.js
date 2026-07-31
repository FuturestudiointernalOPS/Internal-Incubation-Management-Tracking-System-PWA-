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

    // Support both team_id (from PM workspace) and program_id (from dedicated promote page)
    const { team_id, program_id, company_name, registration_number, industry, business_stage, description, website, logo_url } = body;

    if (!team_id && !program_id) {
      return NextResponse.json(
        { success: false, error: "team_id or program_id is required." },
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
    // Support both team_id (from PM workspace button) and program_id (from dedicated promote page)
    // When program_id is given without team_id, find the first venture-ready team
    let team;
    if (team_id) {
      const teamRes = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE id::text = ?",
        args: [team_id],
      });
      if (teamRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Team not found." },
          { status: 404 },
        );
      }
      team = teamRes.rows[0];
    } else if (program_id) {
      // Find the first venture-ready team in this program
      const teamRes = await db.execute({
        sql: "SELECT * FROM v2_teams WHERE program_id::text = ? AND is_venture_ready = 1 LIMIT 1",
        args: [program_id],
      });
      if (teamRes.rows.length === 0) {
        // Fallback: any team in the program
        const fallbackRes = await db.execute({
          sql: "SELECT * FROM v2_teams WHERE program_id::text = ? LIMIT 1",
          args: [program_id],
        });
        if (fallbackRes.rows.length === 0) {
          return NextResponse.json(
            { success: false, error: "No teams found in this program. Create a team first." },
            { status: 404 },
          );
        }
        team = fallbackRes.rows[0];
      } else {
        team = teamRes.rows[0];
      }
    }

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
      sql: "SELECT * FROM v2_programs WHERE id::text = ?",
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

    // ─── 6. Generate Venture IDs ───
    const ventureUuid = uuidv4();  // Real UUID for database
    const ventureId = `VNT-${ventureUuid.replace(/-/g, "").substring(0, 8).toUpperCase()}`;  // Display ID
    const now = new Date().toISOString();

    // Use provided company info or derive from team/program names
    const finalCompanyName = (company_name || team.name || program.name || "").trim();
    const finalIndustry = industry || "other";
    const finalStage = business_stage || "early_traction";

    // Check for duplicate company name
    const dupCheck = await db.execute({
      sql: "SELECT venture_id FROM ventures WHERE LOWER(company_name) = LOWER(?)",
      args: [finalCompanyName],
    });
    if (dupCheck.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: "A company with this name already exists in Venture OS." },
        { status: 409 },
      );
    }

    // ─── 7. Create the Venture ───
    try {
      // Try with both name and company_name
      await db.execute({
        sql: `INSERT INTO ventures (venture_id, name, company_name, registration_number, industry, business_stage, description, website, logo_url, status, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
        args: [
          ventureUuid, finalCompanyName, finalCompanyName,
          registration_number?.trim() || null,
          finalIndustry, finalStage,
          description?.trim() || `Promoted from program: ${program.name}`,
          website?.trim() || null, logo_url?.trim() || null,
          session.cid || "system", now, now,
        ],
      });
    } catch (err) {
      // company_name column may not exist — fall back to just "name"
      if (err.message?.includes("company_name")) {
        await db.execute({
          sql: `INSERT INTO ventures (venture_id, name, registration_number, industry, business_stage, description, website, logo_url, status, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
          args: [
            ventureUuid, finalCompanyName,
            registration_number?.trim() || null,
            finalIndustry, finalStage,
            description?.trim() || `Promoted from program: ${program.name}`,
            website?.trim() || null, logo_url?.trim() || null,
            session.cid || "system", now, now,
          ],
        });
      } else {
        throw err;
      }
    }

    // ─── 8. Update team with venture_id ───
    await db.execute({
      sql: "UPDATE v2_teams SET venture_id = ?, promoted_at = ? WHERE id = ?",
      args: [ventureUuid, now, team.id],
    });

    // ─── 9. Update program with venture_id (non-blocking) ───
    try {
      await db.execute({
      sql: "UPDATE v2_programs SET venture_id = ? WHERE id = ?",
      args: [ventureUuid, program.id],
    });
    } catch (_) {}

    // ─── 10. Copy founders ───
    // Find team members via v2_group_members or v2_participants
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
          sql: "SELECT user_id as contact_id, name FROM v2_participants WHERE program_id::text = ?",
          args: [team.program_id],
        });
        teamMembers = partRes.rows || [];
      } catch (_) {}
    }

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
          sql: `INSERT INTO venture_founders (venture_id, email, name, title, status, created_at, updated_at)
                VALUES (?, ?, ?, 'founder', 'active', ?, ?)
                ON CONFLICT (venture_id, email) DO NOTHING`,
          args: [ventureId, contact.email || `${fId}@impactos.local`, contact.name || fId, now, now],
        });
      } catch (_) {}
    }

    // Add team members as venture members
    for (const member of teamMembers) {
      if (uniqueFounders.has(member.contact_id)) continue;
      try {
        // venture_members stores venture_id as the VNT code (TEXT)
        await db.execute({
          sql: `INSERT INTO venture_members (venture_id, user_cid, role, joined_at)
                VALUES (?, ?, 'member', ?)
                ON CONFLICT (venture_id, user_cid) DO NOTHING`,
          args: [ventureId, String(member.contact_id), now],
        });
      } catch (_) {}
    }

    // ─── 11. Create activity logs (non-blocking) ───
    try {
      await db.execute({
      sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
            VALUES (?, 'PROGRAM_PROMOTED', ?, ?, ?::jsonb, ?)`,
      args: [
        ventureUuid,
        session.cid || "system",
        session.name || "",
        JSON.stringify({
          program_id: program.id,
          program_name: program.name,
          team_id: team.id,
          team_name: team.name,
        }),
        now,
      ],
    });
    } catch (_) {}

    try {
      await db.execute({
      sql: `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details, created_at)
            VALUES (?, 'VENTURE_CREATED', ?, ?, ?::jsonb, ?)`,
      args: [
        ventureUuid,
        session.cid || "system",
        session.name || "",
        JSON.stringify({
          venture_id: ventureId,
          venture_name: finalCompanyName,
          registration_method: "program_promotion",
        }),
        now,
      ],
    });
    } catch (_) {}

    // ─── 12. Create venture history record (non-blocking) ───
    try {
      await db.execute({
      sql: `INSERT INTO venture_history (venture_id, event_type, description, metadata, created_at)
            VALUES (?, 'PROMOTED', ?, ?::jsonb, ?)`,
      args: [
        ventureUuid,
        `Program-to-Venture promotion from "${program.name}"`,
        JSON.stringify({
          program_id: program.id,
          program_name: program.name,
          team_id: team.id,
          team_name: team.name,
          team_leader: team.leader_id || team.handler_id,
        }),
        now,
      ],
    });
    } catch (_) {}

    // ─── 13. Send notifications ───
    const notifyRecipients = [team.leader_id, team.handler_id, ...founderIds].filter(Boolean);
    for (const recipientId of new Set(notifyRecipients)) {
      try {
        await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
          args: [
            recipientId,
            "Promotion Successful",
            `Your team "${team.name}" has been promoted from "${program.name}" to Venture OS. Access your venture dashboard to continue.`,
            "venture_promotion",
            now,
          ],
        });
      } catch (_) {}
    }

    // Also notify the program manager
    if (program.assigned_pm_id && program.assigned_pm_id !== session.cid) {
      try {
        await db.execute({
          sql: "INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)",
          args: [
            program.assigned_pm_id,
            "Promotion Successful",
            `Team "${team.name}" has been promoted from "${program.name}" to Venture OS (${ventureId}).`,
            "venture_promotion",
            now,
          ],
        });
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      venture: {
        venture_id: ventureId,
        company_name: finalCompanyName,
        status: "active",
      },
      redirect: `/admin/ventures/${ventureId}`,
      message: `Team "${team.name}" successfully promoted to Venture OS.`,
    });
  } catch (error) {
    console.error("Venture promote error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "An unexpected error occurred during promotion." },
      { status: 500 },
    );
  }
}
