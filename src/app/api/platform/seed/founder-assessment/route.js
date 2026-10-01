import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/requestOrigin";
import { seedFounderAssessment } from "@/services/platform/seed";

/**
 * POST /api/platform/seed/founder-assessment
 *
 * One-click seed of the Founder Fit Score Assessment form.
 * Idempotent — re-running updates the existing form.
 * Only super_admin can trigger.
 *
 * See services/platform/seed.js for the seed pipeline.
 */
export async function POST() {
  await initDb();
  const authError = await requireAuth(["super_admin"]);
  if (authError) return authError;

  const result = await seedFounderAssessment();
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode });
  }

  return NextResponse.json({
    success: true,
    message: result.message,
    form_id: result.form_id,
    collection_id: result.collection_id,
    sections: result.sections,
    fields: result.fields,
    status: result.status,
    url: result.url,
  });
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
