import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getDatabaseInfo } from "@/lib/ventures";
import { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";
import {
  platformMigrationSteps,
  runPlatformMigrationStep,
} from "@/models/platformConfig";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const db = await getDatabaseInfo();
    return NextResponse.json({ success: true, ...db });
  }
);

/**
 * POST /api/system/database
 * Runs outstanding platform migrations (idempotent — safe to call multiple times).
 * Only accessible to super_admin.
 */
export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("settings", "edit");
    if (capError) return capError;

    const results = [];

    const steps = platformMigrationSteps;

    for (const step of steps) {
      try {
        await runPlatformMigrationStep(step.sql);
        results.push({ step: step.name, status: "ok" });
        console.log(`[DB Migration] ✓ ${step.name}`);
      } catch (e) {
        const msg = e.message || "";
        const status =
          msg.includes("already exists") || msg.includes("duplicate")
            ? "already exists"
            : `ERROR: ${msg.substring(0, 120)}`;
        results.push({ step: step.name, status });
        console.warn(`[DB Migration] ${step.name}: ${status}`);
      }
    }

    const errors = results.filter((r) => r.status.startsWith("ERROR"));
    return NextResponse.json({
      success: errors.length === 0,
      message:
        errors.length === 0
          ? "All migrations applied successfully"
          : `${errors.length} step(s) failed`,
      results,
    });
  } catch (err) {
    console.error("[DB Migration] Fatal:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

