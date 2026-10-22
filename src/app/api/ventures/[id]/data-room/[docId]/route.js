import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import { loadDataRoomDocument } from "@/services/ventures/dataRoom";

/**
 * GET /api/ventures/[id]/data-room/[docId]
 *
 * One document with its full version history. The document id comes from the
 * URL, so it is resolved THROUGH the Venture: a document that belongs to
 * another Venture is a 404, never another Venture's file.
 *
 * An investor receives this document only when a live grant covers it; the
 * service applies the same grant rule the catalogue uses, so a listing and a
 * direct read can never disagree.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id, docId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const result = await loadDataRoomDocument({ ventureId: id, documentId: docId, session });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.status || 404 },
    );
  }

  const { ok: _ok, ...data } = result;
  return NextResponse.json({ success: true, ...data });
});
