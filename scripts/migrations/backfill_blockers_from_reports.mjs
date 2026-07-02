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
 * BACKFILL: Extract blocker data from v2_op_reports and insert into blockers table.
 *
 * Maps report fields to blockers:
 *   standup: has_blockers = true → blocker_description as title
 *   retro:   had_blockers = true → blocker_desc as title, blocker_type determines severity
 *
 * Before creating a blocker, ensures a parent task exists:
 *   - Looks for any task with the same user_id + created_week + created_year
 *   - If found, uses its id as task_id
 *   - If NOT found, creates a placeholder task with status='blocked'
 *
 * Deduplicates by user_id + title + created_week + created_year.
 *
 * Run: set -a && . .env.local && node scripts/backfill_blockers_from_reports.mjs
 */

function truncate(str, maxLen) {
  if (!str) return "";
  const s = String(str).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function mapSeverity(blockerType) {
  if (!blockerType) return "medium";
  const mapping = {
    Technical: "high",
    Communication: "medium",
    Dependency: "high",
    "Time Constraint": "medium",
    "Resource Limitation": "high",
  };
  return mapping[blockerType] || "medium";
}

async function backfill() {
  await initDb();
  console.log("Backfilling blockers from v2_op_reports...\n");

  // 1. Fetch all reports that have blockers
  const result = await db.execute({
    sql: "SELECT * FROM v2_op_reports WHERE has_blockers = true OR had_blockers = true",
    args: [],
  });
  const reports = result.rows;
  const totalReports = reports.length;
  console.log(`  Found ${totalReports} reports with blockers to process.\n`);

  let blockerCount = 0;
  let skipCount = 0;
  let taskCreateCount = 0;

  for (let i = 0; i < totalReports; i++) {
    const report = reports[i];
    const reportType = report.report_type;
    const userId = report.user_id;
    const userName = report.user_name || "";
    const weekNumber = report.week_number;
    const year = report.year;

    // Determine blocker title based on report type
    let title = "";
    let severity = "medium";

    if (reportType === "standup") {
      title = truncate(report.blocker_description || "", 500);
      // Standup blockers use a default medium severity (no blocker_type field)
      severity = "medium";
    } else if (reportType === "retro") {
      title = truncate(report.blocker_desc || "", 500);
      severity = mapSeverity(report.blocker_type);
    }

    if (!title) {
      console.log(
        `  ⚠️  Report ${i + 1}/${totalReports} (${userId} W${weekNumber} ${reportType}): empty blocker title, skipping`,
      );
      continue;
    }

    // 2. Check for duplicate blocker (same user_id + title + same week)
    // Join through tasks to match on created_week/created_year
    const existingBlocker = await db.execute({
      sql: "SELECT b.id FROM blockers b JOIN tasks t ON b.task_id = t.id WHERE b.user_id = ? AND b.title = ? AND t.created_week = ? AND t.created_year = ?",
      args: [userId, title, weekNumber, year],
    });

    if (existingBlocker.rows.length > 0) {
      skipCount++;
      continue;
    }

    // 3. Find or create a parent task
    let taskId = null;

    // Look for an existing task for this user+week
    const existingTask = await db.execute({
      sql: "SELECT id FROM tasks WHERE user_id = ? AND created_week = ? AND created_year = ? LIMIT 1",
      args: [userId, weekNumber, year],
    });

    if (existingTask.rows.length > 0) {
      taskId = existingTask.rows[0].id;
    } else {
      // Create a placeholder task
      const placeholderTitle = `Work from Week ${weekNumber}`;
      const insertResult = await db.execute({
        sql: "INSERT INTO tasks (user_id, user_name, title, status, created_week, created_year) VALUES (?, ?, ?, 'blocked', ?, ?) RETURNING id",
        args: [userId, userName, placeholderTitle, weekNumber, year],
      });
      taskId = insertResult.rows[0].id;
      taskCreateCount++;
    }

    // 4. Create the blocker
    await db.execute({
      sql: "INSERT INTO blockers (task_id, user_id, user_name, title, description, severity, status) VALUES (?, ?, ?, ?, NULL, ?, 'active')",
      args: [taskId, userId, userName, title, severity],
    });

    blockerCount++;

    if ((i + 1) % 20 === 0 || i === totalReports - 1) {
      console.log(
        `  Processed ${i + 1}/${totalReports} reports — ${blockerCount} blockers created, ${skipCount} skipped, ${taskCreateCount} placeholder tasks created`,
      );
    }
  }

  console.log(`\n✅ Done.`);
  console.log(`   Reports processed: ${totalReports}`);
  console.log(`   Blockers created:  ${blockerCount}`);
  console.log(`   Duplicates skipped: ${skipCount}`);
  console.log(`   Placeholder tasks created: ${taskCreateCount}`);
}

backfill().then(() => process.exit(0));
