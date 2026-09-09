/**
 * Journey template library (Vinance 3 — Save-as-Template).
 *
 * A manager can save an entire Venture Journey — all stages with their bound
 * milestones and top-level tasks — as a reusable, STRUCTURE-ONLY template
 * inside ImpactOS. Templates are fully independent from Venture rows:
 *   - save   reads the Venture's journey and copies it into the library;
 *   - apply  copies the template back into a Venture as fresh rows
 *            (new stages/milestones/tasks, statuses reset, no history).
 *
 * Deliberately NOT copied (either direction): submissions, reviews,
 * comments, activity, assignments, dates. Execution data stays with the
 * Venture that produced it.
 */

function rowsOf(result) {
  return (result && result.rows) || [];
}

function newUuid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

/** List the template library with structural counts (newest first). */
export async function listJourneyTemplates(db) {
  const res = await db.execute({
    sql: `SELECT t.id, t.name, t.description, t.created_by, t.created_at,
             (SELECT COUNT(*) FROM venture_journey_template_stages s WHERE s.template_id = t.id) AS stage_count,
             (SELECT COUNT(*) FROM venture_journey_template_milestones m
                JOIN venture_journey_template_stages s ON s.id = m.stage_id
                WHERE s.template_id = t.id) AS milestone_count,
             (SELECT COUNT(*) FROM venture_journey_template_tasks k
                JOIN venture_journey_template_milestones m ON m.id = k.milestone_id
                JOIN venture_journey_template_stages s ON s.id = m.stage_id
                WHERE s.template_id = t.id) AS task_count
          FROM venture_journey_templates t
          ORDER BY t.created_at DESC`,
    args: [],
  });
  return rowsOf(res);
}

/**
 * Save the Venture's entire journey (stages + bound milestones + top-level
 * tasks) as a template. Returns { error } or
 * { success, template_id, name, stages, milestones, tasks }.
 */
export async function saveJourneyAsTemplate(db, { dbId, name, description = null, actorCid = null }) {
  const stageRes = await db.execute({
    sql: `SELECT * FROM venture_journey_stages WHERE venture_id = ?
          ORDER BY stage_order ASC`,
    args: [dbId],
  });
  const stages = rowsOf(stageRes);
  if (stages.length === 0) return { error: "This Venture has no journey stages to save yet." };

  const templateId = newUuid();
  let stageCount = 0;
  let milestoneCount = 0;
  let taskCount = 0;

  await db.transaction(async (query) => {
    await query(
      `INSERT INTO venture_journey_templates (id, name, description, created_by)
       VALUES (?, ?, ?, ?)`,
      [templateId, String(name || "").trim() || `${stages[0].name || "Venture"} Journey`, description || null, actorCid || null],
    );

    for (const stage of stages) {
      stageCount += 1;
      const tplStageId = newUuid();
      await query(
        `INSERT INTO venture_journey_template_stages
           (id, template_id, name, description, objective, stage_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tplStageId, templateId, stage.name || "Untitled stage", stage.description || null, stage.objective || null, stageCount],
      );

      const msRes = await query(
        `SELECT * FROM venture_milestones WHERE journey_stage_id = ?
         ORDER BY COALESCE(display_order, 0), created_at ASC`,
        [stage.id],
      );
      for (const ms of rowsOf(msRes)) {
        milestoneCount += 1;
        const tplMsId = newUuid();
        await query(
          `INSERT INTO venture_journey_template_milestones
             (id, stage_id, title, description, objective, priority, display_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [tplMsId, tplStageId, ms.title, ms.description || null, ms.objective || null, ms.priority || "medium", ms.display_order ?? 0],
        );

        const taskRes = await query(
          `SELECT * FROM venture_tasks
           WHERE milestone_id = ? AND parent_task_id IS NULL
           ORDER BY COALESCE(display_order, 0), created_at ASC`,
          [ms.id],
        );
        for (const tk of rowsOf(taskRes)) {
          taskCount += 1;
          await query(
            `INSERT INTO venture_journey_template_tasks
               (id, milestone_id, title, description, priority, labels, checklist,
                review_required, required_deliverable_type, display_order)
             VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
            [
              newUuid(), tplMsId, tk.title || "Untitled task", tk.description || null,
              tk.priority || "medium",
              JSON.stringify(typeof tk.labels === "string" ? safeParse(tk.labels, []) : tk.labels || []),
              JSON.stringify(typeof tk.checklist === "string" ? safeParse(tk.checklist, []) : tk.checklist || []),
              tk.review_required === true || tk.review_required === 1 || tk.review_required === "true" ? "TRUE" : "FALSE",
              tk.required_deliverable_type || null, tk.display_order ?? 0,
            ],
          );
        }
      }
    }
  });

  return {
    success: true,
    template_id: templateId,
    name: String(name || "").trim() || `${stages[0].name || "Venture"} Journey`,
    stages: stageCount,
    milestones: milestoneCount,
    tasks: taskCount,
  };
}

/**
 * Apply a journey template to a Venture: fresh journey stages (first one
 * active, rest locked) with fresh milestone + task rows. Fails if the
 * Venture already has journey stages. Returns { error } or
 * { success, stages, milestones, tasks }.
 */
export async function applyJourneyTemplate(db, { dbId, templateId, actorCid = null }) {
  const existing = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM venture_journey_stages WHERE venture_id = ?",
    args: [dbId],
  });
  if (Number(rowsOf(existing)[0]?.n || 0) > 0) {
    return { error: "This Venture already has journey stages. Remove them first if you want to generate the journey from a template." };
  }

  const metaRes = await db.execute({
    sql: "SELECT id, name FROM venture_journey_templates WHERE id = ?",
    args: [templateId],
  });
  const template = rowsOf(metaRes)[0];
  if (!template) return { error: "Template not found." };

  let stageCount = 0;
  let milestoneCount = 0;
  let taskCount = 0;

  await db.transaction(async (query) => {
    const stageRes = await query(
      `SELECT * FROM venture_journey_template_stages WHERE template_id = ?
       ORDER BY stage_order ASC`,
      [templateId],
    );
    const tplStages = rowsOf(stageRes);
    if (tplStages.length === 0) return { error: "Template has no stages." };

    for (let i = 0; i < tplStages.length; i++) {
      const ts = tplStages[i];
      stageCount += 1;
      const stageIns = await query(
        `INSERT INTO venture_journey_stages
           (venture_id, name, description, objective, stage_order, status,
            source_template_type, source_template_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [dbId, ts.name, ts.description || null, ts.objective || null, stageCount, i === 0 ? "active" : "locked", "journey", String(templateId)],
      );
      const newStageId = rowsOf(stageIns)[0]?.id;

      const msRes = await query(
        `SELECT * FROM venture_journey_template_milestones WHERE stage_id = ?
         ORDER BY COALESCE(display_order, 0), created_at ASC`,
        [ts.id],
      );
      const tplMs = rowsOf(msRes);
      for (let mi = 0; mi < tplMs.length; mi++) {
        const tms = tplMs[mi];
        milestoneCount += 1;
        const newMsId = newUuid();
        // Sequential release (Phase 3): first milestone of each fresh stage is
        // available; the rest start locked until the previous one completes.
        const msStatus = mi === 0 ? "not_started" : "locked";
        await query(
          `INSERT INTO venture_milestones
             (id, venture_id, title, description, objective, status, progress,
              priority, display_order, journey_stage_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
          [
            newMsId, dbId, tms.title, tms.description || null, tms.objective || null, msStatus,
            tms.priority || "medium", tms.display_order ?? 0, newStageId, actorCid || null,
          ],
        );

        const taskRes = await query(
          `SELECT * FROM venture_journey_template_tasks WHERE milestone_id = ?
           ORDER BY COALESCE(display_order, 0), created_at ASC`,
          [tms.id],
        );
        for (const ttk of rowsOf(taskRes)) {
          taskCount += 1;
          await query(
            `INSERT INTO venture_tasks
               (venture_id, milestone_id, title, description, status, priority,
                labels, checklist, display_order, review_required,
                required_deliverable_type)
             VALUES (?, ?, ?, ?, 'backlog', ?, ?::jsonb, ?::jsonb, ?, ?, ?)`,
            [
              dbId, newMsId, ttk.title, ttk.description || null, ttk.priority || "medium",
              JSON.stringify(typeof ttk.labels === "string" ? safeParse(ttk.labels, []) : ttk.labels || []),
              JSON.stringify(typeof ttk.checklist === "string" ? safeParse(ttk.checklist, []) : ttk.checklist || []),
              ttk.display_order ?? 0,
              ttk.review_required === true || ttk.review_required === 1 || ttk.review_required === "true" ? "TRUE" : "FALSE",
              ttk.required_deliverable_type || null,
            ],
          );
        }
      }
    }
  });

  return { success: true, template_id: templateId, stages: stageCount, milestones: milestoneCount, tasks: taskCount };
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

export default { listJourneyTemplates, saveJourneyAsTemplate, applyJourneyTemplate };
