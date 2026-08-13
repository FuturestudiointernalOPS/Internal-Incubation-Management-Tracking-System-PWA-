import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { sendInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const body = await req.json();
    const { email, name, role, group_id, action } = body;

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

    // NEW INVITE
    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required for new invitations" }, { status: 400 });
    }

    let contactCid;
    const existingContact = await db.execute({
      sql: "SELECT cid, name FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
      args: [cleanEmail],
    });

    if (existingContact.rows.length > 0) {
      contactCid = existingContact.rows[0].cid;
      await db.execute({ sql: "UPDATE contacts SET name = ?, group_name = COALESCE(?, group_name) WHERE cid = ?", args: [name, group_id || null, contactCid] });
    } else {
      contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
      await db.execute({ sql: "INSERT INTO contacts (cid, name, email, role, status, group_name) VALUES (?, ?, ?, ?, 'pending', ?)", args: [contactCid, name, cleanEmail, role || "participant", group_id || null] });
    }

    await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contactCid] });

    const token = uuidv4();
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, contact_cid, expires_at, token_type) VALUES (?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
      args: [token, contactCid],
    });

    const contactName = name || existingContact.rows[0]?.name || cleanEmail.split("@")[0];
    await sendInviteEmail({ to: cleanEmail, name: contactName, role: role || "participant", token });

    return NextResponse.json({
      success: true,
      message: "Invitation sent",
      cid: contactCid,
      email: cleanEmail,
      token,
      action: existingContact.rows.length > 0 ? "reused_contact" : "new_contact",
    });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
