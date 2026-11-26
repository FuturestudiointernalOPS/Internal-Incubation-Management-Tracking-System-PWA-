import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { getDeckForViewer } from "@/services/investor/dealFlow";

/**
 * GET /api/investor/deck/[deckId]
 *
 * Authorizes a published deck for the calling investor and records
 * `deck_opened`. Only the file reference and the download flag are returned.
 */
export async function GET(_req, { params }) {
  try {
    await initDb();
    await ensureInvestorExpansionSchema();

    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { deckId } = await params;
    const result = await getDeckForViewer({ deckId, session: await getSession() });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, deck: result.deck, watermark: result.watermark });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
