import db from "@/lib/db";

// ── POST/GET /api/investor/diligence/documents ──────────────────────────────

/** documents POST — insert a DD document row. */
export async function insertDdDocument({ request_id, file_name, file_size, file_type, file_data, uploaded_by }) {
  return db.execute({
    sql: `INSERT INTO dd_documents (request_id, file_name, file_size, file_type, file_data, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id, file_name, file_size, file_type, uploaded_at`,
    args: [request_id, file_name, file_size, file_type || "application/pdf", file_data, uploaded_by],
  });
}

/** documents POST — auto-advance the request to documents_uploaded. */
export async function markDdRequestDocumentsUploaded({ file_name, request_id }) {
  return db.execute({
    sql: `UPDATE dd_information_requests SET response_file_url = ?, status = 'documents_uploaded', updated_at = NOW()
            WHERE id = ? AND status IN ('pending', 'under_review')`,
    args: [file_name, request_id],
  });
}

/** documents POST — request info (workspace + pipeline) for the timeline entry. */
export async function getDdRequestInfoForDocumentUpload(request_id) {
  return db.execute({
    sql: "SELECT r.workspace_id, r.title, dw.pipeline_id FROM dd_information_requests r JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id WHERE r.id = ?",
    args: [request_id],
  });
}

/** documents POST — relationship workspace id for the timeline entry. */
export async function getRelationshipWorkspaceIdForDocumentUpload(pipeline_id) {
  return db.execute({
    sql: "SELECT id FROM relationship_workspaces WHERE pipeline_id = ?",
    args: [pipeline_id],
  });
}

/** documents POST — 'document_uploaded' timeline event. */
export async function insertDocumentUploadedTimeline({ workspace_id, file_name, title }) {
  return db.execute({
    sql: "INSERT INTO relationship_timeline (workspace_id, event_type, description) VALUES (?, 'document_uploaded', ?)",
    args: [workspace_id, `Document "${file_name}" uploaded for "${title}"`],
  });
}

/** documents GET (download) — fetch a single document by id. */
export async function getDdDocumentById(docId) {
  return db.execute({
    sql: "SELECT * FROM dd_documents WHERE id = ?",
    args: [docId],
  });
}

/** documents GET (download) — 'document_downloaded' timeline event (insert-select). */
export async function insertDocumentDownloadedTimeline({ file_name, actor, doc_id }) {
  return db.execute({
    sql: `INSERT INTO relationship_timeline (workspace_id, event_type, description)
                SELECT rw.id, 'document_downloaded', ? FROM dd_documents d
                JOIN dd_information_requests r ON d.request_id = r.id
                JOIN due_diligence_workspaces dw ON r.workspace_id = dw.id
                LEFT JOIN relationship_workspaces rw ON rw.pipeline_id = dw.pipeline_id
                WHERE d.id = ? AND rw.id IS NOT NULL`,
    args: [`"${file_name}" downloaded by ${actor || "user"}`, doc_id],
  });
}

/** documents GET — list documents of a request, newest first. */
export async function listDdDocumentsByRequestId(requestId) {
  return db.execute({
    sql: "SELECT id, request_id, file_name, file_size, file_type, uploaded_by, uploaded_at FROM dd_documents WHERE request_id = ? ORDER BY uploaded_at DESC",
    args: [requestId],
  });
}
