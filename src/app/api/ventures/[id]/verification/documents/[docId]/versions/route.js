import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import { signEvidencePath } from "@/lib/ventureEvidence";
import { isActiveVentureMember } from "@/models/ventureWorkspace";
import { listVerificationDocumentVersions, addVerificationDocumentVersion, canSubmitVerification } from "@/services/ventures/verification";

/**
 * /api/ventures/[id]/verification/documents/[docId]/versions — the version
 * history of ONE Data bank document.
 *
 * GET  — every version, oldest first (version 1 … newest), each with a
 *        short-lived signed URL because the files live in a PRIVATE bucket.
 *        Anyone who may already read the Venture's Data bank may read it.
 * POST — file a NEW version of the document (the same founder/staff gate that
 *        lets a document be uploaded in the first place). The document row then
 *        points at the new file; the older ones stay in the history.
 *
 * The version read/write itself lives in the model (src/lib/ventures.js) and is
 * scoped to the Venture in the URL — a document id from another Venture is a
 * 404, never another Venture's history.
 */

/**
 * Who may read a Venture's Data bank: a global role, an active member (founder)
 * of the Venture, or delegated staff with an assignment on it. Mirrors the gate
 * the verification read itself uses.
 */
async function canAccessVerification(id, session) {
  if (!session) return false;
  if (session.role === "super_admin") return true;
  const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth");
  const member = await isActiveVentureMember(id, session.cid).catch(() => ({ rows: [] }));
  if (member.rows?.length) return true;
  return Boolean(await hasActiveVentureAssignment(id, session.cid));
}

export const GET = createHandler(async (req, { params }) => {
  const { id, docId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }
  if (!(await canAccessVerification(id, session))) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  const result = await listVerificationDocumentVersions({ ventureId: id, documentId: docId });
  if (!result) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  const versions = await Promise.all(
    result.versions.map(async (version) => ({
      ...version,
      file_url_signed: await signEvidencePath(version.file_url),
    })),
  );

  return NextResponse.json({ success: true, versions });
});

export const POST = createHandler(async (req, { params }) => {
  const { id, docId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  }

  // The same gate as the initial upload: only a founder (or a Super Admin) may
  // add a file to the Venture's Data bank.
  if (!(await canSubmitVerification(id, session))) {
    return NextResponse.json({ success: false, error: "Only founders can upload documents." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body?.file_url) {
    return NextResponse.json({ success: false, error: "file_url required" }, { status: 400 });
  }

  const result = await addVerificationDocumentVersion({
    ventureId: id,
    documentId: docId,
    fileUrl: body.file_url,
    fileName: body.file_name || "document",
    fileSize: body.file_size ?? null,
    fileType: body.file_type ?? null,
    versionNotes: body.version_notes ?? null,
    uploadedBy: session.cid || "system",
  });
  if (!result) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }

  return NextResponse.json({ success: true, ...result });
});
