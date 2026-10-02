import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { saveInvestorPreferences } from "@/services/investor";

/**
 * POST /api/investor/preferences — save/update preferences
 *
 * The profile guard and the upsert defaults live in `@/services/investor`.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const body = await req.json();

    const result = await saveInvestorPreferences({ body, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
