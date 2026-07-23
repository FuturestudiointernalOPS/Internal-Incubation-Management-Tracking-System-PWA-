import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { createHandler } from "@/lib/api/createHandler";
import {
  generateVentureId,
  validateCompanyInfo,
  checkDuplicates,
  createVenture,
  createFounder,
  logVentureActivity,
  addVentureHistory,
  createVentureNotification,
  sendFounderInvitation,
  ensureVentureSchema,
} from "@/lib/ventures";

/**
 * POST /api/ventures/register
 *
 * Enhancement 1.1 — Workflow B: Direct Startup Registration
 *
 * Registers a startup directly into Venture OS without going through Program OS.
 * Flow:
 *   1. Verify Super Admin permission
 *   2. Validate company information
 *   3. Check for duplicates
 *   4. Generate Venture ID
 *   5. Create Venture
 *   6. Create Founder
 *   7. Generate invitation
 *   8. Send invitation email
 *   9. Initialize Startup Profile Wizard
 *  10. Create activity logs
 *  11. Create notifications
 *  12. Redirect to Venture Dashboard
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

    // ── Step 4: Generate Venture ID ──
    const ventureId = generateVentureId();

    // ── Step 5: Create Venture ──
    await createVenture({
      venture_id: ventureId,
      company_name,
      registration_number,
      industry,
      business_stage,
      description,
      website,
      logo_url,
      created_by: req.session?.cid || "system",
    });

    // ── Step 6: Create Founder with invitation token ──
    const invitationToken = uuidv4();

    await createFounder({
      venture_id: ventureId,
      email: founder_email,
      name: founder_name,
      phone: founder_phone,
      title: founder_title,
      invitation_token: invitationToken,
    });

    // ── Step 7: Initialize Startup Profile Wizard ──
    await addVentureHistory({
      venture_id: ventureId,
      event_type: "PROFILE_WIZARD_INIT",
      description: "Startup Profile Wizard initialized",
      metadata: {
        step: 1,
        total_steps: 5,
        step_name: "Company Information",
        completed: true,
      },
    });

    await addVentureHistory({
      venture_id: ventureId,
      event_type: "VENTURE_REGISTERED",
      description: `Startup "${company_name}" registered directly into Venture OS`,
      metadata: {
        registration_method: "direct",
        industry,
        business_stage,
      },
    });

    // ── Step 8: Create activity logs ──
    await logVentureActivity({
      venture_id: ventureId,
      action: "VENTURE_CREATED",
      actor_cid: req.session?.cid || "system",
      actor_name: req.session?.name || "System",
      details: {
        company_name,
        industry,
        business_stage,
        registration_method: "direct",
      },
    });

    await logVentureActivity({
      venture_id: ventureId,
      action: "FOUNDER_INVITED",
      actor_cid: req.session?.cid || "system",
      actor_name: req.session?.name || "System",
      details: {
        founder_email,
        founder_name,
        invitation_token: invitationToken,
      },
    });

    // ── Step 9: Send invitation email ──
    const emailResult = await sendFounderInvitation({
      email: founder_email,
      name: founder_name,
      venture_name: company_name,
      token: invitationToken,
    });

    // ── Step 10: Create notifications ──
    await createVentureNotification({
      recipient_id: "sa",
      title: "Startup Created",
      message: `Startup "${company_name}" (${ventureId}) has been registered in Venture OS.`,
      type: "venture",
    });

    await createVentureNotification({
      recipient_id: "sa",
      title: "Founder Invitation Sent",
      message: `Invitation sent to ${founder_name} (${founder_email}) for venture "${company_name}".`,
      type: "venture",
    });

    // ── Step 11: Return success with venture data ──
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
  },
);
