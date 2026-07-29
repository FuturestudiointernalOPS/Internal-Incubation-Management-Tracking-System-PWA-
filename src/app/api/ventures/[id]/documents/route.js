import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  listDocuments, getDocument, uploadDocument, updateDocument, deleteDocument,
  createShareLink, revokeShare, getAccessLogs, getDocumentShares,
  notifyVentureFounders,
} from "@/lib/ventures";

const ROLES = ["participant","staff","program_manager","super_admin","teacher","developer"];
const ALLOWED = ["participant","staff","program_manager","super_admin","teacher"];
const PRIVILEGED = ["staff","program_manager","super_admin","developer"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

// Returns which approval_statuses a user is allowed to see
async function getVisibilityStatuses(dbId, session) {
  // Super admins, staff, program managers, developers see everything
  if (PRIVILEGED.includes(session.role)) return null;
  // Founders see everything
  if (session.cid) {
    const founder = await db.execute({ sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1", args: [dbId, session.cid] });
    if (founder.rows?.length) return null;
  }
  // Investors only see shared documents
  if (session.role === "investor") return ["shared_with_investor"];
  // Advisors and team members see non-private documents
  return ["pending_review", "approved", "shared_with_investor"];
}

export async function GET(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ROLES); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const s = new URL(req.url).searchParams;
    const type = s.get("type") || "list";
    const visibility = await getVisibilityStatuses(dbId, session);
    if (type === "list") {
      const docs = await listDocuments(dbId, {
        category: s.get("category"), isPitchDeck: s.get("pitch_deck") === "true" ? true : s.get("pitch_deck") === "false" ? false : undefined,
        search: s.get("search"), visibility,
      });
      return NextResponse.json({ success: true, documents: docs });
    }
    if (type === "detail" && s.get("document_id")) {
      const doc = await getDocument(s.get("document_id"));
      if (!doc) return NextResponse.json({ success: false, error: "Document not found." }, { status: 404 });
      // Block access to private docs for non-privileged users
      if (visibility !== null && !visibility.includes(doc.approval_status)) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
      return NextResponse.json({ success: true, document: doc });
    }
    if (type === "shares" && s.get("document_id")) {
      const shares = await getDocumentShares(s.get("document_id"));
      return NextResponse.json({ success: true, shares });
    }
    if (type === "access_logs" && s.get("document_id")) {
      const logs = await getAccessLogs(s.get("document_id"));
      return NextResponse.json({ success: true, logs });
    }
    return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const body = await req.json();
    if (body.action === "upload") {
      const result = await uploadDocument({
        ventureId: dbId, title: body.title, description: body.description,
        documentType: body.document_type, category: body.category,
        fileName: body.file_name, fileSize: body.file_size, fileType: body.file_type,
        fileUrl: body.file_url, thumbnailUrl: body.thumbnail_url,
        isPitchDeck: body.is_pitch_deck, uploadedBy: session.cid,
      });
      notifyVentureFounders(dbId, 'Document Uploaded', `${body.title} has been uploaded to the document vault.`);
      return NextResponse.json({ success: true, document_id: result.id });
    }
    if (body.action === "update") {
      await updateDocument(body.document_id, { ...body.updates, uploaded_by: session.cid });
      return NextResponse.json({ success: true });
    }
    if (body.action === "transition") {
      // Check: only founders/privileged can transition
      if (!PRIVILEGED.includes(session.role)) {
        const founder = await db.execute({ sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND contact_id = ? AND member_type = 'founder' AND removed_at IS NULL LIMIT 1", args: [dbId, session.cid] });
        if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can transition document status." }, { status: 403 });
      }
      const STATUSES = ["private", "pending_review", "approved", "shared_with_investor"];
      if (!STATUSES.includes(body.approval_status)) {
        return NextResponse.json({ success: false, error: `approval_status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
      }
      await db.execute({ sql: "UPDATE venture_documents SET approval_status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [body.approval_status, body.document_id, dbId] });
      const labels = { approved: 'approved', shared_with_investor: 'shared with investors', pending_review: 'sent for review', private: 'marked private' };
      notifyVentureFounders(dbId, 'Document Status Updated', `A document has been ${labels[body.approval_status] || body.approval_status}.`);
      return NextResponse.json({ success: true });
    }
    if (body.action === "delete") {
      await deleteDocument(body.document_id);
      return NextResponse.json({ success: true });
    }
    if (body.action === "share") {
      const result = await createShareLink({
        documentId: body.document_id, ventureId: dbId,
        sharedWithEmail: body.email, sharedWithName: body.name,
        accessType: body.access_type || "read", expiresInHours: body.expires_in_hours,
        maxDownloads: body.max_downloads, createdBy: session.cid,
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "revoke_share") {
      await revokeShare(body.share_id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch(e) { return NextResponse.json({ success: false, error: e.message }, { status: 500 }); }
}
