import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession, requireProjectAccess } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  createProject,
  upsertProjectLeadMember,
  createProjectAssignmentNotification,
  getProjectsList,
  getProjectMembersForProjects,
  getTaskSummaryByProjectIds,
  getProjectMetaById,
  updateProject,
  deleteProjectLeads,
  upsertProjectLeadMemberOnUpdate,
  deleteProjectMembersByProjectId,
  deleteProjectById,
} from "@/models/projects";

/**
 * PROJECTS API
 *
 * GET   /api/projects?program_id=X&user_cid=X
 * POST  /api/projects
 * PUT   /api/projects
 *
 * Supports:
 * - Creating projects (POST)
 * - Editing projects, archiving (PUT)
 * - Fetching all projects or filtered by program or user assignment (GET)
 */

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("projects", "create");
    if (capError) return capError;
    const body = await req.json();
    const {
      program_id,
      name,
      status,
      description,
      concept_note,
      concept_note_url,
      start_date,
      end_date,
      priority,
      department,
      assigned_pm_id,
      assigned_pm_ids = [],
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Project name is required." },
        { status: 400 },
      );
    }

    // If single lead was passed, add to array
    const leadsToAssign = [...assigned_pm_ids];
    if (assigned_pm_id && !leadsToAssign.includes(assigned_pm_id)) {
      leadsToAssign.push(assigned_pm_id);
    }

    // Assign the first lead as the primary owner_id for legacy compatibility
    const primaryOwnerId = leadsToAssign.length > 0 ? leadsToAssign[0] : null;

    // Build meta with all extra fields
    const meta = JSON.stringify({
      description: description || null,
      concept_note: concept_note || null,
      concept_note_url: concept_note_url || null,
      assigned_pm_id: primaryOwnerId, // legacy fallback
      assigned_pm_ids: leadsToAssign,
    });

    const result = await createProject(
      program_id,
      name,
      status,
      start_date,
      end_date,
      priority,
      meta,
      primaryOwnerId,
    );

    const projectId = result.rows[0]?.id || result.lastInsertRowid;

    // If PM leads were assigned, add them as project members with lead role
    for (const leadId of leadsToAssign) {
      await upsertProjectLeadMember(projectId, leadId);
    }

    // Notify assigned PM leads
    for (const leadId of leadsToAssign) {
      try {
        await createProjectAssignmentNotification(
          leadId,
          "New Project Assignment",
          `You have been assigned as lead for project "${name}".`,
          "project_assignment",
        );
      } catch (notifErr) {
        console.error("Project assignment notification failed:", notifErr.message);
      }
    }

    return NextResponse.json({ success: true, project_id: projectId });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const program_id = searchParams.get("program_id");
    const user_cid = searchParams.get("user_cid");
    const include_archived = searchParams.get("include_archived");
    const session = await getSession();
    const staffSide = [
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
      "developer",
    ];
    let filterCid = user_cid;
    if (!staffSide.includes(session.role)) {
      if (filterCid && String(filterCid) !== String(session.cid)) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only view your own projects.",
          },
          { status: 403 },
        );
      }
      filterCid = filterCid || session.cid;
    }

    const result = await getProjectsList(
      program_id,
      filterCid,
      include_archived,
    );

    // Get all members in a single query instead of N+1
    const projectIds = result.rows.map((r) => r.id);
    let allMembers = [];
    if (projectIds.length > 0) {
      const memberRes = await getProjectMembersForProjects(projectIds);
      allMembers = memberRes.rows || [];
    }

    // Group members by project_id
    const memberMap = {};
    for (const m of allMembers) {
      const pid = String(m.project_id);
      if (!memberMap[pid]) memberMap[pid] = [];
      memberMap[pid].push({ user_cid: m.user_cid, role: m.role });
    }

    // Batch per-project task stats into ONE grouped query instead of one
    // COUNT per project. Produces identical { total, completed } per project.
    const taskMap = {};
    if (projectIds.length > 0) {
      const taskRes = await getTaskSummaryByProjectIds(projectIds);
      for (const r of taskRes.rows || []) taskMap[r.pid] = r;
    }

    const projectsWithStats = result.rows.map((row) => {
      const meta =
        (typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta) ||
        {};
      const pidKey = String(row.id);
      const ts = taskMap[pidKey] || {};
      return {
        ...row,
        meta,
        members: memberMap[pidKey] || [],
        task_summary: {
          total: ts.total || 0,
          completed: ts.completed || 0,
        },
      };
    });

    return NextResponse.json({ success: true, projects: projectsWithStats });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const body = await req.json();
    const {
      id,
      name,
      status,
      description,
      concept_note,
      concept_note_url,
      start_date,
      end_date,
      priority,
      assigned_pm_id,
      assigned_pm_ids,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required." },
        { status: 400 },
      );
    }

    const session = await getSession();
    const staffSide = [
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
      "developer",
    ];
    if (!staffSide.includes(session.role)) {
      const authError = await requireProjectAccess(id);
      if (authError) return authError;
    }

    const updateFields = [];
    const updateArgs = [];

    if (name !== undefined) {
      updateFields.push("name = ?");
      updateArgs.push(name);
    }
    if (status !== undefined) {
      updateFields.push("status = ?");
      updateArgs.push(status);
    }
    if (start_date !== undefined) {
      updateFields.push("start_date = ?");
      updateArgs.push(start_date || null);
    }
    if (end_date !== undefined) {
      updateFields.push("end_date = ?");
      updateArgs.push(end_date || null);
    }
    if (
      priority !== undefined &&
      ["critical", "high", "medium", "low"].includes(priority)
    ) {
      updateFields.push("priority = ?");
      updateArgs.push(priority);
    }

    // If meta fields changed, update the meta JSON
    if (
      description !== undefined ||
      concept_note !== undefined ||
      concept_note_url !== undefined ||
      assigned_pm_id !== undefined ||
      assigned_pm_ids !== undefined
    ) {
      // Fetch current meta
      const current = await getProjectMetaById(id);

      const rawMeta = current.rows[0]?.meta;
      const currentMeta =
        (typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta) || {};

      let leadsToAssign = assigned_pm_ids;
      if (assigned_pm_ids === undefined && assigned_pm_id !== undefined) {
        leadsToAssign = assigned_pm_id ? [assigned_pm_id] : [];
      }

      const primaryOwnerId =
        leadsToAssign && leadsToAssign.length > 0 ? leadsToAssign[0] : null;

      const newMeta = JSON.stringify({
        ...currentMeta,
        ...(description !== undefined ? { description } : {}),
        ...(concept_note !== undefined ? { concept_note } : {}),
        ...(concept_note_url !== undefined ? { concept_note_url } : {}),
        ...(leadsToAssign !== undefined
          ? { assigned_pm_id: primaryOwnerId, assigned_pm_ids: leadsToAssign }
          : {}),
      });

      updateFields.push("meta = ?");
      updateArgs.push(newMeta);

      // Also sync owner_id column with assigned_pm_id
      if (leadsToAssign !== undefined) {
        updateFields.push("owner_id = ?");
        updateArgs.push(primaryOwnerId);
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 },
      );
    }

    updateArgs.push(id);

    await updateProject(updateFields, updateArgs);

    // Update project leads in members table if provided
    if (assigned_pm_ids !== undefined || assigned_pm_id !== undefined) {
      const leadsToAssign =
        assigned_pm_ids !== undefined
          ? assigned_pm_ids
          : assigned_pm_id
            ? [assigned_pm_id]
            : [];
      // Remove existing lead(s)
      await deleteProjectLeads(id);

      // Assign new leads if provided
      for (const leadId of leadsToAssign) {
        await upsertProjectLeadMemberOnUpdate(id, leadId);
      }
    }

    return NextResponse.json({ success: true, action: "updated" });
  } catch (error) {
    console.error("PUT /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("projects", "delete");
    if (capError) return capError;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 },
      );
    }

    // Remove project members first
    await deleteProjectMembersByProjectId(id);

    // Then delete the project
    await deleteProjectById(id);

    return NextResponse.json({ success: true, action: "deleted" });
  } catch (error) {
    console.error("DELETE /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
