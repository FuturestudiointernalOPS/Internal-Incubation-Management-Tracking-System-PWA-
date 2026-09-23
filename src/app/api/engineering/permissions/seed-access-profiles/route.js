import { NextResponse } from "next/server";
import { seedDefaultAccessProfiles } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireSameOrigin } from "@/lib/requestOrigin";

/**
 * GET /api/engineering/permissions/seed-access-profiles
 *
 * Seeds all default access profiles, capabilities, and role mappings.
 * Safe to re-run (uses upserts).
 *
 * State-changing GET (CSRF-1) — same-origin only.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await seedDefaultAccessProfiles();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Seed Access Profiles] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
