import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { dispatchScheduledResultEmails } from "@/services/platform/formRuns";

export async function POST(req) {
  try {
    await initDb();
    const { getSession } = await import("@/server/auth/session");
    const session = await getSession();

    const providedSecret = req.headers.get("x-cron-secret");
    const cronAuthorized = !!process.env.CRON_SECRET && providedSecret === process.env.CRON_SECRET;
    if (!cronAuthorized) {
      if (!session) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
      const authError = await requireAuthorization("runs", "edit");
      if (authError) return authError;
    }

    const body = await req.json().catch(() => ({}));
    const summary = await dispatchScheduledResultEmails({ run_id: body?.run_id ?? null });
    return NextResponse.json({ success: !summary.error, ...summary }, { status: summary.error ? 500 : 200 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}