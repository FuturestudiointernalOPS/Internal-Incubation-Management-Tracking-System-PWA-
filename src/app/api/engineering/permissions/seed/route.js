import { NextResponse } from "next/server";
import { seedDefaultRoleCapabilities } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { requireSameOrigin } from "@/lib/requestOrigin";

/**
 * GET /api/engineering/permissions/seed
 *
 * State-changing GET (CSRF-1): the seed runs on read, so the request must come
 * from the application itself. Prefer POST for any new caller.
 */
export async function GET(req) {
  try {
    const originError = requireSameOrigin(req);
    if (originError) return originError;

    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await seedDefaultRoleCapabilities();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Permissions] Seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/engineering/permissions/seed
 *
 * Seeds default role capabilities into the database.
 * Safe to run multiple times (upserts).
 */
export async function POST() {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    const result = await seedDefaultRoleCapabilities();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Permissions] Seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
