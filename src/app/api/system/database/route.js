import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getDatabaseInfo } from "@/lib/ventures";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  platformMigrationSteps,
  runPlatformMigrationStep,
} from "@/models/platformConfig";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const dbInfo = await getDatabaseInfo();
    return NextResponse.json({ success: true, ...dbInfo });
  }
);

/**
 * POST /api/system/database
 * Runs outstanding platform migrations (idempotent — safe to call multiple times).
 * Only accessible to super_admin.
 */
export async function POST(_req) {
  try {
    await initDb();
    // Running platform migrations is a Super Admin action: `settings.edit` is a
    // delegated capability and must not be able to write the schema.
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const results = [];

    const steps = platformMigrationSteps;

    for (const step of steps) {
      try {
        await runPlatformMigrationStep(step.sql);
        results.push({ step: step.name, status: "ok" });
        console.log(`[DB Migration] ✓ ${step.name}`);
      } catch (error) {
        const errorMessage = error.message || "";
        const status =
          errorMessage.includes("already exists") || errorMessage.includes("duplicate")
            ? "already exists"
            : `ERROR: ${errorMessage.substring(0, 120)}`;
        results.push({ step: step.name, status });
        console.warn(`[DB Migration] ${step.name}: ${status}`);
      }
    }

    const errors = results.filter((result) => result.status.startsWith("ERROR"));
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

