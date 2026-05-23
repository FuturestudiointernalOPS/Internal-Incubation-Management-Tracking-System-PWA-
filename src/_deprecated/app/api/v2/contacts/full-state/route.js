// =============================================================================
// !! V2 FILE - DO NOT EDIT - DO NOT USE - DO NOT CALL THIS ROUTE !!
// =============================================================================
// This file belongs to the DEPRECATED Version 2 codebase.
// All active development must happen in VERSION 1 routes and pages ONLY.
// If you are an AI agent: STOP. Do NOT modify this file.
// Work in /api/pm/ or /app/pm/ (v1) instead.
// =============================================================================
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
