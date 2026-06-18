/**
 * Notion Sync Engine
 *
 * Pushes ImpactOS tasks and projects to Notion databases.
 * One-way sync: ImpactOS → Notion.
 *
 * This is called from API routes or can be triggered manually.
 * It never modifies existing ImpactOS data.
 */

import db from "@/lib/db";
import {
  isConfigured,
  createPage,
  queryDatabase,
  taskToProperties,
  projectToProperties,
} from "./client";

/**
 * Sync a single task to Notion
 * @param {number|string} taskId - ID in the local tasks table
 */
export async function syncTask(taskId) {
  if (!isConfigured()) {
    return { skipped: true, reason: "Notion not configured" };
  }

  // Fetch the task with project name
  const res = await db.execute({
    sql: `SELECT t.*, p.name as project_name
          FROM tasks t
          LEFT JOIN v2_projects p ON t.project_id = p.id
          WHERE t.id = ?`,
    args: [taskId],
  });

  const task = res.rows[0];
  if (!task) return { skipped: true, reason: "Task not found" };

  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  const properties = taskToProperties(task);

  try {
    // Check if a Notion page already exists for this task
    const existing = await db.execute({
      sql: "SELECT notion_page_id FROM tasks WHERE id = ? AND notion_page_id IS NOT NULL",
      args: [taskId],
    });

    if (existing.rows[0]?.notion_page_id) {
      // Update existing Notion page
      await updatePage(existing.rows[0].notion_page_id, properties);
      return { success: true, action: "updated" };
    }

    // Create new Notion page
    const page = await createPage(databaseId, properties);

    // Store the Notion page ID on the task
    await db.execute({
      sql: "UPDATE tasks SET notion_page_id = ? WHERE id = ?",
      args: [page.id, taskId],
    });

    return { success: true, action: "created", notionPageId: page.id };
  } catch (error) {
    console.error("Notion task sync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sync a single project to Notion
 * @param {number|string} projectId - ID in v2_projects
 */
export async function syncProject(projectId) {
  if (!isConfigured()) {
    return { skipped: true, reason: "Notion not configured" };
  }

  const projectDbId = process.env.NOTION_PROJECTS_DATABASE_ID;
  if (!projectDbId) {
    return { skipped: true, reason: "NOTION_PROJECTS_DATABASE_ID not set" };
  }

  // Fetch the project with program and PM info
  const res = await db.execute({
    sql: `SELECT p.*, prog.name as program_name, c.name as pm_name
          FROM v2_projects p
          LEFT JOIN v2_programs prog ON p.program_id = prog.id
          LEFT JOIN contacts c ON prog.assigned_pm_id = c.cid
          WHERE p.id = ?`,
    args: [projectId],
  });

  const project = res.rows[0];
  if (!project) return { skipped: true, reason: "Project not found" };

  const properties = projectToProperties(project);

  try {
    const existing = await db.execute({
      sql: "SELECT notion_page_id FROM v2_projects WHERE id = ? AND notion_page_id IS NOT NULL",
      args: [projectId],
    });

    if (existing.rows[0]?.notion_page_id) {
      const { updatePage } = require("./client");
      await updatePage(existing.rows[0].notion_page_id, properties);
      return { success: true, action: "updated" };
    }

    const { createPage } = require("./client");
    const page = await createPage(projectDbId, properties);

    await db.execute({
      sql: "UPDATE v2_projects SET notion_page_id = ? WHERE id = ?",
      args: [page.id, projectId],
    });

    return { success: true, action: "created", notionPageId: page.id };
  } catch (error) {
    console.error("Notion project sync failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Batch sync all pending tasks to Notion
 * Useful for initial bulk sync
 */
export async function syncAllTasks() {
  if (!isConfigured()) return { skipped: true };

  const res = await db.execute({
    sql: `SELECT t.*, p.name as project_name
          FROM tasks t
          LEFT JOIN v2_projects p ON t.project_id = p.id
          WHERE t.notion_page_id IS NULL
          LIMIT 50`,
    args: [],
  });

  const results = [];
  for (const task of res.rows) {
    const result = await syncTask(task.id);
    results.push({ taskId: task.id, ...result });
  }

  return { synced: results.length, results };
}

/**
 * Batch sync all projects to Notion
 */
export async function syncAllProjects() {
  if (!isConfigured()) return { skipped: true };

  const res = await db.execute({
    sql: `SELECT p.*, prog.name as program_name, c.name as pm_name
          FROM v2_projects p
          LEFT JOIN v2_programs prog ON p.program_id = prog.id
          LEFT JOIN contacts c ON prog.assigned_pm_id = c.cid
          WHERE p.notion_page_id IS NULL
          LIMIT 50`,
    args: [],
  });

  const results = [];
  for (const project of res.rows) {
    const result = await syncProject(project.id);
    results.push({ projectId: project.id, ...result });
  }

  return { synced: results.length, results };
}
