import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer","investor"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (session.role === "investor") return NextResponse.json({ success: true, documents: [] });

    const { searchParams } = new URL(req.url);
    let sql = "SELECT * FROM venture_documents WHERE venture_id = ? AND is_deleted = false";
    const args = [id];
    if (searchParams.get("category")) { sql += " AND category = ?"; args.push(searchParams.get("category")); }
    sql += " ORDER BY created_at DESC";
    const r = await db.execute({ sql, args });
    return NextResponse.json({ success: true, documents: r.rows || [] });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { category, folder, name, storage_path, file_url, mime_type, size_bytes } = await req.json();
    if (!name || !file_url) return NextResponse.json({ success: false, error: "name and file_url required" }, { status: 400 });
    await db.execute({ sql: "INSERT INTO venture_documents (venture_id, category, folder, name, storage_path, file_url, mime_type, size_bytes, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)", args: [id, category||"general", folder||null, name, storage_path || file_url, file_url, mime_type||null, size_bytes||null, session.cid] });
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function PATCH(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const { document_id, name, category, approval_status, action } = await req.json();
    if (action === "delete") {
      await db.execute({ sql: "UPDATE venture_documents SET is_deleted = true WHERE id = ? AND venture_id = ?", args: [document_id, id] });
    } else {
      const updates = []; const args = [];
      if (name !== undefined) { updates.push("name = ?"); args.push(name); }
      if (category !== undefined) { updates.push("category = ?"); args.push(category); }
      if (approval_status !== undefined) { updates.push("approval_status = ?"); args.push(approval_status); }
      if (!updates.length) return NextResponse.json({ success: false, error: "No fields" }, { status: 400 });
      args.push(document_id, id);
      await db.execute({ sql: `UPDATE venture_documents SET ${updates.join(", ")} WHERE id = ? AND venture_id = ?`, args });
    }
    return NextResponse.json({ success: true });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
