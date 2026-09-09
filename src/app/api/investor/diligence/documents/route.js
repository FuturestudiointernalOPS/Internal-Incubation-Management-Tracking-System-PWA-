import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  getDdDocumentById,
  getDdRequestInfoForDocumentUpload,
  getRelationshipWorkspaceIdForDocumentUpload,
  insertDdDocument,
  insertDocumentDownloadedTimeline,
  insertDocumentUploadedTimeline,
  listDdDocumentsByRequestId,
  markDdRequestDocumentsUploaded,
} from "@/models/investor";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const body = await req.json();
    const { request_id, file_name, file_type, file_data } = body;

    if (!request_id || !file_name || !file_data) {
      return NextResponse.json({ success: false, error: "request_id, file_name, file_data required" }, { status: 400 });
    }

    const fileSize = Math.round((file_data.length * 3) / 4);
    const result = await insertDdDocument({ request_id, file_name, file_size: fileSize, file_type, file_data, uploaded_by: session?.cid || session?.id });

    // Auto-advance status to documents_uploaded
    await markDdRequestDocumentsUploaded({ file_name, request_id });

    // Timeline
    try {
      const reqInfo = await getDdRequestInfoForDocumentUpload(request_id);
      if (reqInfo.rows.length > 0) {
        const relWs = await getRelationshipWorkspaceIdForDocumentUpload(reqInfo.rows[0].pipeline_id);
        if (relWs.rows.length > 0) {
          await insertDocumentUploadedTimeline({ workspace_id: relWs.rows[0].id, file_name, title: reqInfo.rows[0].title });
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
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("request_id");
    const docId = searchParams.get("id");
    const download = searchParams.get("download");

    if (download && docId) {
      const result = await getDdDocumentById(docId);
      if (result.rows.length === 0) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

      const session = await getSession();
      try {
        await insertDocumentDownloadedTimeline({ file_name: result.rows[0].file_name, actor: session?.cid, doc_id: docId });
      } catch (_) {}
      return NextResponse.json({ success: true, document: result.rows[0] });
    }

    if (!requestId) return NextResponse.json({ success: false, error: "request_id required" }, { status: 400 });

    const result = await listDdDocumentsByRequestId(requestId);
    return NextResponse.json({ success: true, documents: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
