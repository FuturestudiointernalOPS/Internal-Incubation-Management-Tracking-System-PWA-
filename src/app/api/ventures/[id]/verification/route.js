import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  getOrCreateVerification,
  submitVerification,
  resubmitVerification,
  uploadVerificationDocument,
  deleteVerificationDocument,
  addVerificationComment,
  canSubmitVerification,
  canManageVerification,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/verification
 *
 * Get verification status with all items, documents, history, reviews, comments.
 */
export const GET = createHandler(
  async (req, { params }) => {
    const { id } = params;
    const session = await getSession();
    if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

    const data = await getOrCreateVerification(id);
    return NextResponse.json({ success: true, ...data });
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
    const { id } = params;
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
      } catch (e) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    if (action === "resubmit") {
      const canSubmit = await canSubmitVerification(id, session);
      if (!canSubmit) return NextResponse.json({ success: false, error: "Only founders can resubmit verification." }, { status: 403 });

      try {
        const result = await resubmitVerification({ ventureId: id, submittedBy: session });
        return NextResponse.json({ success: true, ...result });
      } catch (e) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    if (action === "upload_document") {
      const canSubmit = await canSubmitVerification(id, session);
      if (!canSubmit) return NextResponse.json({ success: false, error: "Only founders can upload documents." }, { status: 403 });

      try {
        const data = await getOrCreateVerification(id);
        const result = await uploadVerificationDocument({
          verificationId: data.verification.id,
          category: body.category,
          documentType: body.document_type,
          fileName: body.file_name,
          fileSize: body.file_size,
          fileType: body.file_type,
          fileUrl: body.file_url,
          uploadedBy: session.cid || "system",
        });
        return NextResponse.json({ success: true, ...result });
      } catch (e) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
    }

    if (action === "delete_document") {
      await deleteVerificationDocument({ documentId: body.document_id });
      return NextResponse.json({ success: true });
    }

    if (action === "add_comment") {
      const data = await getOrCreateVerification(id);
      await addVerificationComment({
        verificationId: data.verification.id,
        authorType: body.author_type || "founder",
        authorCid: session.cid || "system",
        authorName: session.name || "System",
        message: body.message,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  },
);
