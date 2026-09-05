import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import {
  getDraftRunIdByPublicSlug,
  getDraftBySubmitter,
  updateDraftData,
  insertDraftSubmission,
  getRunIdByPublicSlug,
  getLatestDraftData,
} from "@/models/publicFormRuns";

/**
 * POST /api/s/public-draft
 * Save or retrieve form draft progress.
 *
 * Body: { slug, data, section, email? }
 * Action: upserts a draft submission (status = 'draft')
 *
 * GET /api/s/public-draft?slug=X&email=Y
 * Retrieves an existing draft for a respondent.
 */
export async function POST(req) {
  try {
    await initDb();
    const body = await req.json();
    const { slug, data, section, email } = body;

    if (!slug || !data) {
      return NextResponse.json({ success: false, error: "slug and data required" }, { status: 400 });
    }

    // Resolve slug to run_id
    let run_id = null;
    try {
      const runRes = await getDraftRunIdByPublicSlug(slug);
      if (runRes.rows.length > 0) run_id = runRes.rows[0].id;
    } catch (_) {}

    if (!run_id) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }

    const submitterId = email || `public-${slug}`;

    // Upsert draft — update existing or insert new
    const existing = await getDraftBySubmitter(run_id, submitterId);

    if (existing.rows.length > 0) {
      await updateDraftData(data, existing.rows[0].id);
      return NextResponse.json({ success: true, id: existing.rows[0].id, action: "updated" });
    }

    const result = await insertDraftSubmission(run_id, submitterId, data);

    return NextResponse.json({ success: true, id: result.rows[0].id, action: "created" });
  } catch (error) {
    console.error("[Public Draft] Error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to save draft" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const email = searchParams.get("email");

    if (!slug || !email) {
      return NextResponse.json({ success: false, error: "slug and email required" }, { status: 400 });
    }

    let run_id = null;
    try {
      const runRes = await getRunIdByPublicSlug(slug);
      if (runRes.rows.length > 0) run_id = runRes.rows[0].id;
    } catch (_) {}

    if (!run_id) {
      return NextResponse.json({ success: false, draft: null });
    }

    const draft = await getLatestDraftData(run_id, email);

    if (draft.rows.length === 0) {
      return NextResponse.json({ success: true, draft: null });
    }

    return NextResponse.json({ success: true, draft: draft.rows[0].data });
  } catch (error) {
    console.error("[Public Draft GET] Error:", error.message);
    return NextResponse.json({ success: false, error: "Failed to retrieve draft" }, { status: 500 });
  }
}
