import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/migrate/phase0
 *
 * Applies the Phase 0 migration (Engineering Operations).
 * Only accessible to super_admin.
 */
export async function GET() {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    await initDb();
    const results = [];

    // 1. Add priority column to tasks
    try {
      await db.execute({
        sql: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'`,
        args: [],
      });
      results.push({ step: "Add priority column", status: "ok" });
    } catch (e) {
      results.push({ step: "Add priority column", status: e.message.includes("already exists") ? "already exists" : e.message });
    }

    // 2. Add priority check constraint
    try {
      await db.execute({
        sql: `ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('critical', 'high', 'medium', 'low'))`,
        args: [],
      });
      results.push({ step: "Add priority check", status: "ok" });
    } catch (e) {
      results.push({ step: "Add priority check", status: e.message.includes("already exists") ? "already exists" : e.message.substring(0, 80) });
    }

    // 3. Create indexes
    try {
      await db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)", args: [] });
      results.push({ step: "Create priority index", status: "ok" });
    } catch (e) {
      results.push({ step: "Create priority index", status: e.message.substring(0, 80) });
    }

    try {
      await db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_tasks_assigned_priority ON tasks(assigned_to, priority)", args: [] });
      results.push({ step: "Create assigned_priority index", status: "ok" });
    } catch (e) {
      results.push({ step: "Create assigned_priority index", status: e.message.substring(0, 80) });
    }

    // 4. Enhance error_logs table
    const errorColumns = [
      { name: "resolved_at", type: "TIMESTAMP WITH TIME ZONE" },
      { name: "page", type: "TEXT" },
      { name: "action_attempted", type: "TEXT" },
      { name: "task_id", type: "INTEGER" },
    ];

    for (const col of errorColumns) {
      try {
        await db.execute({
          sql: `ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`,
          args: [],
        });
        results.push({ step: `Add error_logs.${col.name}`, status: "ok" });
      } catch (e) {
        results.push({ step: `Add error_logs.${col.name}`, status: e.message.includes("already exists") ? "already exists" : e.message.substring(0, 80) });
      }
    }

    // 5. Create error_logs task_id index
    try {
      await db.execute({ sql: "CREATE INDEX IF NOT EXISTS idx_error_logs_task_id ON error_logs(task_id)", args: [] });
      results.push({ step: "Create error_logs task_id index", status: "ok" });
    } catch (e) {
      results.push({ step: "Create error_logs task_id index", status: e.message.substring(0, 80) });
    }

    // 6. Update severity check constraint
    try {
      await db.execute({
        sql: `ALTER TABLE error_logs DROP CONSTRAINT IF EXISTS error_logs_severity_check`,
        args: [],
      });
      await db.execute({
        sql: `ALTER TABLE error_logs ADD CONSTRAINT error_logs_severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical', 'fatal'))`,
        args: [],
      });
      results.push({ step: "Update severity check", status: "ok" });
    } catch (e) {
      results.push({ step: "Update severity check", status: e.message.substring(0, 80) });
    }

    return NextResponse.json({
      success: true,
      message: "Phase 0 migration applied",
      results,
    });
  } catch (err) {
    console.error("[Migration] Phase 0 failed:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    );
  }
}
