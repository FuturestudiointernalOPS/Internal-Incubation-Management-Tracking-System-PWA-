import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
const PRIVILEGED = ["staff", "program_manager", "super_admin", "developer"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

// venture_members stores venture_id as the VNT code (TEXT) — resolve the code from a UUID if needed
async function resolveVentureCode(idOrCode) {
  if (!idOrCode || (typeof idOrCode === "string" && !idOrCode.startsWith("VNT-") && idOrCode.includes("-"))) {
    try {
      const r = await db.execute({ sql: "SELECT venture_id FROM ventures WHERE id = ?", args: [idOrCode] });
      return r.rows?.[0]?.venture_id || idOrCode;
    } catch { return idOrCode; }
  }
  return idOrCode;
}
const STATUSES = ["private", "pending_review", "approved", "shared_with_investor"];

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = (await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id=?", args: [id] })).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await db.execute({ sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?", args: [docId, dbId] });
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Founders/privileged only — not advisors, not team members.
    if (!PRIVILEGED.includes(session.role)) {
      const code = await resolveVentureCode(dbId);
      const founder = await db.execute({ sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1", args: [code, session.cid] });
      if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can transition document status." }, { status: 403 });
    }

    const { approval_status } = await req.json();
    if (!STATUSES.includes(approval_status)) {
      return NextResponse.json({ success: false, error: `approval_status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
    }

    await db.execute({ sql: "UPDATE venture_documents SET approval_status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [approval_status, docId, dbId] });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
