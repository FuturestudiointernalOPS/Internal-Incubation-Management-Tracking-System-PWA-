/**
 * Platform Notion Sync Engine
 *
 * Pushes Platform form submissions and runs to Notion databases.
 * One-way sync: ImpactOS Platform → Notion.
 *
 * Adapted from main branch — syncs platform_form_submissions and platform_form_runs
 * instead of tasks and v2_projects.
 *
 * This is called from API routes or automation rules.
 * It never modifies existing ImpactOS data beyond storing notion_page_id.
 */

import db from "@/lib/db";
import {
  isConfigured,
  createPage,
  updatePage,
  queryDatabase,
} from "./client";

/**
 * Build Notion properties for a form submission.
 *
 * Expected Notion DB columns:
 *   - Title (title) → submitter name + run name
 *   - Status (select) → submission status
 *   - Form (select) → form name
 *   - Run (select) → run name
 *   - Score (number) → overall score if available
 *   - Ranking (select) → ranking label if available
 *   - Submitted (date) → submitted_at date
 */
function submissionToProperties(submission, run, form) {
  const subData = submission.data || {};
  const scores = subData._scores;

  const props = {
    Title: {
      title: [{ text: { content: `${submission.submitter_name || submission.submitter_id} — ${run?.name || "Run"}` } }],
    },
  };

  if (submission.status) {
    props.Status = { select: { name: submission.status.replace(/_/g, " ") } };
  }

  if (form?.name) {
    props.Form = { select: { name: form.name } };
  }

  if (run?.name) {
    props.Run = { select: { name: run.name } };
  }

  if (scores?.overall != null) {
    props.Score = { number: scores.overall };
  }

  if (scores?.ranking) {
    props.Ranking = { select: { name: scores.ranking } };
  }

  if (submission.submitted_at) {
    props.Submitted = { date: { start: submission.submitted_at } };
  }

  return props;
}

/**
 * Sync a single submission to Notion.
 * @param {number} submissionId - platform_form_submissions.id
 */
export async function syncSubmission(submissionId) {
  if (!isConfigured()) {
    return { skipped: true, reason: "Notion not configured" };
  }

  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!databaseId) {
    return { skipped: true, reason: "NOTION_TASKS_DATABASE_ID not set" };
  }

  const sub = await db.execute({
    sql: "SELECT * FROM platform_form_submissions WHERE id = ?",
    args: [submissionId],
  });
  if (sub.rows.length === 0) return { skipped: true, reason: "Submission not found" };

  const submission = sub.rows[0];

  // Get run and form context
  const runRes = await db.execute({
    sql: "SELECT * FROM platform_form_runs WHERE id = ?",
    args: [submission.run_id],
  });
  const run = runRes.rows[0] || null;

  let form = null;
  if (run?.form_id) {
    const formRes = await db.execute({
      sql: "SELECT * FROM platform_forms WHERE id = ?",
      args: [run.form_id],
    });
    form = formRes.rows[0] || null;
  }

  const properties = submissionToProperties(submission, run, form);

  try {
    // Check if already synced
    if (submission.notion_page_id) {
      await updatePage(submission.notion_page_id, properties);
      return { success: true, action: "updated" };
    }

    const page = await createPage(databaseId, properties);

    await db.execute({
      sql: "UPDATE platform_form_submissions SET notion_page_id = ? WHERE id = ?",
      args: [page.id, submissionId],
    });

    return { success: true, action: "created", notionPageId: page.id };
  } catch (error) {
    console.error("[Platform Notion] Submission sync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Batch sync all submissions not yet in Notion.
 */
export async function syncAllSubmissions() {
  if (!isConfigured()) return { skipped: true };

  const subs = await db.execute({
    sql: `SELECT id FROM platform_form_submissions
          WHERE notion_page_id IS NULL
            AND status = 'submitted'
          LIMIT 50`,
    args: [],
  });

  const results = [];
  for (const sub of subs.rows) {
    const result = await syncSubmission(sub.id);
    results.push({ submissionId: sub.id, ...result });
  }

  return { synced: results.length, results };
}

/**
 * Check if Notion integration is configured.
 */
export function checkNotionHealth() {
  return {
    configured: isConfigured(),
    tasksDbId: !!process.env.NOTION_TASKS_DATABASE_ID,
    projectsDbId: !!process.env.NOTION_PROJECTS_DATABASE_ID,
  };
}
