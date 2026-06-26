import { NextResponse } from "next/server";
import { requireAuth, seedDefaultRoleCapabilities } from "@/lib/auth";

/**
 * POST /api/engineering/permissions/seed
 *
 * Seeds default role capabilities into the database.
 * Safe to run multiple times (upserts).
 */
export async function POST() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const result = await seedDefaultRoleCapabilities();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Permissions] Seed error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
