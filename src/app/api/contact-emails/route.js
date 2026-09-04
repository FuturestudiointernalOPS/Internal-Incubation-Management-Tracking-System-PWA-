import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * /api/contact-emails — Alternative email management (Phase 2)
 *
 * Alternative emails live on the existing Contact (person) identity and
 * participate in CRM/venture identity reconciliation. They never become the
 * login credential automatically.
 *
 * GET    /api/contact-emails?cid=          list emails (own, or ?cid= for privileged)
 * POST   /api/contact-emails               { email, cid? } add an alternative email
 * DELETE /api/contact-emails?id=&cid=      remove an alternative email
 *
 * Privileged roles (staff/super_admin/program_manager/developer) may manage
 * any contact via cid; everyone else manages only their own identity.
 */

const PRIVILEGED = ["super_admin", "staff", "program_manager", "developer", "admin"];

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const requestedCid = searchParams.get("cid");
    const isPrivileged = PRIVILEGED.includes(session?.role);
    if (requestedCid && !isPrivileged) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }
    const cid = requestedCid || session?.cid;
    if (!cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { listContactEmails } = await import("@/lib/contactIdentity");
    const emails = await listContactEmails(cid);
    return NextResponse.json({ success: true, contact_cid: cid, emails });
  } catch (error) {
    console.error("GET /api/contact-emails error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();

    const body = await req.json();
    const { email, cid } = body || {};
    const isPrivileged = PRIVILEGED.includes(session?.role);
    if (cid && !isPrivileged) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }
    const targetCid = cid || session?.cid;
    if (!targetCid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    if (!email) return NextResponse.json({ success: false, error: "email is required." }, { status: 400 });

    // Target contact must exist.
    const contact = await db.execute({ sql: "SELECT cid FROM contacts WHERE cid = ?", args: [targetCid] });
    if (contact.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Contact not found." }, { status: 404 });
    }

    const { addContactEmail } = await import("@/lib/contactIdentity");
    const result = await addContactEmail({ contactCid: targetCid, email, actorCid: session?.cid || null });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ success: true, id: result.id || null, exists: result.exists || null });
  } catch (error) {
    console.error("POST /api/contact-emails error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const requestedCid = searchParams.get("cid");
    const isPrivileged = PRIVILEGED.includes(session?.role);
    if (requestedCid && !isPrivileged) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 403 });
    }
    const cid = requestedCid || session?.cid;
    if (!id) return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
    if (!cid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const { removeContactEmail } = await import("@/lib/contactIdentity");
    const result = await removeContactEmail({ id: parseInt(id), contactCid: cid });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/contact-emails error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
