import db, { initDb } from "../src/lib/db.js";
import fs from "fs";
import path from "path";

// Auto-load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/**
 * BACKFILL: Extract task-like data from v2_op_reports and insert into tasks table.
 *
 * Maps report fields to tasks based on report type:
 *   standup: top_priorities, expected_deliverables → in_progress
 *   retro:   completed_work → completed (with completed_at)
 *            unfinished_tasks, carryover_items → carried_over
 *
 * Deduplicates by user_id + title + created_week + created_year.
 *
 * Run: set -a && . .env.local && node scripts/backfill_tasks_from_reports.mjs
 */

function parseJsonArray(value) {
  if (!value) return [];

  // Already an array (though unlikely from TEXT columns — defensive)
  if (Array.isArray(value)) return value;

  const str = String(value).trim();
  if (!str) return [];

  // Try JSON.parse first — the seed script stores JSON arrays like ["a","b"]
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && String(item).trim().length > 0);
    }
    return [];
  } catch {
    // Not valid JSON; treat as a plain text string (single-item array)
    const trimmed = str;
    if (trimmed.length > 0) {
      return [trimmed];
    }
    return [];
  }
}

function truncate(str, maxLen) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function backfill() {
  await initDb();
  console.log("Backfilling tasks from v2_op_reports...\n");

  // 1. Fetch all reports
  const result = await db.execute({
    sql: "SELECT * FROM v2_op_reports",
    args: [],
  });
  const reports = result.rows;
  const totalReports = reports.length;
  console.log(`  Found ${totalReports} reports to process.\n`);

  let taskCount = 0;
  let skipCount = 0;

  for (let i = 0; i < totalReports; i++) {
    const report = reports[i];
    console.log(`Processing report ${i + 1} of ${totalReports}...`);

    const reportType = report.report_type;
    const userId = report.user_id;
    const userName = report.user_name;
    const weekNumber = report.week_number;
    const year = report.year;

    let items = []; // Array of { title, status, completedAt }

    if (reportType === "standup") {
      // top_priorities → in_progress
      for (const item of parseJsonArray(report.top_priorities)) {
        items.push({ title: item, status: "in_progress", completedAt: null });
      }
      // expected_deliverables → in_progress
      for (const item of parseJsonArray(report.expected_deliverables)) {
        items.push({ title: item, status: "in_progress", completedAt: null });
      }
    } else if (reportType === "retro") {
      // completed_work → completed, completed_at = report.created_at
      const completedAt =
        report.created_at instanceof Date
          ? report.created_at.toISOString()
          : report.created_at || null;
      for (const item of parseJsonArray(report.completed_work)) {
        items.push({ title: item, status: "completed", completedAt });
      }
      // unfinished_tasks → carried_over
      for (const item of parseJsonArray(report.unfinished_tasks)) {
        items.push({ title: item, status: "carried_over", completedAt: null });
      }
      // carryover_items → carried_over
      for (const item of parseJsonArray(report.carryover_items)) {
        items.push({ title: item, status: "carried_over", completedAt: null });
      }
    }

    // 2. Insert each item, deduplicating by user_id + title + created_week + created_year
    for (const item of items) {
      const title = truncate(item.title, 500);
      if (!title) continue;

      // Check for existing duplicate
      const existing = await db.execute({
        sql: "SELECT id FROM tasks WHERE user_id = ? AND title = ? AND created_week = ? AND created_year = ?",
        args: [userId, title, weekNumber, year],
      });

      if (existing.rows.length > 0) {
        skipCount++;
        continue;
      }

      const insertArgs = [
        userId,
        userName,
        title,
        item.status,
        weekNumber,
        year,
      ];

      let sql;
      if (item.status === "completed" && item.completedAt) {
        sql =
          "INSERT INTO tasks (user_id, user_name, title, status, created_week, created_year, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        insertArgs.push(item.completedAt);
      } else {
        sql =
          "INSERT INTO tasks (user_id, user_name, title, status, created_week, created_year) VALUES (?, ?, ?, ?, ?, ?)";
      }

      await db.execute({ sql, args: insertArgs });
      taskCount++;
    }
  }

  console.log(`\n✅ Done. Created ${taskCount} tasks from ${totalReports} reports.`);
  if (skipCount > 0) {
    console.log(`   (Skipped ${skipCount} duplicates.)`);
  }
}

backfill().then(() => process.exit(0));
