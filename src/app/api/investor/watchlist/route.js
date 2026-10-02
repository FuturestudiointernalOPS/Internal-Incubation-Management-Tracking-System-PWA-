import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { toggleWatchlist } from "@/services/investor";

/**
 * POST /api/investor/watchlist — toggle add/remove
 *
 * The add-or-remove decision and the profile guard live in
 * `@/services/investor`.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const { venture_id, personal_notes } = await req.json();

    const result = await toggleWatchlist({
      ventureId: venture_id,
      personalNotes: personal_notes,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, action: result.action });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
