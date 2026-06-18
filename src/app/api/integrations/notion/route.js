import { NextResponse } from "next/server";
import {
  syncTask,
  syncProject,
  syncAllTasks,
  syncAllProjects,
} from "@/lib/integrations/notion/sync";
import { isConfigured, getDatabase } from "@/lib/integrations/notion/client";

/**
 * GET /api/integrations/notion?action=health
 *   - Check if Notion integration is configured
 *
 * POST /api/integrations/notion
 *   { action: "sync-task", taskId: 123 }
 *   - Sync a specific task to Notion
 *
 * POST /api/integrations/notion
 *   { action: "sync-project", projectId: "uuid" }
 *   - Sync a specific project to Notion
 *
 * POST /api/integrations/notion
 *   { action: "sync-all-tasks" }
 *   - Bulk sync all unsynced tasks
 *
 * POST /api/integrations/notion
 *   { action: "sync-all-projects" }
 *   - Bulk sync all unsynced projects
 */

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "health";

  if (action === "health") {
    const configured = isConfigured();
    let dbInfo = null;

    if (configured) {
      try {
        const tasksDb = await getDatabase(process.env.NOTION_TASKS_DATABASE_ID);
        dbInfo = {
          tasksDatabase: tasksDb.title?.[0]?.plain_text || "Connected",
        };
        if (process.env.NOTION_PROJECTS_DATABASE_ID) {
          const projDb = await getDatabase(
            process.env.NOTION_PROJECTS_DATABASE_ID,
          );
          dbInfo.projectsDatabase = projDb.title?.[0]?.plain_text || "Connected";
        }
      } catch (e) {
        dbInfo = { error: e.message };
      }
    }

    return NextResponse.json({
      success: true,
      configured,
      env: {
        hasApiKey: !!process.env.NOTION_API_KEY,
        hasTasksDb: !!process.env.NOTION_TASKS_DATABASE_ID,
        hasProjectsDb: !!process.env.NOTION_PROJECTS_DATABASE_ID,
      },
      ...(dbInfo && { databases: dbInfo }),
    });
  }

  return NextResponse.json(
    { success: false, error: "Unknown action" },
    { status: 400 },
  );
}

export async function POST(req) {
  try {
    const { action, taskId, projectId } = await req.json();

    switch (action) {
      case "sync-task": {
        if (!taskId) {
          return NextResponse.json(
            { success: false, error: "taskId required" },
            { status: 400 },
          );
        }
        const result = await syncTask(taskId);
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-project": {
        if (!projectId) {
          return NextResponse.json(
            { success: false, error: "projectId required" },
            { status: 400 },
          );
        }
        const result = await syncProject(projectId);
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-all-tasks": {
        const result = await syncAllTasks();
        return NextResponse.json({ success: true, ...result });
      }

      case "sync-all-projects": {
        const result = await syncAllProjects();
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Notion integration API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
