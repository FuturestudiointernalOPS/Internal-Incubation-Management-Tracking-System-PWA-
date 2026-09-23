import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sendStandaloneEmail } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  approveContact,
  getUserForApproval,
  insertApprovalAuditLog,
  insertPasswordSetupToken,
  markApprovalUserNotificationsRead,
} from "@/models/adminOps";

/**
 * APPROVE USER ENDPOINT
 * POST /api/admin/approve-user
 *
 * Body: { user_cid }
 *
 * Flow:
 * 1. Verify user exists and is pending
 * 2. Change status to 'approved'
 * 3. Generate password setup token (24h expiry)
 * 4. Send email with setup link
 * 5. Log to audit_log
 * 6. Clear related notifications
 */
export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;
    const session = await getSession();
    const { user_cid, role } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "User CID is required." },
        { status: 400 },
      );
    }

    // 1. Find the user
    const userResult = await getUserForApproval(user_cid);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }

    const user = userResult.rows[0];

    // Verify user is pending
    if (user.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          error: `User status is '${user.status}', not 'pending'.`,
        },
        { status: 400 },
      );
    }

    // The role written at approval is a ROLE decision: only a Super Admin may
    // pick an arbitrary one; anyone else is limited to a non-privileged set, so
    // this endpoint cannot become a Super Admin mint.
    const APPROVABLE_ROLES = ["participant", "member", "applicant", "staff", "program_manager", "founder", "investor", "facilitator"];
    const requestedRole = typeof role === "string" ? role.trim().toLowerCase() : "";
    const nextRole =
      session?.role === "super_admin"
        ? requestedRole || user.role || "participant"
        : APPROVABLE_ROLES.includes(requestedRole)
          ? requestedRole
          : user.role || "participant";

    // 2. Change status to 'approved' and set role
    await approveContact(nextRole, user_cid);

    // 3. Generate password setup token (24h expiry)
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const tokenHash = hashToken(token);
    await insertPasswordSetupToken(user_cid, token, tokenHash, expiresAt);

    // 4. Send email with setup link
    const protocol = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "impactos.futurestudio.com";
    const baseUrl = `${protocol}://${host}`;
    const setupUrl = `${baseUrl}/setup-password/${token}`;

    const emailBody = `
      <div style="font-family: system-ui, sans-serif; max-width: 520px; margin: 0 auto;">
        <div style="text-align: center; padding: 32px 0;">
          <img src="${baseUrl}/brand/logo_full.png" alt="Future Studio" style="height: 48px;" />
        </div>

        <h1 style="font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 8px;">
          Your Account Has Been Approved
        </h1>

        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Hello <strong>${user.name}</strong>,
        </p>

        <p style="color: #475569; font-size: 15px; line-height: 1.6;">
          Your account has been approved by the administration. To activate your account and set up your password, please click the button below:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${setupUrl}"
             style="display: inline-block; background: #f97316; color: #000; font-weight: 800;
                    font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;
                    padding: 16px 40px; border-radius: 12px; text-decoration: none;">
            Set Your Password
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
          This link will expire in <strong>24 hours</strong> and can only be used once.
          If you did not request this, please ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0;" />

        <p style="color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: bold;">
          Future Studio · ImpactOS
        </p>
      </div>
    `;

    const emailResult = await sendStandaloneEmail({
      to: user.email,
      subject: "Set Your Password — Future Studio Account Approved",
      body: emailBody,
      isHtml: true,
      fromName: "Future Studio Admin",
      email_type: "approval_setup",
      contact_cid: user_cid,
    });

    // 5. Log to audit_log
    try {
      await insertApprovalAuditLog({
        // The actor is the SESSION, never a name carried in the body.
        adminName: session?.name || session?.cid || "system",
        userCid: user_cid,
        userName: user.name,
        userEmail: user.email,
        expiresAt,
        emailSent: emailResult.success,
      });
    } catch (error) {
      console.error("Audit log error (non-critical):", error.message);
    }

    // 6. Clear related notifications
    try {
      await markApprovalUserNotificationsRead(user.name);
    } catch (error) {
      console.error("Notification clear error (non-critical):", error.message);
    }

    return NextResponse.json({
      success: true,
      // Honest wording: the approval succeeded, but the setup email only left
      // the system if the transport actually reported success.
      message: emailResult.success
        ? `User '${user.name}' approved successfully. Setup email sent to ${user.email}.`
        : `User '${user.name}' approved successfully, but the setup email could not be sent to ${user.email}.`,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve user." },
      { status: 500 },
    );
  }
}
