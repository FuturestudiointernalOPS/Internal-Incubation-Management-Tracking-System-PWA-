import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, seedDefaultAccessProfiles } from "@/lib/auth";

/**
 * GET /api/engineering/permissions/seed-access-profiles
 *
 * Seeds all default access profiles, capabilities, and role mappings.
 * Safe to re-run (uses upserts).
 */
export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

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
