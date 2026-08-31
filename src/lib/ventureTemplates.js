/**
 * VENTURE PLAYBOOK TEMPLATES (Phase 5)
 *
 * Future Studio defines reusable operating structures:
 *   playbook → stages → milestone templates → task templates
 *
 * Assigning a playbook to a Venture SNAPSHOTS the structure into per-venture
 * execution rows (venture_playbook_instances + venture_milestones +
 * venture_tasks). Template edits NEVER rewrite a Venture's history — each
 * venture row carries its template_id for provenance.
 */

import db, { initDb } from "@/lib/db";

export async function createPlaybookTemplate({ name, description, stages = [], createdBy }) {
  await initDb();
  if (!name || !name.trim()) throw new Error("Playbook name is required.");

  const tpl = await db.execute({
    sql: `INSERT INTO venture_playbook_templates (name, description, is_active, created_by, created_at, updated_at)
          VALUES (?, ?, TRUE, ?, NOW(), NOW()) RETURNING id`,
    args: [name.trim(), description || null, createdBy || "system"],
  });
  const templateId = tpl.rows[0].id;

  let order = 1;
  for (const stage of stages || []) {
    if (!stage?.name) continue;
    const stageRes = await db.execute({
      sql: `INSERT INTO venture_playbook_template_stages (template_id, stage_order, name, description, objective, completion_criteria, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW()) RETURNING id`,
      args: [templateId, order, stage.name, stage.description || null, stage.objective || null, stage.completion_criteria || null],
    });
    const stageId = stageRes.rows[0].id;

    let msort = 1;
    for (const ms of stage.milestones || []) {
      if (!ms?.name) continue;
      const msRes = await db.execute({
        sql: `INSERT INTO venture_milestone_templates (name, description, expected_outcome, default_due_days, is_active, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, TRUE, ?, NOW(), NOW()) RETURNING id`,
        args: [ms.name, ms.description || null, ms.expected_outcome || null, ms.default_due_days || null, createdBy || "system"],
      });
      const msId = msRes.rows[0].id;
      await db.execute({
        sql: "INSERT INTO venture_playbook_stage_milestones (stage_id, milestone_template_id, sort_order) VALUES (?, ?, ?)",
        args: [stageId, msId, msort++],
      });
      for (const tk of ms.tasks || []) {
        if (!tk?.name) continue;
        await db.execute({
          sql: `INSERT INTO venture_task_templates (milestone_template_id, name, description, requirement_type, is_active, created_at)
                VALUES (?, ?, ?, ?, TRUE, NOW())`,
          args: [msId, tk.name, tk.description || null, tk.requirement_type || "activity"],
        });
      }
    }
    order += 1;
  }

  return { success: true, template_id: templateId };
}

export async function assignPlaybookToVenture({ templateId, ventureId, actorCid }) {
  await initDb();
  if (!templateId || !ventureId) throw new Error("template_id and venture_id are required.");

  // One playbook per venture
  const existing = await db.execute({
    sql: "SELECT id FROM venture_playbook_instances WHERE venture_id = ?",
    args: [ventureId],
  });
  if (existing.rows.length > 0) {
    return { skipped: true, reason: "A playbook is already assigned to this venture." };
  }

  // Load the template structure (stages + milestones + tasks)
  const stageRes = await db.execute({
    sql: `SELECT s.id, s.stage_order, s.name, s.description, s.objective, s.completion_criteria
          FROM venture_playbook_template_stages s
          WHERE s.template_id = ?
          ORDER BY s.stage_order ASC`,
    args: [templateId],
  });
  const stages = stageRes.rows || [];
  if (stages.length === 0) return { skipped: true, reason: "The playbook template has no stages." };

  const milestoneRes = await db.execute({
    sql: `SELECT sm.stage_id, m.id, m.name, m.description, m.expected_outcome, m.default_due_days
          FROM venture_playbook_stage_milestones sm
          JOIN venture_milestone_templates m ON m.id = sm.milestone_template_id
          WHERE sm.stage_id IN (${stages.map(() => "?").join(", ")})
          ORDER BY sm.sort_order ASC`,
    args: stages.map((s) => s.id),
  });
  const milestones = milestoneRes.rows || [];

  const taskRes = await db.execute({
    sql: `SELECT t.id, t.milestone_template_id, t.name, t.description, t.requirement_type
          FROM venture_task_templates t
          WHERE t.milestone_template_id IN (${milestones.length ? milestones.map(() => "?").join(", ") : "NULL"})
          ORDER BY t.id ASC`,
    args: milestones.map((m) => m.id),
  });
  const tasks = taskRes.rows || [];

  // Snapshot: instance + stages + milestones + tasks
  const instRes = await db.execute({
    sql: `INSERT INTO venture_playbook_instances (venture_id, template_id, assigned_by, assigned_at)
          VALUES (?, ?, ?, NOW()) RETURNING id`,
    args: [ventureId, templateId, actorCid || "system"],
  });
  const instanceId = instRes.rows[0].id;

  const now = new Date();
  for (const stage of stages) {
    await db.execute({
      sql: `INSERT INTO venture_playbook_instance_stages (instance_id, template_stage_id, stage_order, name, description, objective, completion_criteria, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())`,
      args: [instanceId, stage.id, stage.stage_order, stage.name, stage.description, stage.objective, stage.completion_criteria],
    });
    const stageMilestones = milestones.filter((m) => Number(m.stage_id) === Number(stage.id));
    for (const ms of stageMilestones) {
      const due = ms.default_due_days ? new Date(now.getTime() + ms.default_due_days * 86400e3).toISOString() : null;
      const msRes = await db.execute({
        sql: `INSERT INTO venture_milestones (venture_id, template_id, title, description, status, progress, target_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'not_started', 0, ?, NOW(), NOW()) RETURNING id`,
        args: [ventureId, ms.id, ms.name, ms.description || ms.expected_outcome || null, due],
      });
      const milestoneId = msRes.rows[0].id;
      const msTasks = tasks.filter((t) => Number(t.milestone_template_id) === Number(ms.id));
      for (const tk of msTasks) {
        await db.execute({
          sql: `INSERT INTO venture_tasks (venture_id, milestone_id, template_id, title, description, requirement_type, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 'backlog', NOW(), NOW())`,
          args: [ventureId, milestoneId, tk.id, tk.name, tk.description || null, tk.requirement_type || "activity"],
        });
      }
    }
  }

  return { success: true, instance_id: instanceId, stages: stages.length, milestones: milestones.length, tasks: tasks.length };
}

export default { createPlaybookTemplate, assignPlaybookToVenture };
