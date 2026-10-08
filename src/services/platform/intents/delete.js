/**
 * Platform — intents: the delete use case (SERVICE layer).
 *
 * The delete decision: the ownership check (responsible person or SA), the task
 * unlink before the delete, and the audit trail. Split of
 * `services/platform/intents.js` — see docs/LAYER_SPLIT.md; the barrel at the
 * original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It writes through `@/models/**`.
 */

import { deleteIntent, getIntentToDelete, unlinkTasksFromIntent } from "@/models/intents";
import { logAuditEvent } from "@/services/tasks/auditLog";

/** DELETE /api/intents — unlink the tasks, then delete (responsible or SA). */
export async function deleteIntentForSession({ session, id }) {
  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const existing = await getIntentToDelete(id);
  if (existing.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = existing.rows[0];

  // SECURITY: Only responsible person or SA can delete
  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "Only the responsible person can delete this intent." },
    };
  }

  // Unlink tasks (set intent_id to NULL, remove supervisor)
  await unlinkTasksFromIntent(id);

  // Delete the intent
  await deleteIntent(id);

  await logAuditEvent({
    entity_type: "intent",
    entity_id: id,
    user_id: session.cid,
    user_name: session.name || "",
    action: "deleted",
    details: `Intent "${intent.title}" deleted`,
  });

  return { status: 200, body: { success: true, action: "deleted" } };
}
