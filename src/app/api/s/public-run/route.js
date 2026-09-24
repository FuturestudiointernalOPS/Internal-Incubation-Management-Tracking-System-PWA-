import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { defaultPaymentProvider } from "@/lib/integrations/payments";
import { getPaidRunContext } from "@/lib/lms/checkout";
import {
  getPublicRunBySlug,
  getSectionsByFormId,
  getFieldsByFormId,
  getGroupNameForRun,
} from "@/models/publicFormRuns";

/**
 * GET /api/s/public-run?slug=X
 * Public endpoint — returns run + form + sections + fields.
 * No authentication required. Slug-only lookup (numeric IDs never accepted).
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    // Slug-only lookup — prevents sequential-ID probing of active runs.
    let run;
    try {
      run = await getPublicRunBySlug(slug);
    } catch (_) {
      // Legacy schemas without the public_slug column resolve as not-found.
      run = { rows: [] };
    }
    if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });

    const sections = await getSectionsByFormId(run.rows[0].form_id);

    const fields = await getFieldsByFormId(run.rows[0].form_id);

    // Fetch group name if this run is assigned to a group
    let groupName = null;
    try {
      const groupQuery = await getGroupNameForRun(run.rows[0].id);
      if (groupQuery.rows.length > 0) {
        groupName = groupQuery.rows[0].name;
      }
    } catch (_) {}

    const runData = { ...run.rows[0], group_name: groupName };

    // A PAID Execution: the price comes from the COURSE, server-side. A run with
    // no course behaves exactly as before.
    let checkout = null;
    try {
      const context = await getPaidRunContext(run.rows[0].id);
      if (context?.hasCourse) {
        const provider = defaultPaymentProvider();
        checkout = context.course
          ? {
              course: {
                title: context.course.title,
                description: context.course.description,
                amount: context.course.amount,
                currency: context.course.currency,
              },
              // The wording the team wrote for this course, when there is one.
              consent_text: context.course.consentText || null,
              payment: { ...provider.publicConfig(), configured: provider.isConfigured() },
            }
          : { misconfigured: true };
      }
    } catch (error) {
      console.warn("[Public Run] checkout context failed:", error.message);
    }

    return NextResponse.json({
      success: true,
      run: runData,
      sections: sections.rows,
      fields: fields.rows,
      checkout,
    });
  } catch (error) {
    console.error("[Public Run] Error:", error.message);
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 });
  }
}
