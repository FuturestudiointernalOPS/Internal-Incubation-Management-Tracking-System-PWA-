import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { listAssignments, createAssignment, removeAssignment } from "@/lib/venturePermissions";

// Phase 1: assignment management is Super Admin territory. Phase 3 will
// extend this guard to Lead Managers whose matrix grants the assign action.
const ROLES = ["super_admin", "developer", "admin"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const includeRemoved = new URL(req.url).searchParams.get("include_removed") === "1";
    const assignments = await listAssignments(db, id, { includeRemoved });
    return NextResponse.json({ success: true, assignments });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const session = await getSession();
    const { id } = await params;
    const { staff_contact_id, responsibility_code, scope_type, scope_ref_type, scope_ref_id, notes } = await req.json();

    if (!staff_contact_id || !responsibility_code) {
      return NextResponse.json({ success: false, error: "staff_contact_id and responsibility_code are required." }, { status: 400 });
    }

    const venture = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE venture_id = ?", args: [id] });
    if (!venture.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Venture not found." }, { status: 404 });
    }
    const contact = await db.execute({ sql: "SELECT cid FROM contacts WHERE cid = ? AND deleted = 0", args: [staff_contact_id] });
    if (!contact.rows?.[0]) {
      return NextResponse.json({ success: false, error: "Staff contact not found." }, { status: 404 });
    }

    const scopeType = scope_type || "venture_wide";
    // Prevent exact duplicate rows (same person, responsibility and scope).
    const dup = await db.execute({
      sql: `SELECT 1 FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ? AND responsibility_code = ?
              AND scope_type = ? AND COALESCE(scope_ref_id,'') = COALESCE(?, '') AND status = 'active'`,
      args: [id, staff_contact_id, responsibility_code, scopeType, scope_ref_id || ""],
    });
    if (dup.rows?.length) {
      return NextResponse.json({ success: false, error: "This staff member already has this assignment." }, { status: 409 });
    }

    const result = await createAssignment(db, {
      ventureId: id,
      staffContactId: staff_contact_id,
      responsibilityCode: responsibility_code,
      scopeType,
      scopeRefType: scope_ref_type || null,
      scopeRefId: scope_ref_id || null,
      assignedBy: session?.cid || null,
      notes: notes || null,
    });
    if (result.error) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    const assignments = await listAssignments(db, id);
    return NextResponse.json({ success: true, assignments });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { assignment_id, action } = await req.json();
    if (!assignment_id || action !== "remove") {
      return NextResponse.json({ success: false, error: "assignment_id and action='remove' are required." }, { status: 400 });
    }
    await removeAssignment(db, { id: assignment_id });
    const assignments = await listAssignments(db, id);
    return NextResponse.json({ success: true, assignments });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
