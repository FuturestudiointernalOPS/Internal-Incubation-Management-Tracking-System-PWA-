/**
 * GET /api/platform/venture-run
 *
 * Resolves the configured Venture Run (system_settings.venture_run_id) and
 * returns its stable reference + public URL. Used by invitations, the
 * website "Register as a Venture" entry point, and program-side actions —
 * so staff never copy/paste URLs.
 *
 * Falls back to the most recent active run of a form flagged
 * settings.venture_application = true.
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { resolveVentureRun, ventureRunUrl } from "@/lib/ventureInvitations";

export async function GET() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const run = await resolveVentureRun();
    if (!run || !run.public_slug) {
      return NextResponse.json(
        { success: false, error: "No Venture Run configured. Run the Venture Application seed first." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      run_id: run.id,
      name: run.name,
      status: run.status,
      slug: run.public_slug,
      url: ventureRunUrl(run),
    });
  } catch (error) {
    console.error("Venture run resolution error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resolve Venture Run." },
      { status: 500 },
    );
  }
}
