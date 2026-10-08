/**
 * Tasks — the schedule field assembly and the date rules.
 *
 * Part of the `updateFields` field assembly (see docs/LAYER_SPLIT.md). Decisions
 * only, no SQL, no HTTP.
 */

import { isValidDateStr } from "../dates";
import { pushTaskField } from "./patch";

/**
 * The schedule columns plus the drift detection: the first schedule is captured
 * once, and any later change is counted as a reschedule.
 */
export function applyScheduleFields(patch, { task, input }) {
  const { start_date, end_date } = input;
  let needsRescheduleInc = false;
  let dateChangeLog = null; // { field, old_val, new_val } for task_audit_logs

  if (start_date !== undefined) {
    const dateChanged = start_date !== (task.start_date || null);
    pushTaskField(patch, "start_date", start_date || null);

    if (dateChanged) {
      dateChangeLog = {
        field: "start_date",
        old_val: task.start_date,
        new_val: start_date,
      };
      patch.changes.push("start date updated");
      // First schedule is immutable once set.
      if (!task.first_scheduled_start_date && start_date) {
        pushTaskField(
          patch,
          "first_scheduled_start_date",
          start_date,
          "first schedule captured",
        );
      } else if (
        task.first_scheduled_start_date &&
        start_date !== task.first_scheduled_start_date
      ) {
        needsRescheduleInc = true;
        patch.changes.push("schedule drift detected");
      }
    }
  }

  if (end_date !== undefined) {
    const dateChanged = end_date !== (task.end_date || null);
    pushTaskField(patch, "end_date", end_date || null);

    if (dateChanged) {
      dateChangeLog = {
        field: "end_date",
        old_val: task.end_date,
        new_val: end_date,
      };
      patch.changes.push("end date updated");
      if (!task.first_scheduled_end_date && end_date) {
        pushTaskField(
          patch,
          "first_scheduled_end_date",
          end_date,
          "first schedule captured",
        );
      } else if (
        task.first_scheduled_end_date &&
        end_date !== task.first_scheduled_end_date
      ) {
        needsRescheduleInc = true;
        patch.changes.push("schedule drift detected");
      }
    }
  }

  return { needsRescheduleInc, dateChangeLog };
}

/** ─── DATE VALIDATION (Phase 13) ─── */
export function validateTaskDates({ task, input }) {
  const { start_date, end_date } = input;

  if (start_date !== undefined && start_date && !isValidDateStr(start_date)) {
    return {
      status: 400,
      error: "Invalid start_date. Expected format YYYY-MM-DD.",
    };
  }
  if (end_date !== undefined && end_date && !isValidDateStr(end_date)) {
    return {
      status: 400,
      error: "Invalid end_date. Expected format YYYY-MM-DD.",
    };
  }

  const effStartDate =
    start_date !== undefined ? start_date || null : task.start_date;
  const effEndDate = end_date !== undefined ? end_date || null : task.end_date;
  if (effStartDate && effEndDate && effEndDate < effStartDate) {
    return {
      status: 400,
      error: "Due date cannot be earlier than the start date.",
    };
  }

  return null;
}
