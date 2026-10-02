/**
 * User administration — the approval / rejection / pending-review use cases
 * (SERVICE layer).
 *
 * The work behind `POST /api/admin/approve-user`, `POST /api/admin/reject-user`
 * and `GET /api/admin/pending-users`: the existence and status checks, the
 * role-assignment rule (only a Super Admin may name an arbitrary role; anyone
 * else is limited to a non-privileged set, so approval can never mint a Super
 * Admin), the password-setup token (24 h, stored hashed), the setup email, the
 * audit entry and the notification clearing.
 *
 * HTTP-free: it reads and writes through `@/models/adminOps` and sends mail
 * through `@/lib/email`; it answers `{ status, body }`. The controller keeps
 * `initDb`, the capability gate, the base URL and the envelope.
 */

import { v4 as uuidv4 } from "uuid";
import { sendStandaloneEmail } from "@/lib/email";
import { hashToken } from "@/lib/token-hashing";
import {
  approveContact,
  getUserForApproval,
  getUserForRejection,
  insertApprovalAuditLog,
  insertPasswordSetupToken,
  insertRejectionAuditLog,
  listPendingUsers,
  markApprovalUserNotificationsRead,
  markRejectionUserNotificationsRead,
  rejectContact,
} from "@/models/adminOps";

/**
 * The roles a NON-Super-Admin approver may pick. Anything else falls back to the
 * role the user already carries, so this endpoint cannot become a Super Admin
 * mint.
 */
const APPROVABLE_ROLES = [
  "participant",
  "member",
  "applicant",
  "staff",
  "program_manager",
  "founder",
  "investor",
  "facilitator",
];

const notFound = (error) => ({
  status: 404,
  body: { success: false, error },
});

/** The pending users, grouped by their group name for the review screen. */
export async function listPendingUsersGrouped() {
  const result = await listPendingUsers();
  const pendingUsers = result.rows;

  const grouped = {};
  for (const user of pendingUsers) {
    const group = user.group_name || "UNASSIGNED";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(user);
  }

  return {
    status: 200,
    body: { success: true, total: pendingUsers.length, pendingUsers, grouped },
  };
}

/**
 * Approve a pending user, set their role and mail them a password-setup link.
 *
 * @param {{ userCid: string, requestedRole?: string, actor?: object, baseUrl: string }} input
 * @returns {Promise<{status:number, body:object}>}
 */
export async function approveUser({ userCid, requestedRole, actor, baseUrl }) {
  if (!userCid) {
    return {
      status: 400,
      body: { success: false, error: "User CID is required." },
    };
  }

  const userResult = await getUserForApproval(userCid);
  if (userResult.rows.length === 0) return notFound("User not found.");

  const user = userResult.rows[0];

  if (user.status !== "pending") {
    return {
      status: 400,
      body: {
        success: false,
        error: `User status is '${user.status}', not 'pending'.`,
      },
    };
  }

  // The role written at approval is a ROLE decision: only a Super Admin may
  // pick an arbitrary one; anyone else is limited to a non-privileged set.
  const requested =
    typeof requestedRole === "string" ? requestedRole.trim().toLowerCase() : "";
  const nextRole =
    actor?.role === "super_admin"
      ? requested || user.role || "participant"
      : APPROVABLE_ROLES.includes(requested)
        ? requested
        : user.role || "participant";

  await approveContact(nextRole, userCid);

  // Password-setup token, 24 h expiry, stored hashed.
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const tokenHash = hashToken(token);
  await insertPasswordSetupToken(userCid, token, tokenHash, expiresAt);

  // Setup email. The live token is never returned to the caller.
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
    contact_cid: userCid,
  });

  try {
    await insertApprovalAuditLog({
      // The actor is the SESSION, never a name carried in the body.
      adminName: actor?.name || actor?.cid || "system",
      userCid,
      userName: user.name,
      userEmail: user.email,
      expiresAt,
      emailSent: emailResult.success,
    });
  } catch (error) {
    console.error("Audit log error (non-critical):", error.message);
  }

  try {
    await markApprovalUserNotificationsRead(user.name);
  } catch (error) {
    console.error("Notification clear error (non-critical):", error.message);
  }

  return {
    status: 200,
    body: {
      success: true,
      // Honest wording: the approval succeeded, but the setup email only left
      // the system if the transport actually reported success.
      message: emailResult.success
        ? `User '${user.name}' approved successfully. Setup email sent to ${user.email}.`
        : `User '${user.name}' approved successfully, but the setup email could not be sent to ${user.email}.`,
      emailSent: emailResult.success,
    },
  };
}

/**
 * Reject a user — they cannot proceed further.
 *
 * @returns {Promise<{status:number, body:object}>}
 */
export async function rejectUser({ userCid, actor }) {
  if (!userCid) {
    return {
      status: 400,
      body: { success: false, error: "User CID is required." },
    };
  }

  const userResult = await getUserForRejection(userCid);
  if (userResult.rows.length === 0) return notFound("User not found.");

  const user = userResult.rows[0];

  await rejectContact(userCid);

  try {
    await insertRejectionAuditLog({
      // The actor is the SESSION, never a name carried in the body.
      adminName: actor?.name || actor?.cid || "system",
      userCid,
      userName: user.name,
      userEmail: user.email,
    });
  } catch (error) {
    console.error("Audit log error (non-critical):", error.message);
  }

  try {
    await markRejectionUserNotificationsRead(user.name);
  } catch (error) {
    console.error("Notification clear error (non-critical):", error.message);
  }

  return {
    status: 200,
    body: {
      success: true,
      message: `User '${user.name}' has been rejected.`,
    },
  };
}
