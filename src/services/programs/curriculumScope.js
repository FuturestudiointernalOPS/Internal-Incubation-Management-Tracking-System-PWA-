/**
 * Programs — the curriculum record-scope resolvers (SERVICE layer).
 *
 * The controller asks these which RECORD's program authorises an action, so a
 * client-supplied `program_id` can never authorise a foreign row: a record
 * action resolves the program from the target row itself.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions, no SQL, no HTTP. It reads through
 * `@/models/**`.
 */

import { getRequirementProgramId, getSessionProgramId } from "@/models/curriculum";

/**
 * The program a POST action is authorised against.
 *
 * Creating actions write into the payload's program, but record actions
 * (toggle/assign/anchor) target an existing row by id, so the program is
 * resolved from THAT row — a client-supplied program_id must never authorise a
 * foreign record.
 */
export async function resolveActionScopeProgramId({ action, payload }) {
  if (action === "toggle_status" || action === "assign_team") {
    const target = await getSessionProgramId(payload.id);
    return target.rows?.[0]?.program_id || null;
  }
  if (action === "anchor_material") {
    const target = await getSessionProgramId(payload.session_id);
    return target.rows?.[0]?.program_id || null;
  }
  if (action === "toggle_deliverable") {
    const target = await getRequirementProgramId(payload.id);
    return target.rows?.[0]?.program_id || null;
  }
  return payload.program_id;
}

/**
 * The program a PUT/DELETE targets, resolved from the record itself — a
 * `field` update and a `type: "session"` write target a session, everything
 * else a document requirement.
 */
export async function resolveRecordScopeProgramId({ targetId, field, type }) {
  if (!targetId) return null;
  const isSession = Boolean(field) || type === "session";
  const resolved = isSession
    ? await getSessionProgramId(targetId)
    : await getRequirementProgramId(targetId);
  return resolved.rows?.[0]?.program_id || null;
}
