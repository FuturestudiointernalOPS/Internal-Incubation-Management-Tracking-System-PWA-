import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";

/**
 * POST /api/investor/register
 * Self-registration for investors. Creates contact + investor profile in pending_review.
 */
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { name, email, password, organization_name, biography, website, linkedin } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required." },
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
        sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, approval_status)
              VALUES (?, ?, ?, ?, ?, 'pending_review')
              ON CONFLICT (user_id) DO UPDATE
              SET organization_name = EXCLUDED.organization_name, biography = EXCLUDED.biography,
                  website = EXCLUDED.website, linkedin = EXCLUDED.linkedin,
                  approval_status = CASE WHEN investor_profiles.approval_status = 'rejected' THEN 'pending_review' ELSE investor_profiles.approval_status END,
                  updated_at = NOW()`,
        args: [user.cid, organization_name || null, biography || null, website || null, linkedin || null],
      });

      return NextResponse.json({ success: true, message: "Investor registration submitted for review." });
    }

    // New user — create contact + profile
    const cid = `USR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    await db.execute({
      sql: `INSERT INTO contacts (cid, name, email, password, role, status, group_name)
            VALUES (?, ?, ?, ?, 'investor', 'active', 'INVESTOR')`,
      args: [cid, name, email, password],
    });

    await db.execute({
      sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, approval_status)
            VALUES (?, ?, ?, ?, ?, 'pending_review')`,
      args: [cid, organization_name || null, biography || null, website || null, linkedin || null],
    });

    // Send confirmation email
    try {
      await sendEmail({
        to: email,
        subject: "Investor Registration Received — Future Studio",
        body: `Hello ${name},\n\nYour investor registration has been received and is pending review.\n\nOrganization: ${organization_name || "Individual Investor"}\n\nWe'll notify you once your account is approved. You'll then be able to access Investor OS and discover investment opportunities.\n\n— Future Studio Team`,
      });
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
