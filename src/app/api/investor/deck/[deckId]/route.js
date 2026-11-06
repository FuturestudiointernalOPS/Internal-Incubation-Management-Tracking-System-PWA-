import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";

import { ensureInvestorExpansionSchema } from "@/models/investor/expansionSchema";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";
import { getDeckForViewer, recordDeckClosed } from "@/services/investor/dealFlow";

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

/** POST — { seconds } records `deck_closed` with time spent. */
export async function POST(req, { params }) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("view");
    if (capError) return capError;

    const { deckId } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await recordDeckClosed({
      deckId,
      seconds: body?.seconds,
      session: await getSession(),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
