/**
 * Programs — manager change (SERVICE layer).
 *
 * The domain work behind PUT /api/pm/programs/[id]/manager. The CONTROLLER still
 * authenticates and authorizes (who may write, the "two ways in" repair policy);
 * everything below is what recording a manager actually DOES.
 *
 * ASSIGNMENT-DERIVED ACCESS FOLLOWS THE RELATIONSHIP. Two people change when the
 * manager changes, so both are reconciled here:
 *
 *   - the NEW manager receives the assignment-derived capabilities for this
 *     program (additive, expiring with the program);
 *   - the PREVIOUS manager's grants are reconciled too, which withdraws the ones
 *     this program alone justified.
 *
 * A manual grant and an explicit block are never touched by either reconcile:
 * grants carry the mechanism's own stamp, and blocks live outside the merge.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It reads and
 * writes through `@/models/**`.
 */

import { getProgramManager, setProgramManager } from "@/models/programs";
import { getContactNameAndRole } from "@/models/authorization";
import { syncContextGrantsForUser } from "@/services/authorization/contextGrants";

/**
 * Record who manages a program, and reconcile the access of both sides.
 *
 * @param {{programId: string|number, managerCid: string|null, actorCid?: string|null}} args
 * @returns {Promise<{status: number, errorKey: string|null, body: Object|null}>}
 *   errorKey is set (with a status) when the caller should return a refusal;
 *   body carries the success payload otherwise.
 */
export async function changeProgramManager({ programId, managerCid, actorCid = null }) {
  const current = await getProgramManager(programId);
  const program = current.rows?.[0];
  if (!program) {
    return { status: 404, errorKey: "errors.notFound", body: null };
  }

  const nextManager = managerCid ? String(managerCid) : null;
  const previousManager = program.assigned_pm_id
    ? String(program.assigned_pm_id)
    : null;

  if (nextManager === previousManager) {
    // Nothing to record and nothing to reconcile — report the honest state
    // rather than rewriting the row.
    return {
      status: 200,
      errorKey: null,
      body: {
        success: true,
        unchanged: true,
        program: { id: String(program.id), name: program.name || null },
        manager: nextManager ? { cid: nextManager } : null,
      },
    };
  }

  // The person must exist before we point a program at them: a dangling cid
  // would create an attachment that resolves to nobody.
  if (nextManager) {
    const contact = await getContactNameAndRole(nextManager);
    if (!contact.rows?.length) {
      return { status: 404, errorKey: "errors.notFound", body: null };
    }
  }

  await setProgramManager(programId, nextManager);

  // Reconcile the relationship change for BOTH sides. Reconcile failures must
  // not lose the recorded relationship: the assignment is the source of truth,
  // and the scheduled sweep (or the next connect) re-derives from it.
  const reconciled = [];
  const reconcile = async (cid) => {
    if (!cid) return;
    try {
      const result = await syncContextGrantsForUser(cid, {
        context: "program",
        roleKey: "program_manager",
      });
      reconciled.push({
        cid,
        applied: result.applied || [],
        revoked: result.revoked || [],
      });
    } catch (error) {
      console.warn(
        `[program manager] reconcile failed for ${cid}:`,
        error.message,
      );
    }
  };
  await reconcile(nextManager);
  await reconcile(previousManager);

  return {
    status: 200,
    errorKey: null,
    body: {
      success: true,
      program: { id: String(program.id), name: program.name || null },
      manager: nextManager ? { cid: nextManager } : null,
      previous: previousManager ? { cid: previousManager } : null,
      reconciled,
      actor: actorCid,
    },
  };
}
