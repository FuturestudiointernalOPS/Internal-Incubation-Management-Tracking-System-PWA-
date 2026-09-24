import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import { lmsErrorResponse } from "@/lib/lms/errors";
import {
  getRegistrationStats,
  listPaymentEvents,
  listPaymentEventsByRegistrationIds,
  listRegistrations,
  listRegistrationsRunOptions,
  listRegistrationsToReview,
} from "@/lib/lms/registrations";
import { reconcileRegistrations } from "@/lib/lms/checkoutReconcile";
import { linkRunToCourse } from "@/lib/lms/checkout";

export const dynamic = "force-dynamic";

const DEFAULT_PER_PAGE = 50;

/**
 * GET /api/lms/registrations
 *   ?runId= &courseId= &status= &access= &email= &page= &perPage=
 *   &review=1   the "à examiner" queue (a paid-but-no-access, or a failed payment)
 *   &events=1   the payment journal, including the lines that have no
 *               registration (an unknown reference, a refused amount)
 *
 * The team view: who registered, who paid, who has access, who got the email —
 * plus the one thing that used to be invisible, the last payment event.
 * Requires lms.view. Paginated; the counters are aggregated in the database.
 */
export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId") || undefined;
    const courseId = searchParams.get("courseId") || undefined;
    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const perPage = Math.min(
      200,
      Math.max(1, Number(searchParams.get("perPage") || DEFAULT_PER_PAGE) || DEFAULT_PER_PAGE),
    );

    const filters = {
      runId,
      courseId,
      status: searchParams.get("status") || undefined,
      access: searchParams.get("access") || undefined,
      emailStatus: searchParams.get("email") || undefined,
    };

    const wantsReview = searchParams.get("review") === "1";
    const rows = wantsReview
      ? await listRegistrationsToReview(filters)
      : await listRegistrations({ ...filters, limit: perPage, offset: (page - 1) * perPage });

    // The last payment event per row, in ONE query.
    const events = await listPaymentEventsByRegistrationIds(rows.map((row) => row.id));
    const lastEventByRegistration = new Map();
    for (const event of events) {
      const key = String(event.registration_id);
      if (!lastEventByRegistration.has(key)) lastEventByRegistration.set(key, event);
    }

    const registrations = rows.map((row) => ({
      ...row,
      last_event: lastEventByRegistration.get(String(row.id)) || null,
    }));

    const stats = await getRegistrationStats({ runId, courseId });

    const payload = {
      success: true,
      registrations,
      stats,
      page,
      per_page: perPage,
      review: wantsReview,
    };

    if (searchParams.get("events") === "1") {
      payload.events = await listPaymentEvents({
        status: searchParams.get("eventStatus") || undefined,
      });
    }

    if (searchParams.get("runs") === "1") {
      payload.runs = await listRegistrationsRunOptions();
    }

    return NextResponse.json(payload);
  } catch (error) {
    return lmsErrorResponse(error);
  }
}

/**
 * POST /api/lms/registrations?action=reconcile
 *
 * Close what Kkiapay's ~2.5s of retries cannot: replay a failed access step, and
 * re-verify a success we could not confirm. Requires lms.edit.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("lms", "edit");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Turn an Execution into a paid checkout (or back into a plain form).
    if (action === "link-run") {
      const body = await req.json().catch(() => ({}));
      const linked = await linkRunToCourse({
        runId: body.runId ? Number(body.runId) : null,
        courseId: body.courseId || null,
      });
      return NextResponse.json({ success: true, run: linked });
    }

    if (action !== "reconcile") {
      return NextResponse.json({ success: false, error: "lms.errors.invalidAction" }, { status: 400 });
    }

    const summary = await reconcileRegistrations({ limit: 25 });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return lmsErrorResponse(error);
  }
}
