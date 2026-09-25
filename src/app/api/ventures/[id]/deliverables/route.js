import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import { canDefineDeliverables, canReviewDeliverable } from "@/lib/ventureDeliverables";
import { canManageMilestones, syncMilestoneStatusFromDeliverables } from "@/lib/ventureMilestoneEngine";
import { dateOrNull, textOrNull } from "@/lib/ventureInput";
import { listDeliverables, createDeliverable, updateDeliverable, getDeliverable, notifyVentureFounders } from "@/lib/ventures";

/**
 * Deliverable management — a deliverable always belongs to a milestone, and a
 * milestone always belongs to a Journey.
 *
 *   GET    ?milestone_id=…   list (any Venture viewer)
 *   POST                     create  { milestone_id, title, description?,
 *                                      deliverable_type?, due_date? }
 *                            → Lead Manager / Super Admin
 *   PATCH  { id, action }    update  → Lead Manager / Super Admin
 *                            submit  → the Venture side (Venture access)
 *                            review  → Lead Manager / Super Admin, or a staff
 *                                      member scoped to that milestone
 *
 * Capability layer: the `ventures` module. There is no `milestones` capability
 * module in the catalog, so gating on one denies every non-Super-Admin actor
 * before the authority check can run. The module check is deliberately coarse —
 * canDefineDeliverables / canReviewDeliverable decide the real authority.
 */

async function resolveDbId(id) {
  const ventureResult = await db
    .execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] })
    .catch(() => ({ rows: [] }));
  return ventureResult.rows?.[0]?.id || null;
}

/** Milestone + its journey stage, verified to belong to this Venture. */
async function loadMilestoneForVenture(dbId, milestoneId) {
  const milestoneResult = await db
    .execute({
      sql: "SELECT id, journey_stage_id FROM venture_milestones WHERE id::text = ? AND venture_id = ?",
      args: [String(milestoneId), dbId],
    })
    .catch(() => ({ rows: [] }));
  return milestoneResult.rows?.[0] || null;
}

export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

  const milestoneId = new URL(req.url).searchParams.get("milestone_id");
  if (!milestoneId) {
    return NextResponse.json({ success: false, error: "milestone_id is required." }, { status: 400 });
  }
  // The milestone must belong to THIS venture; otherwise the listing would
  // hand out another venture's deliverables. Same check the POST path uses.
  const dbId = await resolveDbId(id);
  if (!dbId || !(await loadMilestoneForVenture(dbId, milestoneId))) {
    return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  }
  const deliverables = await listDeliverables(milestoneId).catch(() => []);
  return NextResponse.json({ success: true, deliverables });
});

export const POST = createHandler(async (req, { params }) => {
  const { id } = await params;
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;

  const allowed = await canDefineDeliverables(db, { id, cid: session?.cid, role: session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can add deliverables." },
      { status: 403 },
    );
  }

  const body = await req.json();
  const milestoneId = body?.milestone_id ? String(body.milestone_id) : null;
  const title = String(body?.title || "").trim();
  if (!milestoneId || !title) {
    return NextResponse.json({ success: false, error: "milestone_id and title are required." }, { status: 400 });
  }

  const dbId = await resolveDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const milestone = await loadMilestoneForVenture(dbId, milestoneId);
  if (!milestone) {
    return NextResponse.json({ success: false, error: "Unknown milestone for this Venture." }, { status: 400 });
  }

  const created = await createDeliverable({
    milestoneId: milestone.id,
    ventureId: dbId,
    title,
    description: body?.description || null,
    deliverableType: body?.deliverable_type || "document",
    dueDate: body?.due_date || null,
    assignedCid: body?.assigned_cid || null,
    createdBy: session?.cid || null,
  });

  try {
    const { addVentureHistory } = await import("@/lib/ventures");
    await addVentureHistory({
      venture_id: id,
      event_type: "DELIVERABLE_ADDED",
      description: `Deliverable "${title}" added to a milestone`,
    });
  } catch (_) {}

  return NextResponse.json({ success: true, id: created?.id || null });
});

export const PATCH = createHandler(async (req, { params }) => {
  const { id } = await params;
  const body = await req.json();
  const deliverableId = body?.id ? String(body.id) : null;
  const action = String(body?.action || "update");
  if (!deliverableId) return NextResponse.json({ success: false, error: "id is required." }, { status: 400 });

  const existing = await getDeliverable(deliverableId).catch(() => null);
  if (!existing) return NextResponse.json({ success: false, error: "Deliverable not found" }, { status: 404 });

  const dbId = await resolveDbId(id);
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
  const milestone = await loadMilestoneForVenture(dbId, existing.milestone_id);
  if (!milestone) {
    return NextResponse.json({ success: false, error: "Unknown milestone for this Venture." }, { status: 400 });
  }

  // ── submit: the Venture side supplies the evidence ───────────────────────
  if (action === "submit") {
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const evidenceUrl = String(body?.attachment_url || "").trim();
    if (!evidenceUrl) {
      return NextResponse.json({ success: false, error: "An evidence file or link is required." }, { status: 400 });
    }
    await updateDeliverable(
      deliverableId,
      {
        attachment_url: evidenceUrl,
        attachment_name: body?.attachment_name || null,
        status: "submitted",
        approval_status: null,
      },
      session?.cid || null,
      session?.name || null,
    );
    // The evidence is in: the milestone's OWN status follows its deliverables
    // (a submission moves it to "awaiting review"). A submission is the
    // founder's act, so it can never COMPLETE the milestone — `canComplete` is
    // false and the sign-off stays with the Lead Manager.
    const milestoneSync = await syncMilestoneStatusFromDeliverables(db, {
      dbId,
      milestoneId: milestone.id,
      cid: session?.cid || null,
      canComplete: false,
    });
    return NextResponse.json({ success: true, milestone_status: milestoneSync.status || null });
  }

  // ── review: Lead Manager / Super Admin, or a scoped staff member ─────────
  if (action === "review") {
    // `ventures.view` on purpose: a scoped coach may hold view without edit, and
    // canReviewDeliverable below fails closed unless an assignment scope covers
    // this milestone. Keep the capability coarse; the scope check is the gate.
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;

    const allowed = await canReviewDeliverable(db, {
      id,
      cid: session?.cid,
      role: session?.role,
      milestoneId: milestone.id,
      journeyStageId: milestone.journey_stage_id,
    });
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Your assignment does not cover this milestone's review." },
        { status: 403 },
      );
    }

    const decision = body?.decision === "approved" ? "approved" : body?.decision === "changes_requested" ? "changes_requested" : null;
    if (!decision) {
      return NextResponse.json({ success: false, error: "decision (approved|changes_requested) is required." }, { status: 400 });
    }
    const comments = String(body?.comments || "").trim() || null;
    if (decision === "changes_requested" && !comments) {
      return NextResponse.json({ success: false, error: "Comments are required when requesting changes." }, { status: 400 });
    }

    await updateDeliverable(
      deliverableId,
      {
        // "changes_requested" is stored as a rejected review with a reason.
        approval_status: decision === "approved" ? "approved" : "rejected",
        rejection_reason: decision === "approved" ? null : comments,
        reviewer_cid: session?.cid || null,
        reviewer_name: session?.name || null,
      },
      session?.cid || null,
      session?.name || null,
    );

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "DELIVERABLE_REVIEWED",
        description: `Deliverable "${existing.title}" ${decision === "approved" ? "approved" : "sent back for changes"}`,
      });
    } catch (_) {}

    // The review moves the milestone's own status with the work: approving some
    // evidence puts it In Progress, returning some puts it Changes Requested,
    // and the LAST approval closes it — but closing a milestone stays the Lead
    // Manager / Super Admin's decision (the same authority the manual complete
    // action requires); a scoped coach's approval stops at In Progress.
    const canCompleteMilestone = await canManageMilestones(db, { id, cid: session?.cid, role: session?.role });
    const milestoneSync = await syncMilestoneStatusFromDeliverables(db, {
      dbId,
      milestoneId: milestone.id,
      cid: session?.cid || null,
      canComplete: canCompleteMilestone,
    });

    if (milestoneSync.status === "completed") {
      try {
        await notifyVentureFounders(
          dbId,
          "Milestone approved",
          `The milestone "${milestoneSync.milestone_title || ""}" has been completed and approved.`,
          { journey_stage_id: milestone.journey_stage_id || null, milestone_id: milestone.id },
          { templateKey: "venture.notif.milestoneApproved", params: { milestoneTitle: milestoneSync.milestone_title || "" }, dedupeKey: `milestone-completed:${milestone.id}` },
        );
      } catch (_) {}
      try {
        const { addVentureHistory } = await import("@/lib/ventures");
        await addVentureHistory({
          venture_id: id,
          event_type: "MILESTONE_COMPLETED",
          description: `Milestone "${milestoneSync.milestone_title || milestone.id}" completed — every deliverable approved`,
        });
      } catch (_) {}

      if (milestoneSync.journey_completed) {
        try {
          await notifyVentureFounders(
            dbId,
            "Journey completed",
            `All milestones in "${milestoneSync.journey?.name || "your journey"}" are completed.`,
            { journey_stage_id: milestone.journey_stage_id || null },
            {
              templateKey: "venture.notif.journeyCompleted",
              params: { stageName: milestoneSync.journey?.name || "" },
              dedupeKey: `journey-completed:${milestone.journey_stage_id}`,
            },
          );
        } catch (_) {}
        try {
          const { addVentureHistory } = await import("@/lib/ventures");
          await addVentureHistory({
            venture_id: id,
            event_type: "JOURNEY_COMPLETED",
            description: `Journey "${milestoneSync.journey?.name || ""}" completed — all milestones are done${milestoneSync.journey?.next_stage_id ? "; the next journey is now active" : ""}`,
          });
        } catch (_) {}
      }
    }

    // `journey_completed` is additive, exactly as the milestone PATCH returns it.
    return NextResponse.json({
      success: true,
      decision,
      milestone_status: milestoneSync.status || null,
      journey_completed: Boolean(milestoneSync.journey_completed),
      journey: milestoneSync.journey || null,
    });
  }

  // ── update: the definition, managers only ───────────────────────────────
  const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
  if (access.error) return access.error;
  const { session } = access;

  const allowed = await canDefineDeliverables(db, { id, cid: session?.cid, role: session?.role });
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Only the Venture's Lead Manager or a Super Admin can edit deliverables." },
      { status: 403 },
    );
  }

  const updates = {};
  for (const field of ["title", "description", "deliverable_type", "due_date", "assigned_cid"]) {
    if (body?.[field] === undefined) continue;
    // A cleared date arrives as "" — Postgres rejects that in a date column.
    if (field === "due_date") updates[field] = dateOrNull(body[field]);
    else if (field === "assigned_cid") updates[field] = textOrNull(body[field]);
    else updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: "No fields to update" }, { status: 400 });
  }

  await updateDeliverable(deliverableId, updates, session?.cid || null, session?.name || null);
  return NextResponse.json({ success: true });
});
