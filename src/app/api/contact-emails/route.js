import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { findContactByCid } from "@/models/workspace";
import { isContactWithinStaffedPrograms } from "@/models/authorization/scope";
import { serverError } from "@/lib/apiError";

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
 * Privileged roles (staff/super_admin/program_manager) may manage another
 * contact's emails ONLY within a shared programme (see canManageContact);
 * everyone else manages only their own identity.
 */

const PRIVILEGED = ["super_admin", "staff", "program_manager"];

/**
 * AUTHZ-CRM-1 — who may touch this contact's alternative emails?
 *
 *   - yourself                    → yes
 *   - Super Admin                 → yes (unscoped authority)
 *   - staff / program_manager     → only a contact who shares a PROGRAMME they
 *                                   are staffed on (a contact→programme rule)
 *   - anyone else                 → no
 *
 * This replaced a bare role check that let any staff-side caller manage EVERY
 * contact in the database.
 */
async function canManageContact(session, targetCid) {
  if (!targetCid) return false;
  if (String(targetCid) === String(session?.cid)) return true;
  if (session?.role === "super_admin") return true;
  if (!PRIVILEGED.includes(session?.role)) return false;
  return isContactWithinStaffedPrograms(targetCid, session.cid, { email: session.email });
}

async function denyIfNotAllowed(session, targetCid) {
  if (await canManageContact(session, targetCid)) return null;
  return NextResponse.json(
    { success: false, error: "errors.insufficientPermissions" },
    { status: 403 },
  );
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const requestedCid = searchParams.get("cid");
    const targetCid = requestedCid || session?.cid;
    if (!targetCid)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    const denied = await denyIfNotAllowed(session, targetCid);
    if (denied) return denied;

    const { listContactEmails } = await import("@/lib/contactIdentity");
    const emails = await listContactEmails(targetCid);
    return NextResponse.json({ success: true, contact_cid: targetCid, emails });
  } catch (error) {
    return serverError(error, { log: "GET /api/contact-emails" });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();

    const body = await req.json();
    const { email, cid: requestedCid } = body || {};
    const targetCid = requestedCid || session?.cid;
    if (!targetCid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    if (!email) return NextResponse.json({ success: false, error: "email is required." }, { status: 400 });
    const denied = await denyIfNotAllowed(session, targetCid);
    if (denied) return denied;

    // Target contact must exist.
    const contact = await findContactByCid(targetCid);
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
    return serverError(error, { log: "POST /api/contact-emails" });
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
    const targetCid = requestedCid || session?.cid;
    if (!id) return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });
    if (!targetCid) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const denied = await denyIfNotAllowed(session, targetCid);
    if (denied) return denied;

    const { removeContactEmail } = await import("@/lib/contactIdentity");
    const result = await removeContactEmail({ id: parseInt(id), contactCid: targetCid });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError(error, { log: "DELETE /api/contact-emails" });
  }
}
