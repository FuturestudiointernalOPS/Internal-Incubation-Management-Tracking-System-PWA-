import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { ensureVentureSchema, resolveTeamMembersForPromotion } from "@/lib/ventures";
import {
  resolveVentureRun,
  ventureRunUrl,
  createVentureInvitation,
} from "@/lib/ventureInvitations";

/**
 * POST /api/ventures/promote
 *
 * Promotes an approved program team TOWARD Venture registration — through
 * the same Forms/Runs intake pipeline. It does NOT create a Venture.
 *
 * Flow (Phase 1 convergence):
 *   1. Only Program Managers (assigned to the program) or Super Admins.
 *   2. Team must be is_venture_ready = true and not already promoted.
 *   3. Resolve the ACTIVE Venture intake (configured run / flagged form).
 *   4. Build a pre-filled submission on the intake run (company info mapped
 *      to the form's fields by settings.key; team + program kept as the
 *      provenance context via a tracked invitation row).
 *   5. Staff/PM review the submission like any other intake submission.
 *   6. Approval creates the Venture through createVentureFromSubmission
 *      (single pipeline — no direct insert here).
 *
 * Provenance is preserved: invitation row carries program_id + team_id, and
 * the approval pipeline derives venture_origins from it.
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureVentureSchema();
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
    const { team_id, program_id, company_name, registration_number, industry, business_stage, description, website } = body;

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

    // ─── 6. Resolve the ACTIVE Venture intake (Forms/Runs) ───
    const run = await resolveVentureRun();
    if (!run || !run.public_slug) {
      return NextResponse.json(
        { success: false, error: "No active Venture intake configured. Configure the Venture Application form/run first (builder toggle or seed), then retry." },
        { status: 400 },
      );
    }

    // ─── 7. Determine the team lead (prospective founder) ───
    const teamMembers = await resolveTeamMembersForPromotion(team.id);
    let leadCid = team.leader_id || team.handler_id;
    if (!leadCid && teamMembers.length > 0) {
      leadCid = teamMembers[0].contact_id;
    }
    if (!leadCid) {
      return NextResponse.json(
        { success: false, error: "This team has no lead contact. Select a team lead first." },
        { status: 400 },
      );
    }
    const leadRes = await db.execute({
      sql: "SELECT cid, name, email FROM contacts WHERE cid = ?",
      args: [String(leadCid)],
    });
    const lead = leadRes.rows[0];
    if (!lead) {
      return NextResponse.json(
        { success: false, error: "Team lead contact not found." },
        { status: 404 },
      );
    }
    if (!lead.email) {
      return NextResponse.json(
        { success: false, error: "The team lead has no email address." },
        { status: 400 },
      );
    }

    // ─── 8. Venture identity for the submission ───
    const finalCompanyName = (company_name || team.name || program.name || "").trim();
    const finalIndustry = industry || "other";
    const finalStage = business_stage || "idea";
    const finalDescription = description?.trim() || `Promoted from program: ${program.name}`;
    const finalWebsite = website?.trim() || null;

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

    // ─── 9. Prefill the intake submission ───
    // Map values onto the intake form's fields via settings.key when the
    // fields define keys; also keep literal keys (the pipeline falls back to
    // them when a form has no key-mapped fields).
    const literalData = {
      company_name: finalCompanyName,
      industry: finalIndustry,
      business_stage: finalStage,
      description: finalDescription,
      website: finalWebsite,
      registration_number: registration_number?.trim() || null,
      founder_name: lead.name || team.name,
      founder_email: lead.email,
    };
    const payload = { ...literalData };
    try {
      const fieldRes = await db.execute({
        sql: "SELECT id, settings FROM platform_form_fields WHERE form_id = ?",
        args: [run.form_id],
      });
      const fieldByKey = {};
      for (const f of fieldRes.rows || []) {
        if (f.settings?.key) fieldByKey[f.settings.key] = String(f.id);
      }
      for (const [key, value] of Object.entries(literalData)) {
        if (value === null || value === undefined || value === "") continue;
        const fieldId = fieldByKey[key];
        if (fieldId) payload[fieldId] = String(value);
      }
    } catch (_) {}

    // ─── 10. Tracked invitation = provenance context (no email sent; this is an internal promotion record) ───
    const invitation = await createVentureInvitation({
      runId: run.id,
      contactCid: lead.cid,
      email: lead.email,
      sourceType: "team",
      programId: String(program.id),
      cohortId: null,
      teamId: String(team.id),
      invitedByCid: session.cid,
      expiresInHours: 24 * 366,
    });

    // ─── 11. Create the intake submission (submitted — awaiting review) ───
    const subRes = await db.execute({
      sql: `INSERT INTO platform_form_submissions
              (run_id, submitter_id, submitter_name, status, data, invitation_id, submitted_at, updated_at)
            VALUES (?, ?, ?, 'submitted', ?::jsonb, ?, NOW(), NOW())
            RETURNING id`,
      args: [
        run.id,
        lead.cid,
        lead.name || team.name,
        JSON.stringify(payload),
        invitation.id,
      ],
    });
    const submissionId = subRes.rows[0]?.id;
    if (!submissionId) {
      return NextResponse.json(
        { success: false, error: "Failed to create the promotion submission." },
        { status: 500 },
      );
    }

    // ─── 12. Audit note ───
    // The audit trail for this action IS the submission row + invitation row
    // created above (venture_activity_log requires a venture_id, which does
    // not exist until approval — the pipeline writes venture history then).

    return NextResponse.json({
      success: true,
      submission_id: submissionId,
      message: "Team promotion submitted through the Venture intake. Review the submission to approve it — the Venture is created only after approval.",
      run: {
        run_id: run.id,
        name: run.name,
        slug: run.public_slug,
        url: ventureRunUrl(run),
      },
    });
  } catch (error) {
    console.error("[Promote] Venture promotion error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to submit the promotion." },
      { status: 500 },
    );
  }
}
