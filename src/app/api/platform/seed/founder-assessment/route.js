import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { requireSameOrigin } from "@/lib/requestOrigin";
import { seedFounderAssessment } from "@/services/platform/seed";

/**
 * POST /api/platform/seed/founder-assessment
 *
 * One-click seed of the Founder Fit Score Assessment form.
 * Idempotent — re-running updates the existing form.
 * Only super_admin can trigger.
 *
 * Thin controller: gates on `super_admin` and delegates to
 * `@/services/platform/seed` (see docs/LAYER_SPLIT.md).
 */

export async function POST() {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const { status, body } = await seedFounderAssessment();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("[Seed Founder Assessment] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Also allow GET for one-click browser access
export async function GET(req) {
  // State-changing GET (CSRF-1): the seed runs on read, so a cross-site top-level
  // navigation (a clicked link carries the SameSite=Lax cookie) must be refused.
  // A same-origin call or a typed URL still passes. Prefer POST.
  const originError = requireSameOrigin(req);
  if (originError) return originError;
  return POST();
}
