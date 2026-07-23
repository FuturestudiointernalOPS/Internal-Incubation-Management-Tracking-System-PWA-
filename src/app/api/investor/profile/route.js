import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/** GET  /api/investor/profile — current investor's profile */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "super_admin", "staff", "investor", "program_manager",
    ]);
    if (authError) return authError;

    const session = await getSession();
    const user = session;
    const result = await db.execute({
      sql: `SELECT ip.*, ipr.industries, ipr.countries, ipr.startup_stages,
                   ipr.ticket_size_min, ipr.ticket_size_max, ipr.investment_philosophy
            FROM investor_profiles ip
            LEFT JOIN investor_preferences ipr ON ipr.investor_id = ip.id
            WHERE ip.user_id = ?`,
      args: [user.cid || user.id],
    });

    const profile = result.rows[0] || null;
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** POST /api/investor/profile — create or update profile */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff", "investor"]);
    if (authError) return authError;

    const session = await getSession();
    const user = session;
    const body = await req.json();
    const { organization_name, biography, website, linkedin, photo_url } = body;

    // Upsert: check if profile exists
    const existing = await db.execute({
      sql: "SELECT id FROM investor_profiles WHERE user_id = ?",
      args: [user.cid || user.id],
    });

    let profile;
    if (existing.rows.length > 0) {
      const result = await db.execute({
        sql: `UPDATE investor_profiles
              SET organization_name = ?, biography = ?, website = ?, linkedin = ?,
                  photo_url = ?, updated_at = NOW()
              WHERE user_id = ? RETURNING *`,
        args: [organization_name || null, biography || null, website || null,
               linkedin || null, photo_url || null, user.cid || user.id],
      });
      profile = result.rows[0];
    } else {
      const result = await db.execute({
        sql: `INSERT INTO investor_profiles (user_id, organization_name, biography, website, linkedin, photo_url, approval_status)
              VALUES (?, ?, ?, ?, ?, ?, 'pending_review') RETURNING *`,
        args: [user.cid || user.id, organization_name || null, biography || null,
               website || null, linkedin || null, photo_url || null],
      });
      profile = result.rows[0];
    }

    // Also update contact record's role to investor if not already
    await db.execute({
      sql: "UPDATE contacts SET role = 'investor' WHERE cid = ? AND role NOT IN ('super_admin','staff','admin')",
      args: [user.cid || user.id],
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** PUT /api/investor/profile — admin update any profile */
export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "staff"]);
    if (authError) return authError;

    const { id, organization_name, biography, website, linkedin, photo_url } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "Profile ID required" }, { status: 400 });

    const result = await db.execute({
      sql: `UPDATE investor_profiles
            SET organization_name = ?, biography = ?, website = ?, linkedin = ?,
                photo_url = ?, updated_at = NOW()
            WHERE id = ? RETURNING *`,
      args: [organization_name || null, biography || null, website || null,
             linkedin || null, photo_url || null, id],
    });

    return NextResponse.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
