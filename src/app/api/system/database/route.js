import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getDatabaseInfo } from "@/lib/ventures";
import db, { initDb } from "@/lib/db";
import { requireAuthorization } from "@/lib/authorization";

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

    const steps = [
      // ── 028: platform_evaluation_frameworks ──────────────────────────────────
      {
        name: "Create platform_evaluation_frameworks table",
        sql: `CREATE TABLE IF NOT EXISTS platform_evaluation_frameworks (
          id SERIAL PRIMARY KEY,
          form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
          source_document TEXT,
          framework JSONB NOT NULL,
          created_by TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(form_id)
        )`,
      },
      {
        name: "Create idx_eval_frameworks_form index",
        sql: `CREATE INDEX IF NOT EXISTS idx_eval_frameworks_form ON platform_evaluation_frameworks(form_id)`,
      },
      // ── 029: platform_submission_evaluations ─────────────────────────────────
      {
        name: "Create platform_submission_evaluations table",
        sql: `CREATE TABLE IF NOT EXISTS platform_submission_evaluations (
          id SERIAL PRIMARY KEY,
          submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
          framework_id INTEGER REFERENCES platform_evaluation_frameworks(id) ON DELETE SET NULL,
          evaluated_by TEXT NOT NULL DEFAULT 'ai',
          model TEXT DEFAULT 'deepseek-chat',
          dimensions JSONB NOT NULL,
          overall_score NUMERIC(5,1),
          ranking TEXT,
          recommendation TEXT,
          confidence NUMERIC(4,3),
          evaluated_at TIMESTAMP DEFAULT NOW()
        )`,
      },
      {
        name: "Create idx_evaluations_submission index",
        sql: `CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON platform_submission_evaluations(submission_id)`,
      },
      {
        name: "Create idx_evaluations_framework index",
        sql: `CREATE INDEX IF NOT EXISTS idx_evaluations_framework ON platform_submission_evaluations(framework_id)`,
      },
    ];

    for (const step of steps) {
      try {
        await db.execute({ sql: step.sql, args: [] });
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

