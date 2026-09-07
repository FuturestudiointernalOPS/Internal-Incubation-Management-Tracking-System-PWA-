import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import {
  getVentureIdByCodeForReviews, getDocumentForReviews, listDocumentReviews,
  getVentureIdByCodeForReviewsSubmit, getDocumentForReviewsSubmit,
  insertDocumentReview,
} from "@/models/ventureAssets";
import { notifyVentureFounders } from "@/lib/ventures";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];
// Reviewers stand-in until Track 5's venture_advisors ships. TODO Track 5: scope to actual assigned advisor.
const REVIEWER_ROLES = ["staff", "program_manager", "super_admin", "teacher", "developer"];

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id, docId } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = (await getVentureIdByCodeForReviews(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForReviews(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const r = await listDocumentReviews(docId);
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
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = (await getVentureIdByCodeForReviewsSubmit(id)).rows?.[0]?.id;
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const doc = await getDocumentForReviewsSubmit(docId, dbId);
    if (!doc.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const { comment, decision } = await req.json();
    if (!["comment", "approved", "revision_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "decision must be comment, approved, or revision_requested" }, { status: 400 });
    }
    // Reviews never modify the original document — comment/approve/request-revision only.
    await insertDocumentReview({ document_id: docId, reviewer_id: session.cid, comment, decision });
    const labels = { approved: 'Document Approved', revision_requested: 'Revision Requested', comment: 'Review Comment Added' };
    notifyVentureFounders(dbId, labels[decision] || 'Document Reviewed', `A document review has been ${decision === 'approved' ? 'approved' : decision === 'revision_requested' ? 'requested for revision' : 'commented on'}.`);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
