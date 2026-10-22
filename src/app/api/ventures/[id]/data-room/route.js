import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/server/auth/session";
import {
  buildDataRoom,
  createDataRoomDocument,
  replaceDataRoomDocument,
  reviewDataRoomDocument,
  updateDataRoomMetadata,
  deleteDataRoomDocument,
  grantDataRoomAccess,
  revokeDataRoomAccess,
  setDataRoomRequirement,
  recordDataRoomAccess,
} from "@/services/ventures/dataRoom";

/**
 * /api/ventures/[id]/data-room
 *
 * GET  — the Data Room of ONE Venture. A venture member or assigned staff
 *        member sees the catalogue; an investor sees ONLY the documents (or
 *        categories) explicitly granted to them. Files are never returned as
 *        public URLs: every readable file carries a short-lived signed URL
 *        minted for this request.
 *
 * POST — one action per call. Every action re-resolves the viewer server-side
 *        and enforces its own permission; the UI's hidden buttons are not the
 *        gate.
 *
 * `[id]` is the venture code OR its internal id — the service resolves either,
 * so an investor's pipeline (which carries the internal id) works unchanged.
 */

const fail = (result) =>
  NextResponse.json({ success: false, error: result.error }, { status: result.status || 400 });

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const searchParams = new URL(req.url).searchParams;
  const result = await buildDataRoom({
    ventureId: id,
    session,
    filters: {
      category: searchParams.get("category") || null,
      status: searchParams.get("status") || null,
      search: searchParams.get("search") || null,
    },
  });

  if (!result.ok) return fail(result);

  const { ok: _ok, ...data } = result;
  return NextResponse.json({ success: true, ...data });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");

  let result;
  switch (action) {
    case "create":
      result = await createDataRoomDocument({ ventureId: id, session, input: body });
      break;
    case "replace":
      result = await replaceDataRoomDocument({
        ventureId: id,
        documentId: body.document_id,
        session,
        input: body,
      });
      break;
    case "review":
      result = await reviewDataRoomDocument({
        ventureId: id,
        documentId: body.document_id,
        session,
        decision: body.decision,
        notes: body.notes,
      });
      break;
    case "update":
      result = await updateDataRoomMetadata({
        ventureId: id,
        documentId: body.document_id,
        session,
        input: body,
      });
      break;
    case "delete":
      result = await deleteDataRoomDocument({
        ventureId: id,
        documentId: body.document_id,
        session,
      });
      break;
    case "grant":
      result = await grantDataRoomAccess({
        ventureId: id,
        session,
        documentId: body.document_id || null,
        category: body.category || null,
        email: body.email,
        expiresInDays: body.expires_in_days,
      });
      break;
    case "revoke_grant":
      result = await revokeDataRoomAccess({ ventureId: id, grantId: body.grant_id, session });
      break;
    case "record_access":
      result = await recordDataRoomAccess({
        ventureId: id,
        documentId: body.document_id,
        session,
        accessType: body.access_type,
        meta: {
          ip: String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
          userAgent: req.headers.get("user-agent") || null,
        },
      });
      break;
    case "set_requirement":
      result = await setDataRoomRequirement({
        ventureId: id,
        session,
        category: body.category,
        level: body.level,
        note: body.note,
      });
      break;
    default:
      return NextResponse.json({ success: false, error: "dataRoom.errors.invalidAction" }, { status: 400 });
  }

  if (!result.ok) return fail(result);

  const { ok: _ok, ...data } = result;
  return NextResponse.json({ success: true, ...data });
});
