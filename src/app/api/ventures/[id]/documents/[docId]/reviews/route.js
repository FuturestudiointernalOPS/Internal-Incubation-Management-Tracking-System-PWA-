import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "staff", "program_manager", "super_admin", "teacher", "developer"];
// Reviewers stand-in until Track 5's venture_advisors ships. TODO Track 5: scope to actual assigned advisor.
const REVIEWER_ROLES = ["staff", "program_manager", "super_admin", "teacher", "developer"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = (await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id=?", args: [id] })).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await db.execute({ sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?", args: [docId, dbId] });
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const r = await db.execute({ sql: "SELECT * FROM venture_document_reviews WHERE document_id = ? ORDER BY created_at DESC", args: [docId] });
    return NextResponse.json({ success: true, reviews: r.rows || [] });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(REVIEWER_ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    const dbId = (await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id=?", args: [id] })).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await db.execute({ sql: "SELECT id FROM venture_documents WHERE id = ? AND venture_id = ?", args: [docId, dbId] });
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    const { comment, decision } = await req.json();
    if (!["comment", "approved", "revision_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "decision must be comment, approved, or revision_requested" }, { status: 400 });
    }
    // Reviews never modify the original document — comment/approve/request-revision only.
    await db.execute({ sql: "INSERT INTO venture_document_reviews (document_id, reviewer_id, comment, decision) VALUES (?,?,?,?)", args: [docId, session.cid, comment || null, decision] });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
