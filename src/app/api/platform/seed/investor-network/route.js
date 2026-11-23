/**
 * POST /api/platform/seed/investor-network
 *
 * Creates (or reuses) the public "Join our investors network" form and its run
 * inside the platform forms engine, and returns the run's public link.
 *
 * It is NOT the Investor Application: no `investor_application` flag, no
 * approval automation, no account provisioning. It only collects interest.
 *
 * Idempotent: re-running returns the same form and the same link.
 *
 * Gate: `investor.create` (delegatable from the Permission Center) or
 * `settings.edit`.
 */

import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/server/auth/guards";
import { requireAnyAuthorization } from "@/models/authorization/index";
import { seedInvestorNetworkForm } from "@/services/platform/seed";

export async function POST() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  const capError = await requireAnyAuthorization([
    { module: "investor", capability: "create" },
    { module: "settings", capability: "edit" },
  ]);
  if (capError) return capError;

  try {
    const { status, body } = await seedInvestorNetworkForm();
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("Investor network form seed error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Seed failed." },
      { status: 500 },
    );
  }
}
