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
import { initDb } from "@/lib/db";
import { requireAuth, getSession } from "@/lib/auth";
import {
  getPlaybookStageMilestones,
  getPlaybookTemplateStages,
  listActivePlaybookTemplates,
} from "@/models/platformConfig";
import { createPlaybookTemplate, assignPlaybookToVenture } from "@/lib/ventureTemplates";

const SETUP_ROLES = ["super_admin", "staff"];

export async function GET() {
  await initDb();
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const templatesResult = await listActivePlaybookTemplates();
    const templates = [];
    for (const template of templatesResult.rows || []) {
      const stages = await getPlaybookTemplateStages(template.id);
      const stageIds = (stages.rows || []).map((stage) => stage.id);
      let milestones = [];
      if (stageIds.length > 0) {
        milestones = (await getPlaybookStageMilestones(stageIds)).rows || [];
      }
      templates.push({ ...template, stages: stages.rows || [], milestones });
    }
    return NextResponse.json({ success: true, templates });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
