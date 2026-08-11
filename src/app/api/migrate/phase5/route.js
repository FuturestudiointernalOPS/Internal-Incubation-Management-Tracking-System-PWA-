import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

/**
 * POST /api/migrate/phase5
 *
 * Executes Phase 5 data migration — moves venture_standups, venture_retros,
 * v2_standups, and v2_retros into the unified v2_op_reports table.
 * Requires super_admin. Idempotent — safe to re-run.
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const sqlPath = path.join(
      process.cwd(),
      "src",
      "migrations",
      "036_phase5_data_migration.sql",
    );

    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Split into individual statements, handling INSERT...SELECT with subqueries
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    const results = [];
    let migratedCount = 0;

    for (const stmt of statements) {
      try {
        const result = await db.execute({ sql: stmt, args: [] });
        const inserted = result.rowsAffected || 0;
        migratedCount += inserted;

        const preview = stmt.substring(0, 100).replace(/\n/g, " ").trim();
        results.push({
          statement: preview + "...",
          rowsInserted: inserted,
          success: true,
        });
      } catch (err) {
        // Already-exists errors are fine for re-runs
        if (
          err.message.includes("duplicate key") ||
          err.message.includes("violates unique")
        ) {
          results.push({
            statement: stmt.substring(0, 80).replace(/\n/g, " ") + "...",
            rowsInserted: 0,
            success: true,
            note: "No new rows (already migrated)",
          });
        } else {
          results.push({
            statement: stmt.substring(0, 80).replace(/\n/g, " ") + "...",
            success: false,
            error: err.message,
          });
        }
      }
    }

    const failures = results.filter((r) => !r.success);

    return NextResponse.json({
      success: failures.length === 0,
      totalMigrated: migratedCount,
      statements: results.length,
      failed: failures.length,
      results,
    });
  } catch (error) {
    console.error("Phase 5 migration error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/migrate/phase5 — preview the migration SQL
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const sqlPath = path.join(
      process.cwd(),
      "src",
      "migrations",
      "036_phase5_data_migration.sql",
    );

    const sql = fs.readFileSync(sqlPath, "utf-8");
    return NextResponse.json({ success: true, sql });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
