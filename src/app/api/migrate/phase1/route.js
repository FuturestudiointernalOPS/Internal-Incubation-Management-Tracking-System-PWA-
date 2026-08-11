import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import fs from "fs";
import path from "path";

/**
 * POST /api/migrate/phase1
 *
 * Executes Phase 1 schema extension migration.
 * Requires super_admin authentication.
 * Safe to re-run — all operations use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
 */
export async function POST(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const sqlPath = path.join(
      process.cwd(),
      "src",
      "migrations",
      "035_phase1_unified_operations.sql",
    );

    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Split by semicolons and execute each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    const results = [];
    for (const stmt of statements) {
      // Skip DO blocks that are already complete (they contain their own semicolons)
      // Handle DO $$ ... $$ blocks specially
      const isDoBlock = stmt.includes("DO $$");
      const fullStmt = isDoBlock
        ? sql.substring(sql.indexOf(stmt), sql.indexOf("END $$", sql.indexOf(stmt)) + 7)
        : stmt;

      try {
        await db.execute({ sql: fullStmt, args: [] });
        results.push({
          statement: fullStmt.substring(0, 80).replace(/\n/g, " ") + "...",
          success: true,
        });
      } catch (err) {
        // "already exists" errors are fine for re-runs
        if (
          err.message.includes("already exists") ||
          err.message.includes("duplicate column") ||
          err.message.includes("duplicate key")
        ) {
          results.push({
            statement: fullStmt.substring(0, 80).replace(/\n/g, " ") + "...",
            success: true,
            note: "Already exists (safe re-run)",
          });
        } else {
          results.push({
            statement: fullStmt.substring(0, 80).replace(/\n/g, " ") + "...",
            success: false,
            error: err.message,
          });
        }
      }
    }

    const failures = results.filter((r) => !r.success);
    return NextResponse.json({
      success: failures.length === 0,
      executed: results.length,
      failed: failures.length,
      results,
    });
  } catch (error) {
    console.error("Phase 1 migration error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/migrate/phase1
 *
 * Dry-run: reads the SQL file and returns it for review.
 */
export async function GET(req) {
  try {
    const authError = await requireAuth(["super_admin"]);
    if (authError) return authError;

    const sqlPath = path.join(
      process.cwd(),
      "src",
      "migrations",
      "035_phase1_unified_operations.sql",
    );

    const sql = fs.readFileSync(sqlPath, "utf-8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    return NextResponse.json({
      success: true,
      file: "035_phase1_unified_operations.sql",
      statementCount: statements.length,
      sql,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
