import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import crypto from "crypto";

/**
 * POST /api/investor/register
 * Self-registration for investors. Creates contact + investor profile in pending_review.
 */
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { name, email, organization_name, biography, website, linkedin,
            industries, countries, startup_stages, ticket_size_min, ticket_size_max,
            investment_experience } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Name and email are required." },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existing = await db.execute({
      sql: "SELECT cid, role FROM contacts WHERE email = ? AND deleted = 0",
      args: [email],
    });

    if (existing.rows.length > 0) {
      // User exists — if already investor, tell them
      const user = existing.rows[0];
      if (user.role === "investor") {
        return NextResponse.json({
          success: false,
          error: "An investor account with this email already exists. Please log in.",
        }, { status: 409 });
      }
      // Update role to investor and create profile
      await db.execute({
        sql: "UPDATE contacts SET role = 'investor', name = ? WHERE cid = ?",
        args: [name, user.cid],
      });

      // Create or update investor profile
      await db.execute({
        sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, approval_status, qualification_status, investment_experience, profile_completion)
              VALUES (?, ?, ?, ?, ?, 'pending_review', 'pending_review', ?, 100)
              ON CONFLICT (user_id) DO UPDATE
              SET organization_name = EXCLUDED.organization_name, biography = EXCLUDED.biography,
                  website = EXCLUDED.website, linkedin = EXCLUDED.linkedin,
                  qualification_status = 'pending_review', investment_experience = EXCLUDED.investment_experience,
                  approval_status = CASE WHEN investor_profiles.approval_status = 'rejected' THEN 'pending_review' ELSE investor_profiles.approval_status END,
                  updated_at = NOW()`,
        args: [user.cid, organization_name || null, biography || null, website || null, linkedin || null, investment_experience || null],
      });

      // Save preferences
      if (industries?.length || countries?.length || startup_stages?.length) {
        const prof = await db.execute({ sql: "SELECT id FROM investor_profiles WHERE user_id = ?", args: [user.cid] });
        await db.execute({
          sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (investor_id) DO UPDATE
                SET industries = EXCLUDED.industries, countries = EXCLUDED.countries, startup_stages = EXCLUDED.startup_stages,
                    ticket_size_min = EXCLUDED.ticket_size_min, ticket_size_max = EXCLUDED.ticket_size_max`,
          args: [prof.rows[0]?.id, industries || [], countries || [], startup_stages || [], ticket_size_min || null, ticket_size_max || null],
        });
      }

      return NextResponse.json({ success: true, message: "Investor registration submitted for review." });
    }

    // New user — create contact + profile
    const cid = `USR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const setupToken = crypto.randomBytes(32).toString("hex");
    const setupExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const tempPassword = crypto.randomBytes(16).toString("hex");

    await db.execute({
      sql: `INSERT INTO contacts (cid, name, email, password, role, status, group_name, setup_token, setup_token_expires)
            VALUES (?, ?, ?, ?, 'investor', 'active', 'INVESTOR', ?, ?)`,
      args: [cid, name, email, tempPassword, setupToken, setupExpires],
    });

    await db.execute({
      sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, approval_status, qualification_status, investment_experience, profile_completion)
            VALUES (?, ?, ?, ?, ?, 'pending_review', 'pending_review', ?, 100)`,
      args: [cid, organization_name || null, biography || null, website || null, linkedin || null, investment_experience || null],
    });

    // Save preferences
    if (industries?.length || countries?.length || startup_stages?.length) {
      const profile = await db.execute({ sql: "SELECT id FROM investor_profiles WHERE user_id = ?", args: [cid] });
      await db.execute({
        sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [profile.rows[0].id, industries || [], countries || [], startup_stages || [], ticket_size_min || null, ticket_size_max || null],
      });
    }

    // Send confirmation email
    try {
      await sendEmail({
        to: email,
        subject: "Investor Registration Received — Future Studio",
        body: `Hello ${name},\n\nYour investor registration has been received and is pending review.\n\nOrganization: ${organization_name || "Individual Investor"}\n\nWe'll notify you once your account is approved. You'll then be able to access Investor OS and discover investment opportunities.\n\n— Future Studio Team`,
      });
    } catch (_) {}

    // Notify admins
    try {
      const admins = await db.execute({
        sql: "SELECT cid FROM contacts WHERE role IN ('super_admin', 'staff') AND deleted_at IS NULL",
        args: [],
      });
      for (const a of admins.rows) {
        await db.execute({
          sql: `INSERT INTO v2_notifications (recipient_id, title, message, type, is_read, created_at, link)
                VALUES (?, ?, ?, 'investor', 0, NOW(), ?)`,
          args: [a.cid, `New Investor: ${organization_name || name}`, `${name} completed the Investor Profile Wizard. Review their qualification.`, "/admin/investors/review"],
        });
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: "Registration submitted for review. You'll be notified once approved.",
    });
  } catch (error) {
    console.error("Investor register error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
