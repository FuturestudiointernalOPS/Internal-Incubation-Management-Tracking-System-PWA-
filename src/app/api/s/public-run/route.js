import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { defaultPaymentProvider } from "@/lib/integrations/payments";
import { getPaidRunContext } from "@/services/lms/checkout";
import {
  getPublicRunBySlug,
  getSectionsByFormId,
  getFieldsByFormId,
  getFormVersionSnapshotByFormAndVersion,
  getGroupNameForRun,
} from "@/models/publicFormRuns";

/**
 * The layout a run was PUBLISHED with.
 *
 * A run pins a `form_version`; the form itself keeps changing afterwards. The
 * live tables are only the fallback (a run created before snapshots existed, or
 * a snapshot that never captured any field). Falling back keeps old runs
 * working, and a snapshot is never allowed to make a run disappear.
 *
 * A snapshot from before publishing saved the builder can hold fields with no
 * id — those cannot be keyed as answers, so such a snapshot is not usable and
 * the live layout wins instead.
 */
function hasUsableIds(sections, fields) {
  const hasId = (row) => row && row.id !== null && row.id !== undefined && row.id !== "";
  return sections.every(hasId) && fields.every(hasId);
}

async function resolveRunLayout(runRow) {
  const live = {
    sections: (await getSectionsByFormId(runRow.form_id)).rows,
    fields: (await getFieldsByFormId(runRow.form_id)).rows,
  };

  if (!runRow.form_version) return live;

  const pinned = await getFormVersionSnapshotByFormAndVersion(runRow.form_id, runRow.form_version);
  const snapshot = pinned.rows?.[0]?.snapshot;
  const sections = Array.isArray(snapshot?.sections) ? snapshot.sections : null;
  const fields = Array.isArray(snapshot?.fields) ? snapshot.fields : null;
  if (!sections || !fields) return live;
  if (sections.length === 0 && fields.length === 0) return live;
  if (!hasUsableIds(sections, fields)) return live;

  return { sections, fields };
}

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

    const layout = await resolveRunLayout(run.rows[0]);

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
      sections: layout.sections,
      fields: layout.fields,
      checkout,
    });
  } catch (error) {
    console.error("[Public Run] Error:", error.message);
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 });
  }
}
