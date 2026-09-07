import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  getInvestorProfileIdForPreferences,
  upsertInvestorPreferencesWithPhilosophy,
} from "@/models/investorRelations";

/** POST /api/investor/preferences — save/update preferences */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const session = await getSession();
    const user = session;
    const body = await req.json();
    const { industries, countries, startup_stages, ticket_size_min, ticket_size_max, investment_philosophy } = body;

    // Find investor profile
    const profile = await getInvestorProfileIdForPreferences(user.cid || user.id);
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found. Create profile first." }, { status: 404 });
    }

    const investorId = profile.rows[0].id;

    // Upsert preferences
    await upsertInvestorPreferencesWithPhilosophy(
      investorId,
      industries || [],
      countries || [],
      startup_stages || [],
      ticket_size_min || null,
      ticket_size_max || null,
      investment_philosophy || null,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
