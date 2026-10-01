/**
 * Tasks — update use case (SERVICE layer).
 *
 * The domain work behind PUT /api/tasks — the largest path of the monolith. The
 * CONTROLLER authenticates and shapes the HTTP answer; everything below is what
 * updating a task DOES. This file is the ORDER of those decisions, nothing else:
 *
 *   1. read the task, then run the entry guards (access, status, lock, active
 *      blockers, carry-over safety) — `updateGuards.js`;
 *   2. assemble the SET: the descriptive fields, the project revalidation, the
 *      context and intent links, the supervisor gate, the assignment branches,
 *      the schedule drift and the date rules — `updateFields.js`;
 *   3. write it, then run the follow-on effects: the parent/subtask cascade, the
 *      carry-over ancestor walk, the audits and the standup rebuild —
 *      `updateEffects.js`.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 *
 * The sequencing is the contract, not an implementation detail: the guards run
 * before a single field is assembled, the assignment branches run BEFORE the
 * date validation (so an invalid date still leaves the pending assignment the
 * caller asked for), the strict-owner check runs after the write, and the SET
 * order is what the audit trail reads back. Splitting those three steps further
 * would move behaviour, so they stay in this order.
 */

import { updateTaskFields } from "@/models/tasks";
// Kept on the compatibility facades the existing task suite mocks.
import { getTaskById } from "@/lib/db/queries/tasks";
import { seesWholePortfolio } from "@/services/authorization/listingScope";
import { runUpdateGuards } from "./updateGuards";
import {
  applyAssignmentChange,
  applyContentFields,
  applyIntentField,
  applyLinkAndPriority,
  applyScheduleFields,
  newTaskFieldPatch,
  pushTaskField,
  validateTaskDates,
} from "./updateFields";
import {
  assertStrictOwnerChange,
  cascadeParentCompletion,
  completeSubtasksWithFanOut,
  logAssignmentChange,
  rebuildStandupsAfterUpdate,
  recordUpdateAudits,
  reopenSubtasksOnParentReopen,
  stretchParentEndDateAfterWrite,
  stretchParentEndDateOnScheduleChange,
} from "./updateEffects";

/**
 * Update a task.
 *
 * @param {{id: string|number, input: Object, role: string, sessionCid: string, sessionName: string}} args
 * @returns {Promise<{status: number, error?: string, body?: Object}>}
 */
export async function updateTaskRecord({ id, input, role, sessionCid, sessionName }) {
  const { status, supervisor_id } = input;

  // ── 1. The entry guards ──────────────────────────────────────────────────
  const task = await getTaskById(id);
  if (!task) {
    return { status: 404, error: "Task not found" };
  }

  const { failure, locked } = await runUpdateGuards({
    id,
    task,
    input,
    role,
    sessionCid,
  });
  if (failure) return failure;

  // ── 2. The field assembly ───────────────────────────────────────────────
  const patch = newTaskFieldPatch();

  applyLinkAndPriority(patch, { task, input });
  await applyContentFields(patch, { id, task, input });

  // The supervisor is a management field: only a staff-side caller (the shared
  // portfolio rule) may move it.
  if (
    seesWholePortfolio(role) &&
    supervisor_id !== undefined &&
    String(supervisor_id) !== String(task.supervisor_id || "")
  ) {
    pushTaskField(patch, "supervisor_id", supervisor_id || null, "supervisor updated");
  }

  await applyIntentField(patch, { task, input });

  const { pendingAssignmentCreated, failure: assignmentFailure } =
    await applyAssignmentChange(patch, {
      id,
      task,
      input,
      role,
      sessionCid,
      sessionName,
    });
  if (assignmentFailure) return assignmentFailure;

  const { needsRescheduleInc, dateChangeLog } = applyScheduleFields(patch, {
    task,
    input,
  });

  const dateFailure = validateTaskDates({ task, input });
  if (dateFailure) return dateFailure;

  if (patch.fields.length === 0) {
    return pendingAssignmentCreated
      ? { status: 200, body: { success: true, message: "Pending assignment created" } }
      : { status: 400, error: "No fields to update" };
  }

  patch.fields.push("updated_at = CURRENT_TIMESTAMP");
  patch.args.push(parseInt(id));

  await updateTaskFields(patch.fields, patch.args);

  // ── 3. The follow-on effects ────────────────────────────────────────────
  await stretchParentEndDateAfterWrite({ task, end_date: input.end_date });
  await completeSubtasksWithFanOut({ id, task, status });
  await cascadeParentCompletion({ task, input });
  await reopenSubtasksOnParentReopen({ id, task, input });
  await logAssignmentChange({ id, task, input, sessionCid });

  // SECURITY: the strict-owner refusal lands after the write (tested contract).
  const strictOwnerFailure = assertStrictOwnerChange({
    task,
    input,
    role,
    sessionCid,
  });
  if (strictOwnerFailure) return strictOwnerFailure;

  await recordUpdateAudits({
    id,
    task,
    input,
    patch,
    needsRescheduleInc,
    dateChangeLog,
  });
  await rebuildStandupsAfterUpdate({ task, input });
  await stretchParentEndDateOnScheduleChange({ task, input });

  return {
    status: 200,
    body: { success: true, id: parseInt(id), action: "updated", locked },
  };
}