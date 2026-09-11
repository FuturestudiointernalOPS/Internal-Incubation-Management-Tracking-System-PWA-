import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import {
  ensureJourneyTable,
  resolveVentureInternalId,
  listJourneyStages,
  getJourneyStage,
  nextJourneyStageOrder,
  moveJourneyStage,
  deleteJourneyStage,
} from "@/lib/ventureJourneys";

export const dynamic = "force-dynamic";

/**
 * Venture Journey API.
 *
 * The Journey is Venture-facing but staff-defined: it is NOT a hardcoded
 * curriculum. Authorized staff (holding `operating_plan` capabilities on a
 * venture-wide assignment — or a global role) define the stages for the
 * specific Venture. Venture members read the published stages.
 *
 *   GET    — published stages (anyone with Venture access) + author flags
 *            (only returned to authorized staff)
 *   POST   — add a stage { name, description?, objective?, target_date? }
 *   PATCH  — stage management { action, stage_id, ... }:
 *            update | activate | lock | complete | reset | delete | move
 */

async function getViewerSession() {
  return getSession();
}

/** Shared write-gate: staff instrument only (operating_plan area). */
async function requireStaffJourneyAccess(id) {
  const session = await getViewerSession();
  if (!session) return { session: null, access: null };
  const access = await resolvePlanAccess(db, id, session);
  if (!access.ok) return { session, access: null };
  return { session, access };
}

async function resolveDbId(id) {
  await ensureJourneyTable(db);
  return resolveVentureInternalId(db, id);
}

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    // Management surfaces (staff) may request archived journeys; the
    // Venture-facing read never includes them.
    const wantArchived = new URL(req.url).searchParams.get("include_archived") === "1";

    // Author flags for staff surfaces only (members never receive them).
    let access = null;
    const viewer = await getViewerSession();
    if (viewer) {
      const planAccess = await resolvePlanAccess(db, id, viewer);
      if (planAccess.ok) {
        const [canCreate, canEdit, canManage] = await Promise.all([
          allowsPlanAction(db, planAccess, "create"),
          allowsPlanAction(db, planAccess, "edit"),
          allowsPlanAction(db, planAccess, "manage"),
        ]);
        access = { create: canCreate, edit: canEdit, manage: canManage };
      }
    }

    const stages = await listJourneyStages(db, dbId, {
      includeArchived: wantArchived && Boolean(access && access.manage),
    });

    // Phase 2 spine: attach the milestones bound to each stage so the Journey
    // timeline can show stage -> milestone progress. Venture-facing data only
    // (milestones are visible to members through their own tools). Defensive:
    // if the additive columns are missing the stage list still renders.
    const milestoneRes = await db.execute({
      sql: `SELECT id, title, status, progress, target_date, journey_stage_id
            FROM venture_milestones
            WHERE venture_id = ? AND journey_stage_id IS NOT NULL
            ORDER BY COALESCE(display_order, 0), created_at ASC`,
      args: [dbId],
    }).catch(() => ({ rows: [] }));
    const milestonesByStage = {};
    for (const m of milestoneRes.rows || []) {
      const key = String(m.journey_stage_id);
      (milestonesByStage[key] = milestonesByStage[key] || []).push(m);
    }
    for (const stage of stages) {
      const list = milestonesByStage[stage.id] || [];
      stage.milestones = list;
      stage.milestone_counts = {
        total: list.length,
        completed: list.filter((m) => m.status === "completed").length,
      };
    }

    // Guided experience (Vinance 3 — Phase 2): non-staff viewers (founders /
    // team / participant) only ever see what the staff made available to them.
    // Locked stages are the future roadmap — management strategy, not
    // Venture-facing information. Staff and global roles always see the full
    // roadmap through the authoring surfaces.
    if (!access && viewer && !roleIsPrivileged(viewer.role)) {
      const visibleStages = stages
        .filter((s) => s.status !== "locked")
        .map((s) => {
          // Phase 3: milestones still locked inside a released stage are not
          // visible either — only completed/current work is Venture-facing.
          const visibleMilestones = (s.milestones || []).filter((m) => m.status !== "locked");
          return {
            ...s,
            milestones: visibleMilestones,
            milestone_counts: {
              total: visibleMilestones.length,
              completed: visibleMilestones.filter((m) => m.status === "completed").length,
            },
          };
        });
      return NextResponse.json({
        success: true,
        stages: visibleStages,
        access,
        guided: true,
      });
    }

    return NextResponse.json({ success: true, stages, access });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { id } = await params;
    const { session, access } = await requireStaffJourneyAccess(id);
    if (!session || !access) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (!(await allowsPlanAction(db, access, "create"))) {
      return NextResponse.json({ success: false, error: "Your assignment does not allow defining this Venture's journey." }, { status: 403 });
    }

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ success: false, error: "name is required." }, { status: 400 });

    const existing = await db.execute({
      sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?",
      args: [dbId],
    });
    const count = Number(existing.rows?.[0]?.n || 0);
    const stageOrder = await nextJourneyStageOrder(db, dbId);
    const status = count === 0 ? "active" : "locked";
    const targetDate = body.target_date ? String(body.target_date).slice(0, 10) : null;

    const ins = await db.execute({
      sql: `INSERT INTO venture_journey_stages (venture_id, name, description, objective, target_date, stage_order, status)
            VALUES (?,?,?,?,?,?,?) RETURNING id`,
      args: [dbId, name, body.description || null, body.objective || null, targetDate, stageOrder, status],
    });

    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: id, event_type: "JOURNEY_STAGE_ADDED", description: `Journey stage "${name}" added` });
    } catch (_) {}

    // Managers keep their Archived view in sync: archived rows are returned
    // only to callers holding the manage capability (same rule as GET).
    const canManage = await allowsPlanAction(db, access, "manage");
    const stages = await listJourneyStages(db, dbId, { includeArchived: canManage });
    return NextResponse.json({ success: true, stage: stages.find((s) => s.id === ins.rows?.[0]?.id) || null, stages });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { session, access } = await requireStaffJourneyAccess(id);
    if (!session || !access) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const dbId = await resolveDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const body = await req.json();
    const action = String(body.action || "");
    const stageId = body.stage_id ? String(body.stage_id) : null;

    // ── Field edits ──
    if (action === "update") {
      if (!(await allowsPlanAction(db, access, "edit"))) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow editing this Venture's journey." }, { status: 403 });
      }
      if (!stageId) return NextResponse.json({ success: false, error: "stage_id is required." }, { status: 400 });
      const stage = await getJourneyStage(db, dbId, stageId);
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });

      const name = body.name !== undefined ? String(body.name).trim() : null;
      if (name === "") return NextResponse.json({ success: false, error: "name cannot be empty." }, { status: 400 });
      const targetDate = body.target_date !== undefined ? (body.target_date ? String(body.target_date).slice(0, 10) : null) : undefined;

      await db.execute({
        sql: `UPDATE venture_journey_stages SET
                name = COALESCE(?, name),
                description = CASE WHEN ? = 1 THEN ? ELSE description END,
                objective = CASE WHEN ? = 1 THEN ? ELSE objective END,
                target_date = CASE WHEN ? = 1 THEN ?::date ELSE target_date END
              WHERE id = ? AND venture_id = ?`,
        args: [
          name, body.description !== undefined ? 1 : 0, body.description !== undefined ? body.description : null,
          body.objective !== undefined ? 1 : 0, body.objective !== undefined ? body.objective : null,
          targetDate !== undefined ? 1 : 0, targetDate !== undefined ? targetDate : null,
          stageId, dbId,
        ],
      });
      const canManage = await allowsPlanAction(db, access, "manage");
      const stages = await listJourneyStages(db, dbId, { includeArchived: canManage });
      return NextResponse.json({ success: true, stages });
    }

    // ── Management actions (status transitions, delete, move, template) ──
    const manageActions = ["activate", "lock", "complete", "reset", "delete", "move"];
    if (manageActions.includes(action)) {
      if (!(await allowsPlanAction(db, access, "manage"))) {
        return NextResponse.json({ success: false, error: "Your assignment does not allow managing this Venture's journey." }, { status: 403 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
    }

    const stage = stageId ? await getJourneyStage(db, dbId, stageId) : null;

    if (action === "activate") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      if (stage.status === "completed") {
        return NextResponse.json({ success: false, error: "Completed stages are not reactivated directly — reset the stage first." }, { status: 400 });
      }
      await db.transaction(async (query) => {
        await query("UPDATE venture_journey_stages SET status = 'locked' WHERE venture_id = ? AND status = 'active'", [dbId]);
        await query("UPDATE venture_journey_stages SET status = 'active' WHERE id = ? AND venture_id = ?", [stageId, dbId]);
      });
    } else if (action === "lock") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      if (stage.status === "completed") {
        return NextResponse.json({ success: false, error: "Completed stages cannot be locked — reset the stage first." }, { status: 400 });
      }
      await db.execute({
        sql: "UPDATE venture_journey_stages SET status = 'locked', completed_at = NULL, approved_by = NULL WHERE id = ? AND venture_id = ?",
        args: [stageId, dbId],
      });
    } else if (action === "complete") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      if (stage.status === "completed") return NextResponse.json({ success: false, error: "Stage is already completed." }, { status: 400 });
      await db.transaction(async (query) => {
        await query(
          "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ? AND venture_id = ?",
          [session.cid || null, stageId, dbId],
        );
        // Unlock the next scheduled stage so the Venture always has a current one.
        await query(
          "UPDATE venture_journey_stages SET status = 'active' WHERE venture_id = ? AND stage_order = ? AND status = 'locked'",
          [dbId, stage.stage_order + 1],
        );
      });
      try {
        const { notifyAndEmailVentureFounders } = await import("@/lib/ventureNotify");
        await notifyAndEmailVentureFounders(db, {
          dbId,
          title: "Stage Completed",
          message: `"${stage.name}" has been marked as completed.`,
          emailSubject: "Your Journey milestone was completed",
          emailLines: [
            `Your Journey milestone "${stage.name}" has been marked as completed.`,
            "Log in to ImpactOS to see what is next in your Journey.",
          ],
          context: { journey_stage_id: stage.id },
          templateKey: "venture.notif.stageCompleted",
          params: { stageName: stage.name },
          dedupeKey: `journey-stage-complete:${stage.id}`,
        });
      } catch (_) {}
    } else if (action === "reset") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      await db.transaction(async (query) => {
        await query(
          "UPDATE venture_journey_stages SET status = 'locked', completed_at = NULL, approved_by = NULL WHERE venture_id = ? AND stage_order >= ?",
          [dbId, stage.stage_order],
        );
        await query("UPDATE venture_journey_stages SET status = 'active' WHERE id = ? AND venture_id = ?", [stageId, dbId]);
      });
    } else if (action === "delete") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      await deleteJourneyStage(db, { dbId, stageId });
    } else if (action === "move") {
      if (!stage) return NextResponse.json({ success: false, error: "Stage not found" }, { status: 404 });
      const direction = String(body.direction || "");
      if (!["up", "down"].includes(direction)) {
        return NextResponse.json({ success: false, error: "direction (up|down) is required." }, { status: 400 });
      }
      const moved = await moveJourneyStage(db, { dbId, stageId, direction });
      if (moved.error) return NextResponse.json({ success: false, error: moved.error }, { status: 400 });
    }

    // Reached only after the manage gate above — safe to include archived rows.
    const stages = await listJourneyStages(db, dbId, { includeArchived: true });
    return NextResponse.json({ success: true, stages });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
