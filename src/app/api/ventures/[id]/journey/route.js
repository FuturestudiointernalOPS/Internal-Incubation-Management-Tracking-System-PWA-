import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";
import { resolvePlanAccess, allowsPlanAction } from "@/lib/ventureOperatingPlans";
import { roleIsPrivileged } from "@/lib/ventureAuth";
import { canManageMilestones, releaseFirstMilestoneForStage } from "@/lib/ventureMilestoneEngine";
import { evidenceDownloadUrl, isExternalEvidenceLink } from "@/lib/ventureEvidence";
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

    // Milestone STRUCTURE authority (add / remove / duplicate / reorder) is
    // Lead Manager or Super Admin only — the panel hides those controls when
    // this is false. Never granted to members.
    let milestoneAuthority = false;
    if (viewer) {
      milestoneAuthority = await canManageMilestones(db, { id, cid: viewer.cid, role: viewer.role });
    }

    // Phase 2 spine: attach the milestones bound to each stage so the Journey
    // timeline can show stage -> milestone progress. Venture-facing data only
    // (milestones are visible to members through their own tools). Defensive:
    // if the additive columns are missing the stage list still renders.
    const milestoneRes = await db.execute({
      sql: `SELECT id, title, description, objective, status, progress, target_date,
                   priority, display_order, created_at, journey_stage_id
            FROM venture_milestones
            WHERE venture_id = ? AND journey_stage_id IS NOT NULL
            ORDER BY COALESCE(display_order, 0), created_at ASC`,
      args: [dbId],
    }).catch(() =>
      db.execute({
        sql: `SELECT id, title, status, progress, target_date, journey_stage_id
              FROM venture_milestones
              WHERE venture_id = ? AND journey_stage_id IS NOT NULL
              ORDER BY COALESCE(display_order, 0), created_at ASC`,
        args: [dbId],
      }).catch(() => ({ rows: [] })),
    );
    const milestonesByStage = {};
    for (const m of milestoneRes.rows || []) {
      const key = String(m.journey_stage_id);
      (milestonesByStage[key] = milestonesByStage[key] || []).push(m);
    }

    // Deliverables attached to each milestone (evidence submitted by the
    // Venture, reviewed by the Lead Manager / a scoped coach). Guarded so a
    // database without the table still renders the journey.
    const boundMilestoneIds = Object.values(milestonesByStage)
      .flat()
      .map((m) => String(m.id));
    const deliverablesByMilestone = {};
    if (boundMilestoneIds.length > 0) {
      const dvRes = await db
        .execute({
          sql: `SELECT id, milestone_id, title, description, deliverable_type, status, approval_status,
                       due_date, attachment_url, attachment_name, rejection_reason, reviewer_name
                FROM venture_deliverables
                WHERE milestone_id::text = ANY(?)
                ORDER BY created_at ASC`,
          args: [boundMilestoneIds],
        })
        .catch(() => ({ rows: [] }));
      for (const dv of dvRes.rows || []) {
        const key = String(dv.milestone_id);
        (deliverablesByMilestone[key] = deliverablesByMilestone[key] || []).push(dv);
      }
      // Private evidence: a storage path is signed per read (1h), while an
      // external link the author pasted passes through untouched. Only viewers
      // who already passed this Venture read ever receive a usable URL.
      await Promise.all(
        Object.values(deliverablesByMilestone)
          .flat()
          .map(async (dv) => {
            if (!dv.attachment_url) return;
            dv.evidence_download_url = isExternalEvidenceLink(dv.attachment_url)
              ? dv.attachment_url
              : await evidenceDownloadUrl(dv.attachment_url);
          }),
      );
    }

    // Template provenance: stages generated from a reusable template carry a
    // (type, id) stamp — resolve the current template name for the UI banner.
    const stamped = stages.find((s) => s.source_template_id);
    let templateSource = null;
    if (stamped && stamped.source_template_id) {
      const srcType = stamped.source_template_type === "journey" ? "journey" : "plan";
      const table = srcType === "journey" ? "venture_journey_templates" : "venture_plan_templates";
      try {
        const tplRes = await db.execute({
          sql: `SELECT name FROM ${table} WHERE id = ?`,
          args: [stamped.source_template_id],
        }).catch(() => ({ rows: [] }));
        const tpl = tplRes.rows?.[0];
        if (tpl) templateSource = { type: srcType, id: stamped.source_template_id, name: tpl.name || null };
      } catch (_) {}
    }

    for (const stage of stages) {
      const list = milestonesByStage[stage.id] || [];
      stage.milestones = list;
      for (const m of list) {
        m.deliverables = deliverablesByMilestone[String(m.id)] || [];
      }
      stage.milestone_counts = {
        total: list.length,
        completed: list.filter((m) => m.status === "completed").length,
      };
      // Provenance is surfaced once at the top level — never per-stage.
      delete stage.source_template_type;
      delete stage.source_template_id;
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
        template_source: templateSource,
        milestone_authority: milestoneAuthority,
      });
    }

    return NextResponse.json({ success: true, stages, access, template_source: templateSource, milestone_authority: milestoneAuthority });
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
      // The journey is now active — its first milestone becomes available.
      await releaseFirstMilestoneForStage(db, { dbId, stageId });
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
      // If completing this journey activated the next one, release its first
      // milestone (the chain continues into the new journey).
      const nextStageRes = await db
        .execute({
          sql: "SELECT id FROM venture_journey_stages WHERE venture_id = ? AND stage_order = ? AND status = 'active'",
          args: [dbId, stage.stage_order + 1],
        })
        .catch(() => ({ rows: [] }));
      const nextStageId = nextStageRes.rows?.[0]?.id;
      if (nextStageId) await releaseFirstMilestoneForStage(db, { dbId, stageId: nextStageId });
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
      // Reopened journey is active again — release its first unfinished milestone.
      await releaseFirstMilestoneForStage(db, { dbId, stageId });
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
