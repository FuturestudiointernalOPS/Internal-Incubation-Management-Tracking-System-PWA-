/**
 * Programs — the self-healing schema steps of the curriculum write paths
 * (SERVICE layer).
 *
 * Session versioning, the optional requirement resource/assignee columns and the
 * weekly-report attachment columns are created on demand (idempotent and
 * additive) so that the curriculum actions never depend on a separately-run
 * migration. Each helper swallows its own failure: the caller keeps the exact
 * ordering and the exact "never block the write" semantics it had inline.
 *
 * Layer (see docs/LAYER_SPLIT.md): orchestration, no SQL, no HTTP. It writes
 * through `@/models/**`.
 */

import {
  addRequirementAssigneeIdColumn,
  addRequirementAssigneeTypeColumn,
  addRequirementResourceLabelColumn,
  addRequirementResourceUrlColumn,
  addSessionTimezoneColumn,
  addSessionVersionColumn,
  addWeeklyReportAttachmentTypeColumn,
  addWeeklyReportAttachmentUrlColumn,
  createSessionVersionsTable,
} from "@/models/curriculum";

/** Ensure session versioning schema exists. */
export async function ensureVersioningSchema() {
  try {
    await addSessionVersionColumn();
  } catch (_) {}
  try {
    await addSessionTimezoneColumn();
  } catch (_) {}
  try {
    await createSessionVersionsTable();
  } catch (_) {}
}

/**
 * Ensure the optional PM-provided resource-link columns exist on requirements.
 * Idempotent and additive — mirrors ensureVersioningSchema() so that session and
 * requirement creation never depends on a separately-run migration.
 */
export async function ensureDeliverableResourceSchema() {
  try {
    await addRequirementResourceUrlColumn();
  } catch (_) {}
  try {
    await addRequirementResourceLabelColumn();
  } catch (_) {}
}

/**
 * Ensure the assignee columns exist on requirements (add_session and
 * add_requirement INSERT them). Production was missing these — without the
 * columns, the session INSERT committed but the Attendance requirement INSERT
 * threw, so the route returned 501 "Curriculum feature not available" even
 * though the session was created. Self-healing prevents that drift.
 */
export async function ensureRequirementAssigneeSchema() {
  try {
    await addRequirementAssigneeTypeColumn();
  } catch (_) {}
  try {
    await addRequirementAssigneeIdColumn();
  } catch (_) {}
}

/**
 * Ensure the weekly-report attachment columns exist (URL link or PDF upload).
 * Idempotent and additive — mirrors the other ensure* schema helpers.
 */
export async function ensureWeeklyReportAttachmentSchema() {
  try {
    await addWeeklyReportAttachmentTypeColumn();
  } catch (_) {}
  try {
    await addWeeklyReportAttachmentUrlColumn();
  } catch (_) {}
}
