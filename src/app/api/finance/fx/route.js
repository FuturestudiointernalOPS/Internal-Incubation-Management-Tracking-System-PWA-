import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getFxRate, normalizeCurrency } from "@/services/finance/fxRates";

/**
 * GET /api/finance/fx?base=XOF&quote=USD[&date=YYYY-MM-DD]
 *
 * The single door the browser uses to learn a rate. The provider is called
 * server-side only (no key ever reaches the client) and its answer is cached per
 * date, so repeated views cost nothing.
 *
 * A missing rate is `200 { success: true, fx: null }` — the screen then shows the
 * ORIGINAL amount rather than a stale conversion. A bad code is 400.
 */
export async function GET(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const base = normalizeCurrency(searchParams.get("base"));
  const quote = normalizeCurrency(searchParams.get("quote"));
  const date = searchParams.get("date");

  if (!base || !quote) {
    return NextResponse.json(
      { success: false, error: "finance.fx.invalidCurrency" },
      { status: 400 },
    );
  }

  const fx = await getFxRate({ base, quote, date });
  return NextResponse.json({ success: true, fx });
}
