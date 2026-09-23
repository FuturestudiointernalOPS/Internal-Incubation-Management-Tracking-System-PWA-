import { initDb } from "@/lib/db";
import { requireProjectAccess } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getAdminProjectDetails,
  getTaskStatsForProject,
  getTasksForProject,
  getResourcesByTaskIds,
  getBlockersByTaskIds,
  getSubtasksByParentTaskIds,
  getProjectBlockers,
  getProjectMembersUnion,
  getProjectTimeline,
  countDatedTasksForProject,
} from "@/models/projects";

/**
 * GET /api/admin/projects/[id]
 *
 * Returns a single project with:
 *   - Project details + owner + program name
 *   - Task stats + full task list
 *   - Blocker list
 *   - Team members
 *   - Activity timeline
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const authError = await requireProjectAccess(id);
    if (authError) return authError;

    // 1. Project details with owner and program name
    // NOTE: v2_projects.program_id is INTEGER, v2_programs.id is UUID
    // Cast both to text for compatibility
    const projectResult = await getAdminProjectDetails(id);

    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const project = projectResult.rows[0];

    // 2. Task stats
    const taskStats = await getTaskStatsForProject(id);

    // 3. All tasks for this project with assignee info
    const tasksResult = await getTasksForProject(id);

    // Resources/attachments — single batched query for all tasks (Ticket 1.8)
    let resourcesByTask = {};
    const allTaskIds = (tasksResult.rows || []).map((task) => task.id);
    if (allTaskIds.length > 0) {
      try {
        const resourceResult = await getResourcesByTaskIds(allTaskIds);
        for (const row of resourceResult.rows || []) {
          if (!resourcesByTask[row.task_id]) resourcesByTask[row.task_id] = [];
          resourcesByTask[row.task_id].push({
            id: row.id,
            name: row.name,
            url: row.url,
            type: row.type,
            file_name: row.file_name,
            file_size: row.file_size,
            uploaded_by: row.uploaded_by,
          });
        }
      } catch (error) {
        console.error("Failed to fetch task_resources:", error.message);
      }
    }

    // Attach blockers and subtasks to each task — batched into two IN queries
    // instead of 2 DB round-trips PER task. Produces identical per-task
    // `blockers` (ordered created_at DESC) and `subtasks` (created_at ASC)
    // arrays, preserving the original nested shape.
    let blockersByTask = {};
    let subtasksByTask = {};
    if (allTaskIds.length > 0) {
      const [blockerResult, subtaskResult] = await Promise.all([
        getBlockersByTaskIds(allTaskIds),
        getSubtasksByParentTaskIds(allTaskIds),
      ]);
      for (const row of blockerResult.rows || []) {
        const id = String(row.task_id);
        if (!blockersByTask[id]) blockersByTask[id] = [];
        const { task_id: _task_id, ...rest } = row;
        blockersByTask[id].push(rest);
      }
      for (const row of subtaskResult.rows || []) {
        const id = String(row.task_id);
        if (!subtasksByTask[id]) subtasksByTask[id] = [];
        const { task_id: _task_id, ...rest } = row;
        subtasksByTask[id].push(rest);
      }
    }

    const tasksWithBlockers = (tasksResult.rows || []).map((task) => {
      return {
        ...task,
        blockers: blockersByTask[String(task.id)] || [],
        subtasks: subtasksByTask[String(task.id)] || [],
        resources: resourcesByTask[task.id] || [],
      };
    });

    // 4. All blockers for this project
    const blockersResult = await getProjectBlockers(id);

    // 5. Team members — union of project_members, v2_project_staff, and task assignees
    const membersResult = await getProjectMembersUnion(id);

    // 6. Activity timeline
    const timelineResult = await getProjectTimeline(id);

    // 7. Count dated tasks for timeline health
    let datedCount = 0;
    try {
      const datedTasks = await countDatedTasksForProject(id);
      datedCount = datedTasks.rows[0]?.count || 0;
    } catch (_) {
      datedCount = 0;
    }

    const taskStatsRow = taskStats.rows[0] || {
      total: 0,
      completed: 0,
      in_progress: 0,
      blocked: 0,
      carried_over: 0,
      pending: 0,
    };
    const total = taskStatsRow.total || 0;
    const completed = taskStatsRow.completed || 0;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;
    const timelineHealth =
      total > 0 ? Math.round((datedCount / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        taskStats: taskStatsRow,
        tasks: tasksWithBlockers,
        blockers: blockersResult.rows || [],
        members: membersResult.rows || [],
        timeline: timelineResult.rows || [],
        completionRate,
        timelineHealth,
      },
    });
  } catch (error) {
    console.error("GET admin/projects/[id] error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
