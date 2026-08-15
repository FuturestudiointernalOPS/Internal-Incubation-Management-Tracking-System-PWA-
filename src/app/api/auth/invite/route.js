import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail, sendLoginEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager", "staff"]);
    if (authError) return authError;

    const body = await req.json();
    const { email, name, role, group_id, action, program_id, program_name } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

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
      await db.execute({
        sql: "INSERT INTO password_setup_tokens (token, contact_cid, expires_at, token_type) VALUES (?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
        args: [token, contact.cid],
      });
      await sendInviteEmail({ to: contact.email, name: contact.name || contact.email.split("@")[0], role: contact.role || "participant", token });
      return NextResponse.json({ success: true, message: "Invitation resent", email: contact.email, token, action: "resent" });
    }

    // NEW INVITE — name is optional (email alone is sufficient).
    // An existing contact is reused, never duplicated.
    const displayName = (name || "").trim() || cleanEmail.split("@")[0];

    let contactCid;
    const existingContact = await db.execute({
      sql: "SELECT cid, name, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
      args: [cleanEmail],
    });

    const accountActivated = !!(existingContact.rows[0] && String(existingContact.rows[0].password || "").trim());

    if (existingContact.rows.length > 0) {
      contactCid = existingContact.rows[0].cid;
      // Never blank an existing name when the inviter did not provide one.
      if ((name || "").trim()) {
        await db.execute({
          sql: "UPDATE contacts SET name = ?, group_name = COALESCE(?, group_name) WHERE cid = ?",
          args: [name.trim(), group_id || null, contactCid],
        });
      } else if (group_id) {
        await db.execute({
          sql: "UPDATE contacts SET group_name = COALESCE(?, group_name) WHERE cid = ?",
          args: [group_id, contactCid],
        });
      }
    } else {
      contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
      await db.execute({
        sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'pending', ?)",
        args: [contactCid, displayName, cleanEmail, role || "participant", group_id || null],
      });
    }

    await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contactCid] });

    const token = uuidv4();
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, contact_cid, expires_at, token_type) VALUES (?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
      args: [token, contactCid],
    });

    // CRM history: invitation sent (context = the program, when provided).
    try {
      await db.execute({
        sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
              VALUES (?, 'invitation_sent', ?, 'programs', ?, 'system', '{}'::jsonb)`,
        args: [
          contactCid,
          program_name ? `Invited to facilitate ${program_name}` : "Invitation sent",
          program_id ? String(program_id) : null,
        ],
      });
    } catch (_) {}

    // Existing activated account → login email (no new password setup).
    // New / not-yet-activated account → activation/setup email.
    if (accountActivated) {
      await sendLoginEmail({ to: cleanEmail, name: displayName, role: role || "participant", programName: program_name });
    } else {
      await sendInviteEmail({ to: cleanEmail, name: displayName, role: role || "participant", token, programName: program_name });
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
