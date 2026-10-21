/**
 * THE PROGRAM ACCESS THE SCREEN SHOWS (Lot 7, step 7.3).
 *
 * The workspace has to know, per program, whether its write affordances are
 * real. That question already has exactly one answer — the unified decision the
 * routes call (`decide`, D-3) — so this module asks it and shapes the answer for
 * display. It adds no rule: a manager whose program sits outside the profile
 * perimeter sees read-only chrome because the server would refuse the write,
 * not because the screen guessed from a role label or from the staffing table.
 *
 * Why it is not derived in the browser: `program_managed` is the `program_manager`
 * PROFILE applied to a program (D-4). The screen holds the profile list, but not
 * the per-program scope, so any local derivation is an approximation. This makes
 * the approximation unnecessary.
 *
 * DISPLAY ONLY. Every write route re-decides for itself; a caller cannot turn
 * this answer into authority.
 *
 * Layer: SERVICE. It composes `decide` and shapes its result. No SQL, no HTTP.
 */

import { decide } from "./scopedAccess";

/**
 * The write decisions the workspace exposes for ONE program.
 *
 * `publish` is only asked when `edit` is granted: publishing is a stricter level
 * of the same capability, so a refused editor cannot be a publisher. That keeps
 * the common (read-only) page at one perimeter read instead of two.
 *
 * @param {string|number} programId
 * @returns {Promise<{edit: boolean, publish: boolean, reason: string}>}
 *   `reason` is the stable code of the EDIT decision ("granted", "out_of_scope",
 *   "missing_permission"…), so the screen can explain a read-only workspace
 *   without inventing a message.
 */
export async function projectProgramAccess(programId) {
  const edit = await decide({
    module: "programs",
    capability: "edit",
    resource: "program",
    contextId: programId,
  });

  if (!edit.allowed) {
    return { edit: false, publish: false, reason: edit.reason };
  }

  const publish = await decide({
    module: "programs",
    capability: "publish",
    minLevel: 4,
    resource: "program",
    contextId: programId,
  });

  return {
    edit: true,
    publish: publish.allowed,
    reason: edit.reason,
  };
}
