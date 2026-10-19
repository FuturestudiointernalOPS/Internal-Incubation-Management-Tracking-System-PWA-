import { NextResponse } from "next/server";
import {
  seedDefaultEligibility,
  invalidateAllAuthorizationContexts,
  requireAuthorization,
} from "@/models/authorization/index";
import { ensureProfileCatalogueSeed } from "@/models/authorization/profileCatalogueSeed";
import { seedDefaultResponsibilities } from "@/models/authorization/bootstrap";
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

    return NextResponse.json(await seedDefaults());
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
 * Seeds the default PROFILES (with their capabilities and role defaults),
 * the baseline eligibility ceilings and the responsibilities catalogue.
 *
 * Insert-only: an administrator's edit is never overwritten. The legacy
 * per-role capability table is gone — a role now names a default profile.
 */
export async function POST() {
  try {
    const capError = await requireAuthorization("permissions", "assign_capabilities");
    if (capError) return capError;

    return NextResponse.json(await seedDefaults());
  } catch (error) {
    console.error("[Permissions] Seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

async function seedDefaults() {
  const profiles = await ensureProfileCatalogueSeed();
  const eligibility = await seedDefaultEligibility();
  const responsibilities = await seedDefaultResponsibilities();
  invalidateAllAuthorizationContexts();
  return { success: true, profiles, eligibility, responsibilities };
}
