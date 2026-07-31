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

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await db.execute({ sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?", args: [docId, dbId] });
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const r = await db.execute({ sql: "SELECT * FROM venture_document_permissions WHERE document_id = ?", args: [docId] });
    return NextResponse.json({ success: true, permissions: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await db.execute({ sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?", args: [docId, dbId] });
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    // Only founders (or privileged staff roles) may edit permissions.
    if (!PRIVILEGED.includes(session.role)) {
      const founder = await db.execute({ sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1", args: [dbId, session.cid] });
      if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can manage document permissions." }, { status: 403 });
    }

    const { role_scope, access_level } = await req.json();
    if (!role_scope || !access_level) return NextResponse.json({ success: false, error: "role_scope and access_level required" }, { status: 400 });
    if (!["none", "view", "edit"].includes(access_level)) return NextResponse.json({ success: false, error: "access_level must be none, view, or edit" }, { status: 400 });

    if (access_level === "none") {
      // Remove permission row entirely
      await db.execute({ sql: "DELETE FROM venture_document_permissions WHERE document_id = ? AND role_scope = ?", args: [docId, role_scope] });
    } else {
      await db.execute({
        sql: `INSERT INTO venture_document_permissions (document_id, role_scope, access_level) VALUES (?, ?, ?)
              ON CONFLICT (document_id, role_scope) DO UPDATE SET access_level = EXCLUDED.access_level`,
        args: [docId, role_scope, access_level],
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
