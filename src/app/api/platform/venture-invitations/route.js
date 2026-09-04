/**
 * POST /api/platform/venture-invitations
 *
 * Invites a person (participant, team lead, or external email) into the
 * configured Venture Run. Creates a tracked invitation + sends an email with
 * the run URL. NEVER creates a Venture — only the approval pipeline does.
 *
 * Channels:
 *  - source_type='participant' : contact_id (+ optional program_id/cohort_id)
 *  - source_type='team'        : team_id (+ lead_id selection if no team lead)
 *  - source_type='external'    : email
 *
 * Roles: super_admin, staff, program_manager (PM scoped to own programs).
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import {
  resolveVentureRun,
  ventureRunUrl,
  createVentureInvitation,
} from "@/lib/ventureInvitations";

export async function POST(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }
  if (!["super_admin", "staff", "program_manager"].includes(session.role)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Only Future Studio staff can invite Ventures." },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();
    const { run_id, contact_id, email, source_type = "external", program_id, cohort_id, team_id, lead_id, expires_in_hours } = body;

    // ── Resolve the Venture Run ──
    const run = run_id
      ? (await db.execute({ sql: "SELECT * FROM platform_form_runs WHERE id = ?", args: [run_id] })).rows[0]
      : await resolveVentureRun();
    if (!run || !run.public_slug) {
      return NextResponse.json(
        { success: false, error: "No Venture Run configured. Run the Venture Application seed first." },
        { status: 400 },
      );
    }

    // ── PM scope: must be assigned to the program (unless super_admin) ──
    if (session.role === "program_manager" && program_id) {
      const prog = (
        await db.execute({ sql: "SELECT assigned_pm_id FROM v2_programs WHERE id::text = ?", args: [program_id] })
      ).rows[0];
      if (!prog) {
        return NextResponse.json({ success: false, error: "Program not found." }, { status: 404 });
      }
      if (prog.assigned_pm_id !== session.cid) {
        return NextResponse.json(
          { success: false, error: "You are not the Program Manager for this program." },
          { status: 403 },
        );
      }
    }

    // ── Resolve the invitee per channel ──
    let inviteEmail = email;
    let inviteContactCid = contact_id || null;
    let inviteProgram = program_id || null;
    let inviteTeam = team_id || null;

    if (source_type === "participant") {
      if (!contact_id) {
        return NextResponse.json({ success: false, error: "contact_id is required for participant invitations." }, { status: 400 });
      }
      const contact = (
        await db.execute({ sql: "SELECT cid, name, email FROM contacts WHERE cid = ?", args: [contact_id] })
      ).rows[0];
      if (!contact) return NextResponse.json({ success: false, error: "Contact not found." }, { status: 404 });
      if (!contact.email) {
        return NextResponse.json({ success: false, error: "This participant has no email address." }, { status: 400 });
      }
      inviteEmail = contact.email;
      inviteContactCid = contact.cid;
      if (!inviteProgram) {
        const pp = (
          await db.execute({
            sql: "SELECT program_id FROM participant_programs WHERE participant_id = ? ORDER BY assigned_at DESC LIMIT 1",
            args: [contact_id],
          })
        ).rows[0];
        if (pp) inviteProgram = pp.program_id ? String(pp.program_id) : null;
      }
    }

    if (source_type === "team") {
      if (!team_id) {
        return NextResponse.json({ success: false, error: "team_id is required for team invitations." }, { status: 400 });
      }
      const team = (
        await db.execute({ sql: "SELECT * FROM v2_teams WHERE id::text = ?", args: [team_id] })
      ).rows[0];
      if (!team) return NextResponse.json({ success: false, error: "Team not found." }, { status: 404 });
      const leadCid = lead_id || team.leader_id || team.handler_id;
      if (!leadCid) {
        return NextResponse.json(
          { success: false, error: "This team has no lead. Select a team lead first." },
          { status: 400 },
        );
      }
      const lead = (
        await db.execute({ sql: "SELECT cid, name, email FROM contacts WHERE cid = ?", args: [leadCid] })
      ).rows[0];
      if (!lead) return NextResponse.json({ success: false, error: "Team lead contact not found." }, { status: 404 });
      if (!lead.email) {
        return NextResponse.json({ success: false, error: "The team lead has no email address." }, { status: 400 });
      }
      inviteEmail = lead.email;
      inviteContactCid = lead.cid;
      inviteTeam = String(team.id);
      if (!inviteProgram && team.program_id) inviteProgram = String(team.program_id);
    }

    if (!inviteEmail || !inviteEmail.includes("@")) {
      return NextResponse.json({ success: false, error: "A valid recipient email is required." }, { status: 400 });
    }

    // ── Create invitation + send email ──
    const invitation = await createVentureInvitation({
      runId: run.id,
      contactCid: inviteContactCid,
      email: inviteEmail,
      sourceType: source_type,
      programId: inviteProgram,
      cohortId: cohort_id || null,
      teamId: inviteTeam,
      invitedByCid: session.cid,
      expiresInHours: expires_in_hours || 168,
    });

    const url = `${ventureRunUrl(run)}?invitation=${invitation.token}`;
    try {
      const { sendVentureInvitationEmail } = await import("@/lib/email");
      await sendVentureInvitationEmail({ to: inviteEmail, name: null, runUrl: url, runName: run.name });
    } catch (e) {
      console.error("[Venture Invitations] email send failed:", e.message);
    }

    return NextResponse.json({
      success: true,
      invitation_id: invitation.id,
      email: inviteEmail,
      source_type: source_type,
      expires_at: invitation.expires_at,
      run: { run_id: run.id, name: run.name, slug: run.public_slug, url },
    });
  } catch (error) {
    console.error("Venture invitation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create the invitation." },
      { status: 500 },
    );
  }
}
