import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth, getSession, requireProjectAccess } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import {
  createProjectWithLeads,
  listProjects,
  updateProjectRecord,
  deleteProjectRecord,
} from "@/services/projects/workspace";
import { needsProjectObjectCheck } from "@/services/projects/access";

/**
 * PROJECTS API — controller layer.
 *
 * GET   /api/projects?program_id=X&user_cid=X&include_archived=true
 * POST  /api/projects
 * PUT   /api/projects
 * DELETE /api/projects?id=X
 *
 * This route only authenticates, validates the request shape and shapes the
 * HTTP answer. The use cases — who may see the portfolio, how leads resolve, how
 * `meta` merges, the order of the writes, and who may change WHICH project —
 * live in `@/services/projects` (see docs/LAYER_SPLIT.md).
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
      assigned_pm_id,
      assigned_pm_ids,
    } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Project name is required." },
        { status: 400 },
      );
    }

    const { projectId } = await createProjectWithLeads({
      programId: program_id,
      name,
      status,
      description,
      conceptNote: concept_note,
      conceptNoteUrl: concept_note_url,
      startDate: start_date,
      endDate: end_date,
      priority,
      assignedPmId: assigned_pm_id,
      assignedPmIds: assigned_pm_ids,
    });

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
    const session = await getSession();

    const result = await listProjects({
      programId: searchParams.get("program_id"),
      role: session.role,
      sessionCid: session.cid,
      requestedCid: searchParams.get("user_cid"),
      includeArchived: searchParams.get("include_archived"),
    });

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, projects: result.projects });
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required." },
        { status: 400 },
      );
    }

    // Object-level authorization: a caller outside the portfolio roles must own
    // or belong to the project before editing it.
    const session = await getSession();
    if (needsProjectObjectCheck({ role: session?.role })) {
      const accessError = await requireProjectAccess(id);
      if (accessError) return accessError;
    }

    const result = await updateProjectRecord({ id, patch: body });
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ success: true, action: result.action });
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

    // Object-level authorization: `projects.delete` is a global capability, so a
    // non-staff holder must own or belong to the project before destroying it.
    const session = await getSession();
    if (needsProjectObjectCheck({ role: session?.role })) {
      const accessError = await requireProjectAccess(id);
      if (accessError) return accessError;
    }

    await deleteProjectRecord(id);

    return NextResponse.json({ success: true, action: "deleted" });
  } catch (error) {
    console.error("DELETE /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}