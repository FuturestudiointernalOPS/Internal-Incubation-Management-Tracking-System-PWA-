import db from "@/lib/db";

/**
 * Tasks model — access and identity facts (REPOSITORY layer).
 *
 * The project/contact/assignment lookups the task decisions read, split
 * verbatim out of `models/tasks.js` — see docs/LAYER_SPLIT.md.
 *
 * Model-layer rules: no HTTP, one function per query, named after the data.
 */

/** Project status — blocks creating tasks on closed/archived projects. */
export async function getProjectStatus(projectId) {
  return db.execute({
    sql: "SELECT status FROM v2_projects WHERE id::text = ?",
    args: [projectId],
  });
}

/** Project owner — default assignee when a task has a project but no assignee. */
export async function getProjectOwnerId(projectId) {
  return db.execute({
    sql: "SELECT owner_id FROM v2_projects WHERE id::text = ?",
    args: [String(projectId)],
  });
}

/** Project membership row — used to re-validate project reassignment. */
export async function getProjectMembership(projectId, userCid) {
  return db.execute({
    sql: "SELECT id FROM project_members WHERE project_id = ? AND user_cid = ?",
    args: [projectId, userCid],
  });
}

/** Super-admin contact row — used to prevent assigning tasks to a Super Admin. */
export async function getSuperAdminContact(cid) {
  return db.execute({
    sql: "SELECT role FROM contacts WHERE cid = ? AND role = 'super_admin'",
    args: [cid],
  });
}

/** Active super admins (cid + name) — new sub-task notifications. */
export async function getActiveSuperAdmins() {
  return db.execute({
    sql: "SELECT cid, name FROM contacts WHERE role = 'super_admin' AND status = 'active'",
    args: [],
  });
}

/** Active super admin cids — auto-completed sub-task notifications. */
export async function getActiveSuperAdminCids() {
  return db.execute({
    sql: "SELECT cid FROM contacts WHERE role = 'super_admin' AND status = 'active'",
    args: [],
  });
}

/** Contact role (single row) — standup sync role lookup. */
export async function getContactRoleByCid(cid) {
  return db.execute({
    sql: "SELECT role FROM contacts WHERE cid = ? LIMIT 1",
    args: [cid],
  });
}

/** Contact display name by cid — notification fallback name lookup. */
export async function getContactNameByCid(cid) {
  return db.execute({
    sql: "SELECT name FROM contacts WHERE cid = ?",
    args: [cid],
  });
}

/** Intent responsible party — auto-populated supervisor on intent link. */
export async function getIntentResponsibleId(intentId) {
  return db.execute({
    sql: "SELECT responsible_id FROM intents WHERE id = ?",
    args: [intentId],
  });
}

/** Pending assignment id (duplicate guard before creating a new one). */
export async function getPendingAssignmentId(taskId, assigneeId) {
  return db.execute({
    sql: "SELECT id FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
    args: [taskId, assigneeId],
  });
}

/** Pending assignment full row by assignment id. */
export async function getPendingAssignmentById(assignmentId) {
  return db.execute({
    sql: "SELECT * FROM task_assignments WHERE id = ? AND status = 'pending'",
    args: [parseInt(assignmentId)],
  });
}

/** Pending assignment full row by task + assignee. */
export async function getPendingAssignmentByTaskAndAssignee(taskId, assigneeCid) {
  return db.execute({
    sql: "SELECT * FROM task_assignments WHERE task_id = ? AND assignee_id = ? AND status = 'pending'",
    args: [taskId, assigneeCid],
  });
}
