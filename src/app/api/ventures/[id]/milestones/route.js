import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession } from "@/lib/auth";
import {
  listMilestones, getMilestone, createMilestone, updateMilestone, deleteMilestone,
  listDeliverables, getDeliverable, createDeliverable, updateDeliverable, deleteDeliverable,
  MILESTONE_STATUSES, DELIVERABLE_STATUSES, DELIVERABLE_TYPES,
} from "@/lib/ventures";

/**
 * GET /api/ventures/[id]/milestones[?project_id=xxx]
 * POST /api/ventures/[id]/milestones — create milestone
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = params;
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");
  const milestones = await listMilestones(id, projectId);
  return NextResponse.json({ success: true, milestones });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = params;
  const body = await req.json();
  const { title, description, priority, due_date, owner_cid, assigned_members, display_order } = body;

  if (!title?.trim()) return NextResponse.json({ success: false, error: "Milestone title is required." }, { status: 400 });

  try {
    const result = await createMilestone({
      ventureId: id, projectId: body.project_id, title, description, priority, dueDate: due_date,
      ownerCid: owner_cid, assignedMembers: assigned_members, displayOrder: display_order,
      createdBy: req.session?.cid,
    });
    const milestone = await getMilestone(result.id);
    return NextResponse.json({ success: true, milestone });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 400 });
  }
});

// ─── SINGLE MILESTONE ROUTES ───────────────────────────────────────────────

export const PATCH = createHandler(async (req, { params }) => {
  const { searchParams } = new URL(req.url);
  const mid = searchParams.get("id");
  if (!mid) return NextResponse.json({ success: false, error: "Milestone ID required." }, { status: 400 });

  const existing = await getMilestone(parseInt(mid));
  if (!existing) return NextResponse.json({ success: false, error: "Milestone not found." }, { status: 404 });

  const body = await req.json();
  await updateMilestone(parseInt(mid), body);
  const milestone = await getMilestone(parseInt(mid));
  return NextResponse.json({ success: true, milestone });
});

export const DELETE = createHandler(async (req, { params }) => {
  const { searchParams } = new URL(req.url);
  const mid = searchParams.get("id");
  if (!mid) return NextResponse.json({ success: false, error: "Milestone ID required." }, { status: 400 });

  await deleteMilestone(parseInt(mid));
  return NextResponse.json({ success: true });
});

// ─── DELIVERABLE SUB-ROUTES (via query params) ─────────────────────────────

export const PUT = createHandler(async (req, { params }) => {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const did = searchParams.get("deliverable_id");
  const body = await req.json();
  const session = req.session;

  if (action === "create_deliverable") {
    const { id } = params;
    const { milestone_id, title, description, deliverable_type, due_date, assigned_cid } = body;
    if (!milestone_id) return NextResponse.json({ success: false, error: "milestone_id required." }, { status: 400 });
    if (!title?.trim()) return NextResponse.json({ success: false, error: "Deliverable title required." }, { status: 400 });

    const result = await createDeliverable({
      milestoneId: parseInt(milestone_id), ventureId: id, title, description,
      deliverableType: deliverable_type, dueDate: due_date, assignedCid: assigned_cid,
      createdBy: session?.cid,
    });
    const del = await getDeliverable(result.id);
    return NextResponse.json({ success: true, deliverable: del });
  }

  if (action === "update_deliverable" && did) {
    await updateDeliverable(parseInt(did), body, session?.cid, session?.name);
    const del = await getDeliverable(parseInt(did));
    return NextResponse.json({ success: true, deliverable: del });
  }

  if (action === "delete_deliverable" && did) {
    await deleteDeliverable(parseInt(did));
    return NextResponse.json({ success: true });
  }

  if (action === "get_deliverables" && did) {
    const deliverables = await listDeliverables(parseInt(did));
    return NextResponse.json({ success: true, deliverables });
  }

  return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
});
