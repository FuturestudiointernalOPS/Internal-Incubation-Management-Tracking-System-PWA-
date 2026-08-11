import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "participant", "founder", "staff", "program_manager", "super_admin", "teacher",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const result = await db.execute({
      sql: `SELECT cid, name, email FROM contacts
            WHERE (name ILIKE ? OR email ILIKE ?)
            ORDER BY name ASC LIMIT 20`,
      args: [`%${q}%`, `%${q}%`],
    });

    return NextResponse.json({ success: true, contacts: result.rows || [] });
  } catch (error) {
    console.error("GET /api/contacts/search error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
