import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

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
    const profile = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });
    if (profile.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Investor profile not found. Create profile first." }, { status: 404 });
    }

    const investorId = profile.rows[0].id;

    // Upsert preferences
    await db.execute({
      sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max, investment_philosophy)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (investor_id)
            DO UPDATE SET industries = EXCLUDED.industries, countries = EXCLUDED.countries,
                          startup_stages = EXCLUDED.startup_stages, ticket_size_min = EXCLUDED.ticket_size_min,
                          ticket_size_max = EXCLUDED.ticket_size_max, investment_philosophy = EXCLUDED.investment_philosophy,
                          updated_at = NOW()`,
      args: [
        investorId,
        industries || [],
        countries || [],
        startup_stages || [],
        ticket_size_min || null,
        ticket_size_max || null,
        investment_philosophy || null,
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
