/**
 * CONTACT ↔ PROGRAM/GROUP SYNCHRONIZATION (SERVICE layer)
 *
 * Ensures that a person who enters through a Form Run (or is assigned as a
 * facilitator) is linked to the correct CRM group (`contacts.group_name`) and
 * program (`participant_programs`), without overwriting an existing group/program
 * or changing their global `contacts.role`.
 *
 * All writes are idempotent, additive, and fill-only.
 *
 * Layer (see docs/LAYER_SPLIT.md): the resolution and the reconciliation
 * orchestration live here; every statement lives in
 * `@/models/contactGroupSyncStore`.
 */

import { initDb } from "@/lib/db";
import {
  getContactCidByEmail,
  getContactCidById,
  fillContactGroupName,
  addParticipantProgramMembership,
  getRunGroupAssignment,
  getRunProgramAssignment,
  backfillContactGroupNamesFromRuns,
  backfillParticipantProgramsFromRuns,
  addContextualFacilitatorRoles,
  backfillParticipantProgramsFromLegacyIntake,
  backfillParticipantProgramsFromLegacyContactProgramId,
} from "@/models/contactGroupSyncStore";

async function resolveContactId(submitterId) {
  if (!submitterId) return null;
  if (String(submitterId).includes("@")) {
    const emailResult = await getContactCidByEmail(submitterId);
    return emailResult.rows[0]?.cid || null;
  }
  const cidResult = await getContactCidById(submitterId);
  return cidResult.rows[0]?.cid || null;
}

async function fillGroupAndProgram(contactCid, groupName, programId) {
  if (!contactCid) return;

  if (groupName) {
    await fillContactGroupName(contactCid, groupName);
  }

  if (programId) {
    await addParticipantProgramMembership(contactCid, programId);
  }
}

/**
 * Synchronous sync after a form submission is approved. This does NOT depend on
 * the fire-and-forget background automation, so the CRM group/program link is
 * established in the request that approves the person.
 */
export async function syncApprovedSubmissionToProgramGroup(submission) {
  if (!submission?.run_id || !submission?.submitter_id) return;
  try {
    await initDb();

    const contactCid = await resolveContactId(submission.submitter_id);

    const groupRes = await getRunGroupAssignment(submission.run_id);

    let groupName = groupRes.rows[0]?.name || null;
    let programId = groupRes.rows[0]?.program_id || null;

    if (!programId) {
      const progRes = await getRunProgramAssignment(submission.run_id);
      programId = progRes.rows[0]?.target_id || null;
    }

    await fillGroupAndProgram(contactCid, groupName, programId);
  } catch (error) {
    console.error("[contact-group-sync] approval sync failed:", error.message);
  }
}

/**
 * Idempotent reconciliation for existing records. Safe to run repeatedly.
 * - Backfills missing `contacts.group_name` for people who submitted through an
 *   assigned run.
 * - Backfills `participant_programs`.
 * - Backfills program links and contextual roles for facilitators.
 *
 * This is a SAFETY NET for records that predate the event-driven repair: the
 * normal path fixes a person the moment their submission is approved
 * (`syncApprovedSubmissionToProgramGroup`, called from the review route). It is
 * idempotent, but it is also several WRITING statements, and it used to run on
 * every /api/contacts/full-state read — so a read endpoint paid for writes on
 * every load, which is most of why the registry screen measured ten sequential
 * round trips.
 *
 * Keep the net, drop the per-request cost: at most one run per window per
 * process. Callers arriving while a run is in flight share it rather than each
 * starting their own, and a run that failed is not retried until the next window
 * (so a broken statement cannot become a retry storm).
 */
const RECONCILE_WINDOW_MS = 60 * 1000;
let reconcilePromise = null;
let lastReconcileAt = 0;

export async function reconcileProgramGroups() {
  if (reconcilePromise) return reconcilePromise;
  if (Date.now() - lastReconcileAt < RECONCILE_WINDOW_MS) return;
  lastReconcileAt = Date.now();
  reconcilePromise = runReconcileProgramGroups().finally(() => {
    reconcilePromise = null;
    lastReconcileAt = Date.now();
  });
  return reconcilePromise;
}

async function runReconcileProgramGroups() {
  try {
    await initDb();

    // 1. Backfill group_name for participants (fill-only).
    await backfillContactGroupNamesFromRuns();

    // 2. Backfill participant_programs.
    await backfillParticipantProgramsFromRuns();

    // 3. (Removed in Phase 1) The legacy contacts.program_id backfill for
    //    facilitators is no longer performed; participant_programs is
    //    authoritative and facilitator scope comes from v2_program_staff/families.

    // 4. Add contextual facilitator roles (additive; contact_roles may not exist
    //    in older schemas, so this is best-effort).
    await addContextualFacilitatorRoles();

    // 5. Participant-architecture cleanup (Phase 1): backfill
    //    participant_programs from the remaining legacy sources so it can
    //    become the single source of truth for Person -> Program membership.
    await reconcileParticipantPrograms();
  } catch (error) {
    console.error("[contact-group-sync] reconciliation failed:", error.message);
  }
}

/**
 * Phase 1 (participant-architecture cleanup): backfill `participant_programs`
 * from the legacy sources so it can become the single source of truth.
 *
 * This is additive and idempotent — it only INSERTs rows that are missing and
 * never deletes or overwrites existing membership.
 *
 * Legacy sources covered:
 *   - `v2_participants` (legacy intake): joined to `contacts` by email or
 *     `user_id`, and only when the program still exists.
 *   - `contacts.program_id` (legacy single-value field): only when it holds a
 *     single program id (not comma-separated) and the program exists.
 *
 * Deliberately NOT reconciled here: `contacts.group_name` name-lookup. Group
 * membership is a separate concept from program membership and must not be
 * re-introduced as a program source.
 */
export async function reconcileParticipantPrograms() {
  try {
    await initDb();

    await backfillParticipantProgramsFromLegacyIntake();
    await backfillParticipantProgramsFromLegacyContactProgramId();

    return { success: true };
  } catch (error) {
    console.error("[participant-programs] reconciliation failed:", error.message);
    return { success: false, error: error.message };
  }
}
