/**
 * Platform — intents: the create use case (SERVICE layer).
 *
 * The create decision: the required title, the responsible default and the
 * responsible-exists check, then the write and the audit trail. Split of
 * `services/platform/intents.js` — see docs/LAYER_SPLIT.md; the barrel at the
 * original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It writes through `@/models/**`.
 */

import { createIntent, getContactForResponsibleCheck } from "@/models/intents";
import { logAuditEvent } from "@/services/tasks/auditLog";

/** POST /api/intents — create an Intent (the responsible person must exist). */
export async function createIntentForSession({ session, input }) {
  const {
    title,
    description,
    responsible_id,
    context_type,
    context_id,
    contact_group_id,
    project_id,
    status,
    start_date,
    target_date,
  } = input;

  if (!title) {
    return { status: 400, body: { success: false, error: "title is required" } };
  }

  const finalResponsibleId = responsible_id || session.cid;
  const finalContextType = context_type || "staff";

  // SECURITY: Verify responsible person exists
  const responsibleCheck = await getContactForResponsibleCheck(finalResponsibleId);
  if (responsibleCheck.rows.length === 0) {
    return { status: 400, body: { success: false, error: "Responsible person not found." } };
  }

  const result = await createIntent({
    title,
    description,
    responsible_id: finalResponsibleId,
    context_type: finalContextType,
    context_id,
    contact_group_id,
    project_id,
    status,
    start_date,
    target_date,
  });

  const intentId = result.rows[0].id;

  await logAuditEvent({
    entity_type: "intent",
    entity_id: intentId,
    user_id: session.cid,
    user_name: session.name || "",
    action: "created",
    details: `Intent "${title}" created`,
    metadata: {
      title,
      context_type: finalContextType,
      context_id: context_id || null,
      responsible_id: finalResponsibleId,
    },
  });

  return { status: 200, body: { success: true, id: intentId, action: "created" } };
}
