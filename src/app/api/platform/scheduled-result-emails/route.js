import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { dispatchScheduledResultEmails } from "@/services/platform/formRuns";

export const dynamic = "force-dynamic";

/**
 * GET|POST /api/platform/scheduled-result-emails
 *
 * Punctual delivery of the result emails whose delay has elapsed.
 *
 * WHY THIS EXISTS: a run can schedule its report "N hours M minutes after the
 * submission". Nothing in the app watches the clock on its own — opening a run
 * or approving a submission only sweeps while someone is there, so without a
 * timer a due result waits for the next visit. This endpoint is that timer's
 * target: a scheduler calls it every few minutes and every due result leaves
 * then, with no one having to reopen the run.
 *
 * The work is idempotent (a submission whose result was already sent is never a
 * candidate), so calling it often is safe and a missed call is harmless — the
 * next one catches up.
 *
 * AUTHENTICATION: the caller is a scheduler, so it holds no session; the shared
 * secret is the credential, exactly like the checkout reconciliation. The
 * secret is read from `Authorization: Bearer <CRON_SECRET>` (the header Vercel
 * Cron sends when CRON_SECRET is set), then `x-cron-secret`, then the
 * deprecated `?key=`. Returns 503 when nothing is configured, so an
 * unconfigured deployment never exposes an unauthenticated trigger, and 403 for
 * a wrong or missing secret. The gateway admits this one path for this reason
 * only.
 */
function presentedSecret(req, searchParams) {
  const authorization = req.headers.get("authorization") || "";
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim()
    : null;
  return bearer || req.headers.get("x-cron-secret") || searchParams.get("key");
}

async function run(req) {
  try {
    const configured = process.env.CRON_SECRET;
    if (!configured) {
      return NextResponse.json(
        { success: false, error: "Service not configured." },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(req.url);
    if (presentedSecret(req, searchParams) !== configured) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    await initDb();
    // A scheduler may send no body at all (a bare GET or POST) — an empty or
    // absent payload must mean "every run", never a 500.
    const body = await req.json().catch(() => ({}));
    const summary = await dispatchScheduledResultEmails({ run_id: body?.run_id ?? null });
    return NextResponse.json({ success: !summary.error, ...summary }, { status: summary.error ? 500 : 200 });
  } catch (error) {
    console.error("[Scheduled Result Emails] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  return run(req);
}

export async function POST(req) {
  return run(req);
}
