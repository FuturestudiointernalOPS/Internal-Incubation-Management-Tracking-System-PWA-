import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";

/**
 * LANGUAGE PREFERENCE API
 *
 * PUT /api/auth/language
 *   - Updates the current user's language preference in the contacts table
 *   - Body: { language }
 *   - language must be 'en' or 'fr'
 */

export async function PUT(req) {
  try {
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    if (!session)
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    await initDb();
    const { language } = await req.json();
    const user_id = session.cid;

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
