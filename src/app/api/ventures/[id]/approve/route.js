import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendVentureApprovalEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { logVentureActivity, createVentureNotification } from "@/lib/ventures";
import {
  activateVenture,
  createApprovalPasswordSetupToken,
  getContactCidByLowerEmail,
  getFoundersForVentureApproval,
  getVentureForApproval,
} from "@/models/ventureJourney";

/**
 * POST /api/ventures/[id]/approve
 * Super admin approves a pending venture (created via invite link).
 * Sets status to 'active' and emails the founder(s).
 */
export async function POST(req, { params }) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { id } = await params;

    const vRes = await getVentureForApproval(id);
    const venture = vRes.rows?.[0];
    if (!venture) {
      return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    }
    if (venture.status === "active") {
      return NextResponse.json({ success: false, error: "Venture is already active" }, { status: 400 });
    }

    await activateVenture(id);

    // Log the approval
    try {
      await logVentureActivity({
        venture_id: id,
        action: "VENTURE_APPROVED",
        actor_cid: "sa",
        actor_name: "Super Admin",
        details: { message: "Venture approved by super admin" },
      });
    } catch {}

    // Email every founder recorded for this venture with a password-setup link
    let emailed = 0;
    const emailErrors = [];
    try {
      const founders = await getFoundersForVentureApproval(id);
      const appBase =
        process.env.NEXT_PUBLIC_APP_URL ||
        (() => {
          try {
            return new URL(req.url).origin;
          } catch {
            return "";
          }
        })();
      for (const f of founders.rows || []) {
        if (!f.email) continue;
        try {
          // Create a password-setup token so the founder can set their password
          // and access their dashboard (reuses the /activate flow).
          let setupUrl = null;
          try {
            const contact = await getContactCidByLowerEmail(f.email);
            if (contact.rows?.[0]?.cid) {
              const token = uuidv4();
              const tokenHash = hashToken(token);
              await createApprovalPasswordSetupToken(token, tokenHash, contact.rows[0].cid, f.email);
              setupUrl = `${appBase}/activate?token=${token}`;
            }
          } catch (e) {
            console.warn("Setup token creation failed for", f.email, ":", e.message);
          }
          const emailResult = await sendVentureApprovalEmail({
            to: f.email,
            name: f.name || "there",
            ventureName: venture.company_name || venture.name || id,
            setupUrl,
          });
          if (emailResult?.success) {
            emailed++;
          } else {
            emailErrors.push({ to: f.email, error: emailResult?.error?.message || emailResult?.error || emailResult?.note || "unknown" });
          }
        } catch (e) {
          emailErrors.push({ to: f.email, error: e.message });
        }
      }
    } catch (e) {
      console.warn("Failed to load founders for approval email:", e.message);
    }

    // Notify super admin feed
    try {
      await createVentureNotification({
        recipient_id: "sa",
        title: `[${id}] Venture approved`,
        message: `${venture.company_name || venture.name} has been approved and is now active.`,
      });
    } catch {}

    return NextResponse.json({ success: true, emailed, email_errors: emailErrors });
  } catch (e) {
    console.error("POST /api/ventures/[id]/approve error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
