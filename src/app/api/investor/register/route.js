import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { hashPassword } from "@/server/auth/password";
import { sendStandaloneEmail } from "@/lib/email";
import {
  findContactByEmail,
  getNewInvestorProfileId,
  insertContactForRegistration,
  insertInvestorPreferences,
  insertInvestorProfileForRegistration,
  listAdminContactIdsForNotification,
  notifyAdminsOfNewInvestor,
} from "@/models/investorRelations";

/**
 * POST /api/investor/register
 * Self-registration for investors. Creates contact + investor profile in pending_review.
 */
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { name, email, password, organization_name, biography, website, linkedin,
            industries, countries, startup_stages, ticket_size_min, ticket_size_max,
            investment_experience } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required." },
        { status: 400 },
      );
    }

    // Check if email already exists
    const existing = await findContactByEmail(email);

    if (existing.rows.length > 0) {
      // A known email is NOT proof of ownership. Never mutate an existing
      // account (role, name or profile) from this anonymous form: doing so let
      // an anonymous caller flip any account to the investor role. The
      // submission is acknowledged and reviewed by the team instead.
      if (existing.rows[0].role === "investor") {
        return NextResponse.json({
          success: false,
          error: "An investor account with this email already exists. Please log in.",
        }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        message: "Registration submitted for review. You'll be notified once approved.",
      });
    }

    // New user — create contact + profile. The password is hashed before it is
    // stored; it must never be written in clear text.
    const cid = `USR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const hashedPassword = await hashPassword(password, { rounds: 12 });

    await insertContactForRegistration(cid, name, email, hashedPassword);

    await insertInvestorProfileForRegistration(
      cid,
      organization_name || null,
      biography || null,
      website || null,
      linkedin || null,
      investment_experience || null,
    );

    // Save preferences
    if (industries?.length || countries?.length || startup_stages?.length) {
      const newProfileResult = await getNewInvestorProfileId(cid);
      await insertInvestorPreferences(
        newProfileResult.rows[0].id,
        industries || [],
        countries || [],
        startup_stages || [],
        ticket_size_min || null,
        ticket_size_max || null,
      );
    }

    // Send confirmation email
    try {
      await sendStandaloneEmail({
        to: email,
        subject: "Investor Registration Received — Future Studio",
        email_type: "investor_registration",
        contact_cid: cid,
        body: `Hello ${name},\n\nYour investor registration has been received and is pending review.\n\nOrganization: ${organization_name || "Individual Investor"}\n\nWe'll notify you once your account is approved. You'll then be able to access Investor OS and discover investment opportunities.\n\n— Future Studio Team`,
      });
    } catch (_) {}

    // Notify admins
    try {
      const admins = await listAdminContactIdsForNotification();
      for (const admin of admins.rows) {
        await notifyAdminsOfNewInvestor(admin.cid, `New Investor: ${organization_name || name}`, `${name} completed the Investor Profile Wizard. Review their qualification.`);
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
