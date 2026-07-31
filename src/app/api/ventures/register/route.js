import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { createHandler } from "@/lib/api/createHandler";
import {
  generateVentureId,
  validateCompanyInfo,
  checkDuplicates,
  ensureVentureSchema,
} from "@/lib/ventures";

/**
 * POST /api/ventures/register
 *
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 *
 * All DB operations wrapped in a transaction to prevent orphan ventures
 * when any step fails (e.g. missing column, constraint violation).
 */
export const POST = createHandler(
  { roles: ["super_admin"] },
  async (req) => {
    // Ensure venture schema is up to date (safe migration)
    await ensureVentureSchema();

    const body = await req.json();
    const {
      company_name,
      registration_number,
      industry,
      business_stage,
      description,
      website,
      logo_url,
      founder_email,
      founder_name,
      founder_phone,
      founder_title,
    } = body;

    // ── Step 2: Validate company information ──
    const validation = validateCompanyInfo({
      company_name,
      registration_number,
      industry,
      business_stage,
      founder_email,
      founder_name,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: "Validation failed", errors: validation.errors },
        { status: 400 },
      );
    }

    // ── Step 3: Check for duplicates ──
    const duplicates = await checkDuplicates({
      company_name,
      registration_number,
      founder_email,
    });

    if (duplicates.hasDuplicates) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate detected",
          conflicts: duplicates.conflicts,
        },
        { status: 409 },
      );
    }

    // ── Steps 4-11: Everything in a single transaction ──
    const ventureId = generateVentureId();
    const invitationToken = uuidv4();
    const actorCid = req.session?.cid || "system";
    const actorName = req.session?.name || "System";

    try {
      await db.transaction(async (query) => {
        // Step 5: Create Venture
        const name = company_name.trim();
        await query(
          `INSERT INTO ventures (venture_id, name, company_name, registration_number, industry, business_stage, description, website, logo_url, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [ventureId, name, name, registration_number||null, industry, business_stage, description||null, website||null, logo_url||null, actorCid]
        );

        // Step 6: Create Founder with invitation token
        await query(
          `INSERT INTO venture_founders (venture_id, email, name, phone, title, invitation_token, invitation_sent_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'pending')`,
          [ventureId, founder_email.trim().toLowerCase(), founder_name.trim(), founder_phone||null, founder_title||null, invitationToken]
        );

        // Step 7: Initialize Startup Profile Wizard
        await query(
          `INSERT INTO venture_history (venture_id, event_type, description, metadata)
           VALUES ($1, 'PROFILE_WIZARD_INIT', 'Startup Profile Wizard initialized', $2::jsonb)`,
          [ventureId, JSON.stringify({ step: 1, total_steps: 5, step_name: "Company Information", completed: true })]
        );

        await query(
          `INSERT INTO venture_history (venture_id, event_type, description, metadata)
           VALUES ($1, 'VENTURE_REGISTERED', $2, $3::jsonb)`,
          [ventureId, `Startup "${name}" registered directly into Venture OS`, JSON.stringify({ registration_method: "direct", industry, business_stage })]
        );

        // Step 8: Create activity logs
        await query(
          `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details)
           VALUES ($1, 'VENTURE_CREATED', $2, $3, $4::jsonb)`,
          [ventureId, actorCid, actorName, JSON.stringify({ company_name: name, industry, business_stage, registration_method: "direct" })]
        );

        await query(
          `INSERT INTO venture_activity_log (venture_id, action, actor_cid, actor_name, details)
           VALUES ($1, 'FOUNDER_INVITED', $2, $3, $4::jsonb)`,
          [ventureId, actorCid, actorName, JSON.stringify({ founder_email: founder_email.trim().toLowerCase(), founder_name: founder_name.trim(), invitation_token: invitationToken })]
        );
      });

      // ── Steps 9-11: Outside transaction (email + notifications can fail independently) ──
      const { sendFounderInvitation, createVentureNotification } = await import("@/lib/ventures");

      const emailResult = await sendFounderInvitation({
        email: founder_email,
        name: founder_name,
        venture_name: company_name,
        token: invitationToken,
      }).catch(() => ({ success: false }));

      await createVentureNotification({
        recipient_id: "sa",
        title: "Startup Created",
        message: `Startup "${company_name}" (${ventureId}) has been registered in Venture OS.`,
        type: "venture",
      }).catch(() => {});

      await createVentureNotification({
        recipient_id: "sa",
        title: "Founder Invitation Sent",
        message: `Invitation sent to ${founder_name} (${founder_email}) for venture "${company_name}".`,
        type: "venture",
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        venture: {
          venture_id: ventureId,
          company_name: company_name.trim(),
          industry,
          business_stage,
          status: "active",
        },
        founder: {
          email: founder_email.trim().toLowerCase(),
          name: founder_name.trim(),
          status: "pending",
        },
        invitation: {
          token: invitationToken,
          email_sent: emailResult.success,
        },
        redirect: `/admin/ventures/${ventureId}`,
      });
    } catch (error) {
      console.error("Registration transaction failed:", error.message);
      return NextResponse.json(
        { success: false, error: `Registration failed: ${error.message}` },
        { status: 500 },
      );
    }
  },
);
