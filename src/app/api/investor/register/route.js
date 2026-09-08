import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import {
  findContactByEmail,
  getExistingInvestorProfileId,
  getNewInvestorProfileId,
  insertContactForRegistration,
  insertInvestorPreferences,
  insertInvestorProfileForRegistration,
  listAdminContactIdsForNotification,
  notifyAdminsOfNewInvestor,
  setContactRoleToInvestor,
  upsertInvestorPreferences,
  upsertInvestorProfileForRegistration,
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
      // User exists — if already investor, tell them
      const user = existing.rows[0];
      if (user.role === "investor") {
        return NextResponse.json({
          success: false,
          error: "An investor account with this email already exists. Please log in.",
        }, { status: 409 });
      }
      // Update role to investor and create profile
      await setContactRoleToInvestor(name, user.cid);

      // Create or update investor profile
      await upsertInvestorProfileForRegistration(
        user.cid,
        organization_name || null,
        biography || null,
        website || null,
        linkedin || null,
        investment_experience || null,
      );

      // Save preferences
      if (industries?.length || countries?.length || startup_stages?.length) {
        const prof = await getExistingInvestorProfileId(user.cid);
        await upsertInvestorPreferences(
          prof.rows[0]?.id,
          industries || [],
          countries || [],
          startup_stages || [],
          ticket_size_min || null,
          ticket_size_max || null,
        );
      }

      return NextResponse.json({ success: true, message: "Investor registration submitted for review." });
    }

    // New user — create contact + profile
    const cid = `USR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    await insertContactForRegistration(cid, name, email, password);

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
      const profile = await getNewInvestorProfileId(cid);
      await insertInvestorPreferences(
        profile.rows[0].id,
        industries || [],
        countries || [],
        startup_stages || [],
        ticket_size_min || null,
        ticket_size_max || null,
      );
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
      const admins = await listAdminContactIdsForNotification();
      for (const a of admins.rows) {
        await notifyAdminsOfNewInvestor(a.cid, `New Investor: ${organization_name || name}`, `${name} completed the Investor Profile Wizard. Review their qualification.`);
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
