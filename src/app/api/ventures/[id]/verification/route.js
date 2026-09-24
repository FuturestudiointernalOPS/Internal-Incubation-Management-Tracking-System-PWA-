import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { signEvidencePath } from "@/lib/ventureEvidence";
import {
  getOrCreateVerification,
  submitVerification,
  resubmitVerification,
  uploadVerificationDocument,
  deleteVerificationDocument,
  addVerificationComment,
  canSubmitVerification,
} from "@/lib/ventures";

/**
 * Who may read or annotate a Venture's verification state: a global role, an
 * active member (founder) of the venture, or delegated staff assigned to it.
 * Shared by the read path and the mutating actions so the two cannot drift.
 */
async function canAccessVerification(id, session) {
  if (!session) return false;
  if (["super_admin"].includes(session.role)) return true;
  const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
  const member = await db
    .execute({
      sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL LIMIT 1",
      args: [id, session.cid || "", session.cid || ""],
    })
    .catch(() => ({ rows: [] }));
  if (member.rows?.length) return true;
  return Boolean(await hasActiveVentureAssignment(id, session.cid, db));
}

/**
 * GET /api/ventures/[id]/verification
 *
 * Get verification status with all items, documents, history, reviews, comments.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    // Phase 4 guard: only global roles, active members (founders) or
    // delegated staff with an assignment may read verification state.
    if (!["super_admin"].includes(session.role)) {
      const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
      const member = await db
        .execute({
          sql: "SELECT 1 FROM venture_members WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?) AND removed_at IS NULL LIMIT 1",
          args: [id, session.cid || "", session.cid || ""],
        })
        .catch(() => ({ rows: [] }));
      const assigned = await hasActiveVentureAssignment(id, session.cid, db);
      if (!member.rows?.length && !assigned) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
    }

    const verificationResult = await getOrCreateVerification(id);

    // Documents are PRIVATE: the stored file_url is a storage path and gets a
    // short-lived signed URL minted per read for viewers who already passed
    // the gate above. `file_url` stays exactly as stored (nothing renamed) and
    // the signed value is additive; external links and failures stay null.
    const documents = await Promise.all(
      (verificationResult.documents || []).map(async (document) => ({
        ...document,
        file_url_signed: await signEvidencePath(document.file_url),
      })),
    );

    return NextResponse.json({ success: true, ...verificationResult, documents });
  },
);

/**
 * POST /api/ventures/[id]/verification
 *
 * Submit, resubmit, upload document, delete document, or add comment.
 * Action is specified in the body.
 */
export const POST = createHandler(
  async (req, { params }) => {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === "submit") {
      const canSubmit = await canSubmitVerification(id, session);
      if (!canSubmit) return NextResponse.json({ success: false, error: "Only founders can submit verification." }, { status: 403 });

      try {
        const result = await submitVerification({ ventureId: id, submittedBy: session });
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    if (action === "resubmit") {
      const canSubmit = await canSubmitVerification(id, session);
      if (!canSubmit) return NextResponse.json({ success: false, error: "Only founders can resubmit verification." }, { status: 403 });

      try {
        const result = await resubmitVerification({ ventureId: id, submittedBy: session });
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    if (action === "upload_document") {
      const canSubmit = await canSubmitVerification(id, session);
      if (!canSubmit) return NextResponse.json({ success: false, error: "Only founders can upload documents." }, { status: 403 });

      try {
        const verificationResult = await getOrCreateVerification(id);
        const result = await uploadVerificationDocument({
          ventureId: id,
          verificationId: verificationResult.verification.id,
          category: body.category,
          documentType: body.document_type,
          fileName: body.file_name,
          fileSize: body.file_size,
          fileType: body.file_type,
          fileUrl: body.file_url,
          uploadedBy: session.cid || "system",
        });
        return NextResponse.json({ success: true, ...result });
      } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }

    if (action === "delete_document") {
      // Object-level authorization: the document must belong to THIS venture's
      // verification. Previously any authenticated user could delete any
      // venture's verification document by id.
      if (!(await canAccessVerification(id, session))) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      const verificationResult = await getOrCreateVerification(id);
      const owned = (verificationResult.documents || []).some(
        (document) => String(document.id) === String(body.document_id),
      );
      if (!owned) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      await deleteVerificationDocument({ documentId: body.document_id });
      return NextResponse.json({ success: true });
    }

    if (action === "add_comment") {
      // Same gate as the read path: a comment is written only by someone who
      // may see the verification, and its author type is derived from the
      // session — never taken from the body (which let a caller pose as staff).
      if (!(await canAccessVerification(id, session))) {
        return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
      }
      const verificationResult = await getOrCreateVerification(id);
      const staffRoles = ["super_admin", "staff", "program_manager"];
      await addVerificationComment({
        verificationId: verificationResult.verification.id,
        authorType: staffRoles.includes(session.role) ? "staff" : "founder",
        authorCid: session.cid || "system",
        authorName: session.name || "System",
        message: body.message,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  },
);
