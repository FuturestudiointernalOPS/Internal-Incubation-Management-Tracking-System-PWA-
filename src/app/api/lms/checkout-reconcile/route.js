import { NextResponse } from "next/server";
import { reconcileRegistrations } from "@/lib/lms/checkoutReconcile";

export const dynamic = "force-dynamic";

/**
 * POST /api/lms/checkout-reconcile?key=SECRET_KEY
 *
 * Scheduled replay of the paid-course registrations the payment provider's
 * retries could not close.
 *
 * WHY THIS EXISTS: Kkiapay re-delivers its payment notification only about five
 * times within ~2.5 seconds. That window is far too short to wait out a
 * verification outage (a network blip, a provider hiccup), so a payment whose
 * server-side verification failed at that instant is journaled as "failed" and
 * would otherwise stay pending forever. This endpoint runs the existing
 * reconciliation sweep (reconcileRegistrations): it replays the access step for
 * confirmed payments, and re-verifies the successes we could not confirm so a
 * now-settled transaction is finished and the learner gets their access.
 *
 * Secured like the other scheduled endpoints in this app: a shared secret in a
 * header (the `?key=` query parameter is still accepted for existing
 * schedulers), compared to CHECKOUT_RECONCILE_SECRET_KEY. Returns 503 when the
 * secret is not configured, so an unconfigured deployment never exposes an
 * unauthenticated write path; a wrong secret is refused with 403.
 *
 * Recommended cadence: every 5–10 minutes. The sweep is cheap and idempotent
 * (an already-paid registration is never touched), and the whole point is to
 * shrink the time a paid learner waits without access. Running hourly is an
 * acceptable floor, but 5–10 minutes keeps that wait close to the provider's
 * own retry horizon without meaningful load.
 */
const RECONCILE_SECRET = process.env.CHECKOUT_RECONCILE_SECRET_KEY;

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    // The secret travels in a header so it stops landing in access logs; the
    // query parameter is still accepted for existing schedulers (deprecated).
    const key = req.headers.get("x-cron-secret") || searchParams.get("key");

    if (!RECONCILE_SECRET) {
      return NextResponse.json(
        { success: false, error: "Service not configured." },
        { status: 503 },
      );
    }
    if (!key || key !== RECONCILE_SECRET) {
      return NextResponse.json(
        { success: false, error: "errors.insufficientPermissions" },
        { status: 403 },
      );
    }

    const summary = await reconcileRegistrations({ limit: 25 });
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[Checkout Reconcile] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
