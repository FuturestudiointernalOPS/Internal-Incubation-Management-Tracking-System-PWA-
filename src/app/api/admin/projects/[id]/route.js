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
    const projectRes = await getAdminProjectDetails(id);

    if (projectRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    const project = projectRes.rows[0];

    // 2. Task stats
    const taskStats = await getTaskStatsForProject(id);

    // 3. All tasks for this project with assignee info
    const tasksRes = await getTasksForProject(id);

    // Resources/attachments — single batched query for all tasks (Ticket 1.8)
    let resourcesByTask = {};
    const allTaskIds = (tasksRes.rows || []).map((t) => t.id);
    if (allTaskIds.length > 0) {
      try {
        const resourceRes = await getResourcesByTaskIds(allTaskIds);
        for (const r of resourceRes.rows || []) {
          if (!resourcesByTask[r.task_id]) resourcesByTask[r.task_id] = [];
          resourcesByTask[r.task_id].push({
            id: r.id,
            name: r.name,
            url: r.url,
            type: r.type,
            file_name: r.file_name,
            file_size: r.file_size,
            uploaded_by: r.uploaded_by,
          });
        }
      } catch (e) {
        console.error("Failed to fetch task_resources:", e.message);
      }
    }

    // Attach blockers and subtasks to each task — batched into two IN queries
    // instead of 2 DB round-trips PER task. Produces identical per-task
    // `blockers` (ordered created_at DESC) and `subtasks` (created_at ASC)
    // arrays, preserving the original nested shape.
    let blockersByTask = {};
    let subtasksByTask = {};
    if (allTaskIds.length > 0) {
      const [blockerRes, subtaskRes] = await Promise.all([
        getBlockersByTaskIds(allTaskIds),
        getSubtasksByParentTaskIds(allTaskIds),
      ]);
      for (const r of blockerRes.rows || []) {
        const id = String(r.task_id);
        if (!blockersByTask[id]) blockersByTask[id] = [];
        const { task_id, ...rest } = r;
        blockersByTask[id].push(rest);
      }
      for (const r of subtaskRes.rows || []) {
        const id = String(r.task_id);
        if (!subtasksByTask[id]) subtasksByTask[id] = [];
        const { task_id, ...rest } = r;
        subtasksByTask[id].push(rest);
      }
    }

    const tasksWithBlockers = (tasksRes.rows || []).map((task) => {
      return {
        ...task,
        blockers: blockersByTask[String(task.id)] || [],
        subtasks: subtasksByTask[String(task.id)] || [],
        resources: resourcesByTask[task.id] || [],
      };
    });

    // 4. All blockers for this project
    const blockersRes = await getProjectBlockers(id);

    // 5. Team members — union of project_members, v2_project_staff, and task assignees
    const membersRes = await getProjectMembersUnion(id);

    // 6. Activity timeline
    const timelineRes = await getProjectTimeline(id);

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
        blockers: blockersRes.rows || [],
        members: membersRes.rows || [],
        timeline: timelineRes.rows || [],
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
