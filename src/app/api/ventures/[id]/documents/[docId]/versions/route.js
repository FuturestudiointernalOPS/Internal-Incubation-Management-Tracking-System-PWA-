import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];

export async function GET(req, { params }) {
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

    const r = await db.execute({ sql: "SELECT * FROM venture_document_versions WHERE document_id = ? ORDER BY version_number DESC", args: [docId] });
    return NextResponse.json({ success: true, versions: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
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

    const { storage_path, file_url, version_notes } = await req.json();
    if (!file_url) return NextResponse.json({ success: false, error: "file_url required" }, { status: 400 });

    const maxRes = await db.execute({ sql: "SELECT COALESCE(MAX(version_number), 0) as max_version FROM venture_document_versions WHERE document_id = ?", args: [docId] });
    const nextVersion = parseInt(maxRes.rows?.[0]?.max_version || 0) + 1;

    await db.execute({
      sql: "INSERT INTO venture_document_versions (document_id, version_number, storage_path, file_url, version_notes, uploaded_by) VALUES (?,?,?,?,?,?)",
      args: [docId, nextVersion, storage_path || file_url, file_url, version_notes || null, session.cid],
    });
    // Archive current file pointer into version history, then point the parent at the new upload.
    await db.execute({
      sql: "UPDATE venture_documents SET storage_path = ?, file_url = ?, updated_at = NOW() WHERE id = ?",
      args: [storage_path || file_url, file_url, docId],
    });

    return NextResponse.json({ success: true, version_number: nextVersion });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
