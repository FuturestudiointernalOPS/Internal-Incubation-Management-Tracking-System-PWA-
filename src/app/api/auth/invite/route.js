import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { normalizeGroupName, INTERNAL_GROUP } from "@/lib/authorization/membership";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail, sendLoginEmail, recordEmailSent } from "@/lib/email";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { addContactToGroup } from "@/lib/contact-groups";
import { isValidEmail, normalizeEmail } from "@/lib/email-utils";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await initDb();
    await ensureTokenHashColumns();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    // Rate limit: 20 invite/resend requests per IP per 10 minutes
    const ipLimited = enforceRateLimit(req, `invite:ip:${getClientIp(req)}`, {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (ipLimited) return ipLimited;

    const session = await getSession();
    const actor = session?.cid || "system";

    const body = await req.json();
    const { email, name, role, group_id, action, program_id, program_name } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // Protected group boundary: inviting someone INTO FUTURE STUDIO is an
    // organizational-membership action — staff/PM invite powers must not
    // grant it (only org_membership.manage).
    if (group_id && normalizeGroupName(group_id) === INTERNAL_GROUP) {
      const protectError = await requireAuthorization("org_membership", "manage");
      if (protectError) return protectError;
    }

    const cleanEmail = normalizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 },
      );
    }

    // Rate limit: max 5 invites/resends per recipient email per hour
    const emailLimited = enforceRateLimit(req, `invite:email:${cleanEmail}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (emailLimited) return emailLimited;

    // RESEND
    if (action === "resend") {
      const existingContact = await db.execute({
        sql: "SELECT cid, name, email FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
        args: [cleanEmail],
      });
      if (existingContact.rows.length === 0) {
        return NextResponse.json({ success: false, error: "No contact found. Send a new invite instead." }, { status: 404 });
      }
      const contact = existingContact.rows[0];
      await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contact.cid] });
      const token = uuidv4();
      const tokenHash = hashToken(token);
      await db.execute({
        sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
        args: [token, tokenHash, contact.cid],
      });
      const sendResult = await sendInviteEmail({ to: contact.email, name: contact.name || "", role: contact.role || "participant", token });
      if (sendResult?.success) {
        await recordEmailSent({ contact_cid: contact.cid, email_type: "activation", provider: "resend", to: contact.email, note: "Manual activation email resent" });
      }
      try {
        await db.execute({
          sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, actor_id, metadata)
                VALUES (?, 'invitation_resent', 'Invitation resent', 'contacts', ?, '{}'::jsonb)`,
          args: [contact.cid, actor],
        });
      } catch (_) {}
      return NextResponse.json({ success: true, message: "Invitation resent", email: contact.email, token, action: "resent" });
    }

    // NEW INVITE — name is optional (email alone is sufficient).
    // An existing contact is reused, never duplicated. The email sender applies
    // a neutral greeting when no real name is available (never the email prefix).
    const displayName = (name || "").trim();

    let contactCid;
    const existingContact = await db.execute({
      sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
      args: [cleanEmail],
    });

    const accountActivated = !!(existingContact.rows[0] && String(existingContact.rows[0].password || "").trim());

    // Group names are normalized to UPPERCASE at write time so case
    // variants can never be re-created.
    const normGroup = group_id ? String(group_id).trim().toUpperCase() : null;

    if (existingContact.rows.length > 0) {
      contactCid = existingContact.rows[0].cid;
      // Never blank an existing name when the inviter did not provide one.
      if ((name || "").trim()) {
        await db.execute({
          sql: "UPDATE contacts SET name = ?, group_name = COALESCE(?, group_name) WHERE cid = ?",
          args: [name.trim(), normGroup, contactCid],
        });
      } else if (group_id) {
        await db.execute({
          sql: "UPDATE contacts SET group_name = COALESCE(?, group_name) WHERE cid = ?",
          args: [normGroup, contactCid],
        });
      }
    } else {
      contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
      await db.execute({
        sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'pending', ?)",
        args: [contactCid, displayName, cleanEmail, role || "member", normGroup],
      });
    }

    // Record proper group membership (invitation source). This is additive and
    // idempotent; if the membership table is unavailable it falls back to the
    // legacy group_name write done above.
    if (group_id) {
      await addContactToGroup({
        contactCid,
        familyId: group_id,
        source: "invitation",
        addedBy: actor,
      });
    }

    await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contactCid] });

    const token = uuidv4();
    const tokenHash = hashToken(token);
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
      args: [token, tokenHash, contactCid],
    });

    // CRM history: invitation sent (context = the program, when provided).
    try {
      await db.execute({
        sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'invitation_sent', ?, 'programs', ?, ?, '{}'::jsonb)`,
        args: [
          contactCid,
          program_name ? `Invited to facilitate ${program_name}` : "Invitation sent",
          program_id ? String(program_id) : null,
          actor,
        ],
      });
    } catch (_) {}

    // Existing activated account → login email (no new password setup).
    // New / not-yet-activated account → activation/setup email.
    if (accountActivated) {
      await sendLoginEmail({ to: cleanEmail, name: displayName, role: role || "participant", programName: program_name });
    } else {
      const sendResult = await sendInviteEmail({ to: cleanEmail, name: displayName, role: role || "participant", token, programName: program_name });
      if (sendResult?.success) {
        await recordEmailSent({ contact_cid: contactCid, email_type: "activation", provider: "resend", to: cleanEmail, note: "Manual activation email sent" });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Invitation sent",
      cid: contactCid,
      email: cleanEmail,
      token,
      action: existingContact.rows.length > 0 ? "reused_contact" : "new_contact",
      account_activated: accountActivated,
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
