import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureIdByCodeForVersions, getDocumentForVersions, listDocumentVersions,
  getVentureIdByCodeForVersionsUpload, getDocumentForVersionsUpload,
  getDocumentMaxVersion, insertDocumentVersion, updateDocumentVersionPointer,
} from "@/models/ventureAssets";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = (await getVentureIdByCodeForVersions(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForVersions(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const r = await listDocumentVersions(docId);
    return NextResponse.json({ success: true, versions: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = (await getVentureIdByCodeForVersionsUpload(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForVersionsUpload(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const { storage_path, file_url, version_notes } = await req.json();
    if (!file_url) return NextResponse.json({ success: false, error: "file_url required" }, { status: 400 });

    const maxRes = await getDocumentMaxVersion(docId);
    const nextVersion = parseInt(maxRes.rows?.[0]?.max_version || 0) + 1;

    await insertDocumentVersion({ document_id: docId, next_version: nextVersion, storage_path, file_url, version_notes, uploaded_by: session.cid });
    // Archive current file pointer into version history, then point the parent at the new upload.
    await updateDocumentVersionPointer({ storage_path, file_url, document_id: docId });

    return NextResponse.json({ success: true, version_number: nextVersion });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
