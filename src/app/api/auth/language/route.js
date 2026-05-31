import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * LANGUAGE PREFERENCE API
 *
 * PUT /api/auth/language
 *   - Updates the user's language preference in the contacts table
 *   - Body: { user_id, language }
 *   - language must be 'en' or 'fr'
 */

export async function PUT(req) {
  try {
    await initDb();
    const { user_id, language } = await req.json();

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 },
      );
    }

    if (!language || !["en", "fr"].includes(language)) {
      return NextResponse.json(
        { success: false, error: "language must be 'en' or 'fr'" },
        { status: 400 },
      );
    }

    // Update language in contacts table
    // Try cid first, then id
    const result = await db.execute({
      sql: "UPDATE contacts SET language = ? WHERE (cid = ? OR id = ?) AND deleted = 0",
      args: [language, user_id, user_id],
    });

    if (result.rowsAffected === 0) {
      // User might be a team account — teams table doesn't have language column
      return NextResponse.json({
        success: true,
        note: "Language preference saved locally (account not found in contacts)",
      });
    }

    return NextResponse.json({
      success: true,
      language,
    });
  } catch (error) {
    console.error("Language preference update error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
