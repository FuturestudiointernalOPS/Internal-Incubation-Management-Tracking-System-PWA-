import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * WORK CATEGORIES API
 *
 * GET /api/categories
 * POST /api/categories
 *
 * Returns the system-wide work categories.
 * Used for categorizing non-project tasks (Independent Work).
 */
export async function GET() {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const result = await db.execute({
      sql: "SELECT * FROM work_categories WHERE is_active = true ORDER BY sort_order ASC",
    });

    return NextResponse.json({ success: true, categories: result.rows });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
