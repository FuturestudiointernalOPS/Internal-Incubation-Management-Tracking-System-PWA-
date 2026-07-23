import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import {
  listDocuments, getDocument, uploadDocument, updateDocument, deleteDocument,
  createShareLink, revokeShare, getAccessLogs, getDocumentShares,
} from "@/lib/ventures";

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const s = new URL(req.url).searchParams;
  const type = s.get("type") || "list";

  if (type === "list") {
    const docs = await listDocuments(id, {
      category: s.get("category"), isPitchDeck: s.get("pitch_deck") === "true" ? true : s.get("pitch_deck") === "false" ? false : undefined,
      search: s.get("search"),
    });
    return NextResponse.json({ success: true, documents: docs });
  }

  if (type === "detail" && s.get("document_id")) {
    const doc = await getDocument(parseInt(s.get("document_id")));
    if (!doc) return NextResponse.json({ success: false, error: "Document not found." }, { status: 404 });
    return NextResponse.json({ success: true, document: doc });
  }

  if (type === "shares" && s.get("document_id")) {
    const shares = await getDocumentShares(parseInt(s.get("document_id")));
    return NextResponse.json({ success: true, shares });
  }

  if (type === "access_logs" && s.get("document_id")) {
    const logs = await getAccessLogs(parseInt(s.get("document_id")));
    return NextResponse.json({ success: true, logs });
  }

  return NextResponse.json({ success: false, error: "Invalid type." }, { status: 400 });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();

  if (body.action === "upload") {
    try {
      const result = await uploadDocument({
        ventureId: id, title: body.title, description: body.description,
        documentType: body.document_type, category: body.category,
        fileName: body.file_name, fileSize: body.file_size, fileType: body.file_type,
        fileUrl: body.file_url, thumbnailUrl: body.thumbnail_url,
        isPitchDeck: body.is_pitch_deck, uploadedBy: req.session?.cid,
      });
      return NextResponse.json({ success: true, document_id: result.id });
    } catch (e) { return NextResponse.json({ success: false, error: e.message }, { status: 400 }); }
  }

  if (body.action === "update") {
    await updateDocument(parseInt(body.document_id), { ...body.updates, uploaded_by: req.session?.cid });
    return NextResponse.json({ success: true });
  }

  if (body.action === "delete") {
    await deleteDocument(parseInt(body.document_id));
    return NextResponse.json({ success: true });
  }

  if (body.action === "share") {
    const result = await createShareLink({
      documentId: parseInt(body.document_id), ventureId: id,
      sharedWithEmail: body.email, sharedWithName: body.name,
      accessType: body.access_type || "read", expiresInHours: body.expires_in_hours,
      maxDownloads: body.max_downloads, createdBy: req.session?.cid,
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (body.action === "revoke_share") {
    await revokeShare(parseInt(body.share_id));
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
