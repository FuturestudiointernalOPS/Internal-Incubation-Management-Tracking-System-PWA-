import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await initDb();

    // High-Bandwidth CRM Sync
    const [contactsRes, familiesRes] = await Promise.all([
      db.execute("SELECT * FROM contacts ORDER BY created_at DESC"),
      db.execute("SELECT * FROM families ORDER BY created_at DESC")
    ]);

    return NextResponse.json({
      success: true,
      contacts: contactsRes.rows,
      families: familiesRes.rows
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
