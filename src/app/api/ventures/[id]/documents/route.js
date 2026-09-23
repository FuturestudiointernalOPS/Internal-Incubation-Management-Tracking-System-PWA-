import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  listDocuments, getDocument, uploadDocument, updateDocument, deleteDocument,
  createShareLink, revokeShare, getAccessLogs, getDocumentShares,
  notifyVentureFounders,
} from "@/lib/ventures";
import {
  getVentureIdByCode, getVentureCodeById, isFounderForDocumentVisibility,
  isFounderForDocumentStatusTransition, updateDocumentApprovalStatus,
} from "@/models/ventureAssets";
import { ventureOwned, ventureNotFound } from "@/lib/ventureOwnership";

const ROLES = ["participant","founder","staff","program_manager","super_admin"];
const ALLOWED = ["participant","founder","staff","program_manager","super_admin"];
const PRIVILEGED = ["staff","program_manager","super_admin"];

async function resolveVentureDbId(ventureId) {
  const ventureResult = await getVentureIdByCode(ventureId);
  return ventureResult.rows?.[0]?.id || null;
}

// venture_members stores venture_id as the VNT code (TEXT) — resolve the code from a UUID if needed
async function resolveVentureCode(idOrCode) {
  if (!idOrCode || (typeof idOrCode === "string" && !idOrCode.startsWith("VNT-") && idOrCode.includes("-"))) {
    try {
      const ventureResult = await getVentureCodeById(idOrCode);
      return ventureResult.rows?.[0]?.venture_id || idOrCode;
    } catch { return idOrCode; }
  }
  return idOrCode;
}

// Returns which approval_statuses a user is allowed to see
async function getVisibilityStatuses(dbId, session) {
  // Super admins, staff, program managers see everything
  if (PRIVILEGED.includes(session.role)) return null;
  // Founders see everything
  if (session.cid) {
    const code = await resolveVentureCode(dbId);
    const founder = await isFounderForDocumentVisibility(code, session.cid);
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
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
    const searchParams = new URL(req.url).searchParams;
    const type = searchParams.get("type") || "list";
    const visibility = await getVisibilityStatuses(dbId, session);
    if (type === "list") {
      const documentList = await listDocuments(dbId, {
        category: searchParams.get("category"), isPitchDeck: searchParams.get("pitch_deck") === "true" ? true : searchParams.get("pitch_deck") === "false" ? false : undefined,
        search: searchParams.get("search"), visibility,
      });
      return NextResponse.json({ success: true, documents: documentList });
    }
    if (type === "detail" && searchParams.get("document_id")) {
      const document = await getDocument(searchParams.get("document_id"));
      // Object-level authorization: the document id comes from the query string,
      // so it must belong to THIS venture before its visibility is judged.
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      // Block access to private docs for non-privileged users
      if (visibility !== null && !visibility.includes(document.approval_status)) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 });
      }
      return NextResponse.json({ success: true, document });
    }
    if (type === "shares" && searchParams.get("document_id")) {
      const document = await getDocument(searchParams.get("document_id"));
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      const shares = await getDocumentShares(searchParams.get("document_id"));
      return NextResponse.json({ success: true, shares });
    }
    if (type === "access_logs" && searchParams.get("document_id")) {
      const document = await getDocument(searchParams.get("document_id"));
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      const logs = await getAccessLogs(searchParams.get("document_id"));
      return NextResponse.json({ success: true, logs });
    }
    return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}

export async function POST(req, { params }) {
  try { await initDb(); const authError = await requireAuth(ALLOWED); if (authError) return authError;
    const { id } = await params; const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
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
      const document = await getDocument(body.document_id);
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      await updateDocument(body.document_id, { ...body.updates, uploaded_by: session.cid });
      return NextResponse.json({ success: true });
    }
    if (body.action === "transition") {
      // Check: only founders/privileged can transition
      if (!PRIVILEGED.includes(session.role)) {
        const code = await resolveVentureCode(dbId);
        const founder = await isFounderForDocumentStatusTransition(code, session.cid);
        if (!founder.rows?.length) return NextResponse.json({ success: false, error: "Only founders can transition document status." }, { status: 403 });
      }
      const STATUSES = ["private", "pending_review", "approved", "shared_with_investor"];
      if (!STATUSES.includes(body.approval_status)) {
        return NextResponse.json({ success: false, error: `approval_status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
      }
      await updateDocumentApprovalStatus(body.approval_status, body.document_id, dbId);
      const labels = { approved: 'approved', shared_with_investor: 'shared with investors', pending_review: 'sent for review', private: 'marked private' };
      notifyVentureFounders(dbId, 'Document Status Updated', `A document has been ${labels[body.approval_status] || body.approval_status}.`);
      return NextResponse.json({ success: true });
    }
    if (body.action === "delete") {
      const document = await getDocument(body.document_id);
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      await deleteDocument(body.document_id);
      return NextResponse.json({ success: true });
    }
    if (body.action === "share") {
      // A share row must reference a document OF THIS venture.
      const document = await getDocument(body.document_id);
      if (!document || !ventureOwned(document, dbId, id)) return ventureNotFound();
      const result = await createShareLink({
        documentId: body.document_id, ventureId: dbId,
        sharedWithEmail: body.email, sharedWithName: body.name,
        accessType: body.access_type || "read", expiresInHours: body.expires_in_hours,
        maxDownloads: body.max_downloads, createdBy: session.cid,
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "revoke_share") {
      await revokeShare(body.share_id, [dbId, id]);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch(error) { return NextResponse.json({ success: false, error: error.message }, { status: 500 }); }
}
