import { NextResponse } from "next/server";
import { seedDefaultRoleCapabilities } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";

/**
 * GET /api/engineering/permissions/seed
 */
export async function GET() {
  try {
    const capError = await requireAuthorization("permissions", "view_matrix");
    if (capError) return capError;

    const result = await seedDefaultRoleCapabilities();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Permissions] Seed error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
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
  } catch (err) {
    console.error("[Permissions] Seed error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
