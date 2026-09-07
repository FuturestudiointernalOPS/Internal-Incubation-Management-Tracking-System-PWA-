import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { seedDefaultAccessProfiles } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/**
 * GET /api/engineering/permissions/seed-access-profiles
 *
 * Seeds all default access profiles, capabilities, and role mappings.
 * Safe to re-run (uses upserts).
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await seedDefaultAccessProfiles();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Seed Access Profiles] error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
