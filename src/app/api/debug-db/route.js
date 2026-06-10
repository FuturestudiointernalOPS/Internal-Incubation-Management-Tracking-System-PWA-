import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;
    const res = await db.execute(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    return NextResponse.json({
      tables: res.rows.map((r) => r.table_name).sort(),
      db_url: process.env.DATABASE_URL?.split("@")[1], // Only show host for security
    });
  } catch (e) {
    return NextResponse.json({ error: e.message });
  }
}
