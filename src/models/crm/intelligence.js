import db from "@/lib/db";

/**
 * CRM Intelligence Model
 * Covers Phase 5: Lead Scoring, Segments, and Automation
 */

// -----------------------------------------------------------------------------
// 1. SCORING HISTORY
// -----------------------------------------------------------------------------
export async function getLeadScoreHistory(leadId) {
  return db.execute({
    sql: `SELECT h.*, c.name as created_by_name 
          FROM crm_lead_score_history h
          LEFT JOIN contacts c ON c.cid = h.created_by
          WHERE h.lead_id = ?
          ORDER BY h.created_at DESC`,
    args: [leadId],
  });
}

export async function addLeadScoreHistory({ leadId, oldScore, newScore, reason, triggerEvent, createdBy }) {
  // Update the lead record directly
  await db.execute({
    sql: `UPDATE crm_leads SET score = ?, updated_at = NOW() WHERE id = ?`,
    args: [newScore, leadId]
  });

  // Record history log
  return db.execute({
    sql: `INSERT INTO crm_lead_score_history 
            (lead_id, old_score, new_score, reason, trigger_event, created_by) 
          VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    args: [leadId, oldScore, newScore, reason ?? null, triggerEvent ?? null, createdBy ?? null]
  });
}

// -----------------------------------------------------------------------------
// 2. SEGMENTS
// -----------------------------------------------------------------------------
export async function getCrmSegments(entityType) {
  let sql = `SELECT s.*, c.name as created_by_name 
             FROM crm_segments s
             LEFT JOIN contacts c ON c.cid = s.created_by`;
  const args = [];
  
  if (entityType) {
    sql += ` WHERE s.entity_type = ?`;
    args.push(entityType);
  }
  
  sql += ` ORDER BY s.name ASC`;
  return db.execute({ sql, args });
}

export async function getCrmSegmentById(id) {
  const result = await db.execute({
    sql: `SELECT s.*, c.name as created_by_name 
          FROM crm_segments s
          LEFT JOIN contacts c ON c.cid = s.created_by
          WHERE s.id = ?`,
    args: [id]
  });
  return result.rows[0] || null;
}

export async function createCrmSegment({ name, description, entityType, conditions, createdBy }) {
  return db.execute({
    sql: `INSERT INTO crm_segments (name, description, entity_type, conditions, created_by)
          VALUES (?, ?, ?, ?::jsonb, ?) RETURNING *`,
    args: [name, description ?? null, entityType, JSON.stringify(conditions || []), createdBy ?? null]
  });
}

export async function updateCrmSegment(id, { name, description, conditions }) {
  const sets = [];
  const args = [];
  if (name !== undefined) { sets.push("name = ?"); args.push(name); }
  if (description !== undefined) { sets.push("description = ?"); args.push(description); }
  if (conditions !== undefined) { sets.push("conditions = ?::jsonb"); args.push(JSON.stringify(conditions)); }
  
  if (!sets.length) return { rows: [] };
  
  sets.push("updated_at = NOW()");
  args.push(id);
  
  return db.execute({
    sql: `UPDATE crm_segments SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args
  });
}

export async function deleteCrmSegment(id) {
  return db.execute({ sql: `DELETE FROM crm_segments WHERE id = ?`, args: [id] });
}

// -----------------------------------------------------------------------------
// 3. AUTOMATION RULES
// -----------------------------------------------------------------------------
export async function getCrmAutomationRules() {
  return db.execute({
    sql: `SELECT r.*, c.name as created_by_name 
          FROM crm_automation_rules r
          LEFT JOIN contacts c ON c.cid = r.created_by
          ORDER BY r.created_at DESC`,
  });
}

export async function getCrmAutomationRuleById(id) {
  const result = await db.execute({
    sql: `SELECT r.*, c.name as created_by_name 
          FROM crm_automation_rules r
          LEFT JOIN contacts c ON c.cid = r.created_by
          WHERE r.id = ?`,
    args: [id]
  });
  return result.rows[0] || null;
}

export async function getActiveRulesByEvent(triggerEvent) {
  return db.execute({
    sql: `SELECT * FROM crm_automation_rules WHERE trigger_event = ? AND active = true`,
    args: [triggerEvent]
  });
}

export async function createCrmAutomationRule({ name, description, entityType, triggerEvent, conditions, actions, active, createdBy }) {
  return db.execute({
    sql: `INSERT INTO crm_automation_rules 
            (name, description, entity_type, trigger_event, conditions, actions, active, created_by)
          VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?) RETURNING *`,
    args: [
      name, description ?? null, entityType, triggerEvent, 
      JSON.stringify(conditions || []), JSON.stringify(actions || []), 
      active ?? true, createdBy ?? null
    ]
  });
}

export async function updateCrmAutomationRule(id, updates) {
  const allowed = ['name', 'description', 'conditions', 'actions', 'active'];
  const sets = [];
  const args = [];
  
  for (const f of allowed) {
    if (updates[f] !== undefined) {
      if (f === 'conditions' || f === 'actions') {
        sets.push(`${f} = ?::jsonb`);
        args.push(JSON.stringify(updates[f]));
      } else {
        sets.push(`${f} = ?`);
        args.push(updates[f]);
      }
    }
  }
  
  if (!sets.length) return { rows: [] };
  
  sets.push("updated_at = NOW()");
  args.push(id);
  
  return db.execute({
    sql: `UPDATE crm_automation_rules SET ${sets.join(", ")} WHERE id = ? RETURNING *`,
    args
  });
}

export async function deleteCrmAutomationRule(id) {
  return db.execute({ sql: `DELETE FROM crm_automation_rules WHERE id = ?`, args: [id] });
}

// -----------------------------------------------------------------------------
// 4. AUTOMATION LOGS (Idempotency)
// -----------------------------------------------------------------------------
export async function logCrmAutomationExecution({ ruleId, eventId, entityType, entityId, status, error, result }) {
  return db.execute({
    sql: `INSERT INTO crm_automation_executions 
            (rule_id, event_id, entity_type, entity_id, status, error, result)
          VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)
          ON CONFLICT (rule_id, event_id, entity_id) 
          DO UPDATE SET 
            status = EXCLUDED.status, 
            error = EXCLUDED.error, 
            result = EXCLUDED.result, 
            completed_at = NOW()
          RETURNING *`,
    args: [ruleId, eventId, entityType, entityId, status, error ?? null, result ? JSON.stringify(result) : null]
  });
}

export async function getAutomationExecutionsByEntity(entityType, entityId) {
  return db.execute({
    sql: `SELECT e.*, r.name as rule_name 
          FROM crm_automation_executions e
          JOIN crm_automation_rules r ON r.id = e.rule_id
          WHERE e.entity_type = ? AND e.entity_id = ?
          ORDER BY e.started_at DESC`,
    args: [entityType, entityId]
  });
}

export async function getAutomationExecutionsByRule(ruleId) {
  return db.execute({
    sql: `SELECT e.* 
          FROM crm_automation_executions e
          WHERE e.rule_id = ?
          ORDER BY e.started_at DESC
          LIMIT 100`,
    args: [ruleId]
  });
}

/** Existing execution for (rule, event, entity) — the idempotency guard. */
export async function getCrmAutomationExecution({ ruleId, eventId, entityId }) {
  const result = await db.execute({
    sql: `SELECT id, status FROM crm_automation_executions
          WHERE rule_id = ? AND event_id = ? AND entity_id = ?`,
    args: [ruleId, eventId, entityId]
  });
  return result.rows[0] || null;
}
