/**
 * /api/venture-templates — configurable Venture Playbooks (Phase 5)
 *
 * Future Studio (Venture Setup) defines reusable playbooks; Ventures receive
 * a snapshot on assignment (template edits never rewrite venture history).
 *
 * GET              — list playbook templates (with stages/milestones/tasks)
 * POST             — create a playbook template
 * POST action=assign — assign a template to a venture (snapshot)
 *
 * Write access: super_admin + staff (Venture Setup).
 */

import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import { createPlaybookTemplate, assignPlaybookToVenture } from "@/lib/ventureTemplates";

const SETUP_ROLES = ["super_admin", "staff"];

export async function GET() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const tpls = await db.execute({
      sql: `SELECT t.*,
              (SELECT COUNT(*) FROM venture_playbook_template_stages s WHERE s.template_id = t.id) AS stage_count
            FROM venture_playbook_templates t
            WHERE t.is_active = TRUE
            ORDER BY t.created_at DESC`,
      args: [],
    });
    const templates = [];
    for (const t of tpls.rows || []) {
      const stages = await db.execute({
        sql: `SELECT s.id, s.stage_order, s.name, s.description, s.objective, s.completion_criteria
              FROM venture_playbook_template_stages s WHERE s.template_id = ? ORDER BY s.stage_order`,
        args: [t.id],
      });
      const stageIds = (stages.rows || []).map((s) => s.id);
      let milestones = [];
      if (stageIds.length > 0) {
        milestones = (
          await db.execute({
            sql: `SELECT sm.stage_id, m.id, m.name, m.description, m.expected_outcome, m.default_due_days
                  FROM venture_playbook_stage_milestones sm
                  JOIN venture_milestone_templates m ON m.id = sm.milestone_template_id
                  WHERE sm.stage_id IN (${stageIds.map(() => "?").join(", ")}) ORDER BY sm.sort_order`,
            args: stageIds,
          })
        ).rows || [];
      }
      templates.push({ ...t, stages: stages.rows || [], milestones });
    }
    return NextResponse.json({ success: true, templates });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;
  const session = await getSession();
  if (!session || !SETUP_ROLES.includes(session.role)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Venture Setup permission required." },
      { status: 403 },
    );
  }

  try {
    const body = await req.json();

    if (body.action === "assign") {
      const result = await assignPlaybookToVenture({
        templateId: body.template_id,
        ventureId: body.venture_id,
        actorCid: session.cid,
      });
      return NextResponse.json({ success: !result.skipped, ...result });
    }

    const result = await createPlaybookTemplate({
      name: body.name,
      description: body.description,
      stages: body.stages || [],
      createdBy: session.cid,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
