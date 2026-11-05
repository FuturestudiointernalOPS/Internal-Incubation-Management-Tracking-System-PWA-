import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { selectDisplayCurrency, updateDisplayCurrency } from "@/models/userPreferences";
import { normalizeCurrency } from "@/services/finance/fxRates";
import { STANDARD_CURRENCIES } from "@/lib/currencies";

/**
 * GET/PATCH /api/me/preferences
 *
 * A PERSONAL display preference — never the venture's reporting currency. The
 * reporting currency is what a founder files in; this is only the unit the
 * reader wants to see figures converted into.
 *
 * `displayCurrency: null` means "follow the venture" (no conversion at all).
 */
const SUPPORTED = new Set(STANDARD_CURRENCIES.map((entry) => entry.code));

export async function GET() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session?.cid) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const displayCurrency = await selectDisplayCurrency(session.cid).catch(() => null);
  return NextResponse.json({ success: true, displayCurrency });
}

export async function PATCH(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session?.cid) {
    return NextResponse.json({ success: false, error: "errors.authRequired" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const raw = body?.displayCurrency;

  // `null` / "" clears the preference: the reader sees each venture's own unit.
  if (raw !== null && raw !== undefined && raw !== "") {
    const code = normalizeCurrency(raw);
    if (!code || !SUPPORTED.has(code)) {
      return NextResponse.json({ success: false, error: "errors.invalidCurrency" }, { status: 400 });
    }
  }

  const displayCurrency = await updateDisplayCurrency(
    session.cid,
    raw === null || raw === undefined || raw === "" ? null : normalizeCurrency(raw),
  );

  return NextResponse.json({ success: true, displayCurrency });
}
