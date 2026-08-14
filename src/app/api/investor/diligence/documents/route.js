import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const body = await req.json();
    const { request_id, file_name, file_type, file_data } = body;

    if (!request_id || !file_name || !file_data) {
      return NextResponse.json({ success: false, error: "request_id, file_name, file_data required" }, { status: 400 });
    }

    const fileSize = Math.round((file_data.length * 3) / 4);
    const result = await db.execute({
      sql: `INSERT INTO dd_documents (request_id, file_name, file_size, file_type, file_data, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id, file_name, file_size, file_type, uploaded_at`,
      args: [request_id, file_name, fileSize, file_type || "application/pdf", file_data, session?.cid || session?.id],
    });

    // Auto-advance status to documents_uploaded
    await db.execute({
      sql: `UPDATE dd_information_requests SET response_file_url = ?, status = 'documents_uploaded', updated_at = NOW()
            WHERE id = ? AND status IN ('pending', 'under_review')`,
      args: [file_name, request_id],
    });

    // Timeline
    try {
      const reqInfo = await db.execute({
        sql: `SELECT r.workspace_id, r.title, dw.pipeline_id FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id WHERE r.id = ?`,
        args: [request_id],
      });
      if (reqInfo.rows.length > 0) {
        const relWs = await db.execute({ sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?", args: [reqInfo.rows[0].pipeline_id] });
        if (relWs.rows.length > 0) {
          await db.execute({ sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description) VALUES (?, 'document_uploaded', ?)`, args: [relWs.rows[0].id, `Document "${file_name}" uploaded for "${reqInfo.rows[0].title}"`] });
        }
      }
    } catch (_) {}

    return NextResponse.json({ success: true, document: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("request_id");
    const docId = searchParams.get("id");
    const download = searchParams.get("download");

    if (download && docId) {
      const result = await db.execute({ sql: "SELECT * FROM dd_documents WHERE id = ?", args: [docId] });
      if (result.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const session = await getSession();
      try {
        await db.execute({
          sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                SELECT rw.id, 'document_downloaded', ? FROM dd_documents d
                JOIN dd_information_requests r ON d.request_id = r.id
                JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id
                LEFT JOIN relationship_workspaces rw ON rw.pipeline_id = dw.pipeline_id
                WHERE d.id = ? AND rw.id IS NOT NULL`,
          args: [`"${result.rows[0].file_name}" downloaded by ${session?.cid || "user"}`, docId],
        });
      } catch (_) {}
      return NextResponse.json({ success: true, document: result.rows[0] });
    }

    if (!requestId) return NextResponse.json({ success: false, error: "request_id required" }, { status: 400 });

    const result = await db.execute({
      sql: "SELECT id, request_id, file_name, file_size, file_type, uploaded_by, uploaded_at FROM dd_documents WHERE request_id = ? ORDER BY uploaded_at DESC",
      args: [requestId],
    });
    return NextResponse.json({ success: true, documents: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
