import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/mailer";

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
    const { user_cid, admin_name } = await req.json();

    if (!user_cid) {
      return NextResponse.json(
        { success: false, error: "User CID is required." },
        { status: 400 }
      );
    }

    // 1. Find the user
    const userResult = await db.execute({
      sql: "SELECT * FROM contacts WHERE cid = ? AND deleted = 0 LIMIT 1",
      args: [user_cid],
    });

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Verify user is pending
    if (user.status !== "pending") {
      return NextResponse.json(
        { success: false, error: `User status is '${user.status}', not 'pending'.` },
        { status: 400 }
      );
    }

    // 2. Change status to 'approved'
    await db.execute({
      sql: "UPDATE contacts SET status = 'approved' WHERE cid = ?",
      args: [user_cid],
    });

    // 3. Generate password setup token (24h expiry)
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db.execute({
      sql: `INSERT INTO password_setup_tokens (user_cid, user_email, token, expires_at, used)
            VALUES (?, ?, ?, ?, false)`,
      args: [
        user_cid,
        user.email,
        token,
        expiresAt.toISOString().replace("T", " ").replace("Z", ""),
      ],
    });

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

    const emailResult = await sendEmail({
      to: user.email,
      subject: "Set Your Password — Future Studio Account Approved",
      body: emailBody,
      isHtml: true,
      fromName: "Future Studio Admin",
    });

    // 5. Log to audit_log
    try {
      await db.execute({
        sql: `INSERT INTO audit_log (entity_type, entity_id, user_id, user_name, action, details, metadata)
              VALUES ('user', 0, ?, ?, 'approved', ?, ?)`,
        args: [
          admin_name || "super_admin",
          user_cid,
          `User '${user.name}' (${user.email}) approved. Setup email sent.`,
          JSON.stringify({
            user_name: user.name,
            user_email: user.email,
            token_expires: expiresAt.toISOString(),
            email_sent: emailResult.success,
          }),
        ],
      });
    } catch (e) {
      console.error("Audit log error (non-critical):", e.message);
    }

    // 6. Clear related notifications
    try {
      await db.execute({
        sql: `UPDATE v2_notifications
              SET is_read = 1
              WHERE recipient_id = 'sa'
              AND message ILIKE ?
              AND is_read = 0`,
        args: [`%${user.name}%`],
      });
    } catch (e) {
      console.error("Notification clear error (non-critical):", e.message);
    }

    return NextResponse.json({
      success: true,
      message: `User '${user.name}' approved successfully. Setup email sent to ${user.email}.`,
      emailSent: emailResult.success,
      emailMocked: emailResult.mock,
      setupUrl,
    });
  } catch (error) {
    console.error("User approval error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to approve user." },
      { status: 500 }
    );
  }
}
