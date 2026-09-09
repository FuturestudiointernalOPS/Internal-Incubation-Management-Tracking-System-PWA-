import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

import {
  addWatchlistEntry,
  findWatchlistEntry,
  getInvestorProfileIdForWatchlist,
  removeWatchlistEntry,
} from "@/models/investorRelations";
import { requireInvestorSelfServiceAuthorization } from "@/models/authorization/investorSelfService";

/** POST /api/investor/watchlist — toggle add/remove */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireInvestorSelfServiceAuthorization("create");
    if (capError) return capError;

    const session = await getSession();
    const { venture_id, personal_notes } = await req.json();
    if (!venture_id) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const prof = await getInvestorProfileIdForWatchlist(session.cid || session.id);
    if (prof.rows.length === 0) return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });

    const investorId = prof.rows[0].id;
    const existing = await findWatchlistEntry(investorId, venture_id);

    if (existing.rows.length > 0) {
      await removeWatchlistEntry(investorId, venture_id);
      return NextResponse.json({ success: true, action: "removed" });
    }

    await addWatchlistEntry(investorId, venture_id, personal_notes || null);
    return NextResponse.json({ success: true, action: "added" });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
