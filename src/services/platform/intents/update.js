/**
 * Platform — intents: the update use case (SERVICE layer).
 *
 * The update decision: the ownership check (responsible person or SA), the
 * field set assembled from the patch, and the audit trail. Split of
 * `services/platform/intents.js` — see docs/LAYER_SPLIT.md; the barrel at the
 * original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It writes through `@/models/**`.
 */

import { getExistingIntent, updateIntentFields } from "@/models/intents";
import { logAuditEvent } from "@/services/tasks/auditLog";

/** PUT /api/intents — update an Intent (only its responsible person or SA). */
export async function updateIntentForSession({ session, input }) {
  const {
    id,
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

  if (!id) {
    return { status: 400, body: { success: false, error: "id is required" } };
  }

  const existing = await getExistingIntent(id);
  if (existing.rows.length === 0) {
    return { status: 404, body: { success: false, error: "Intent not found" } };
  }

  const intent = existing.rows[0];

  // SECURITY: Only responsible person or SA can update
  if (
    session.role !== "super_admin" &&
    String(intent.responsible_id) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "Only the responsible person can update this intent." },
    };
  }

  const updates = [];
  const args = [];

  if (title !== undefined) {
    updates.push("title = ?");
    args.push(title);
  }
  if (description !== undefined) {
    updates.push("description = ?");
    args.push(description);
  }
  if (responsible_id !== undefined) {
    updates.push("responsible_id = ?");
    args.push(responsible_id);
  }
  if (context_type !== undefined) {
    updates.push("context_type = ?");
    args.push(context_type);
  }
  if (context_id !== undefined) {
    updates.push("context_id = ?");
    args.push(context_id);
  }
  if (contact_group_id !== undefined) {
    updates.push("contact_group_id = ?");
    args.push(contact_group_id);
  }
  if (project_id !== undefined) {
    updates.push("project_id = ?");
    args.push(project_id);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    args.push(status);
    if (status === "completed") {
      updates.push("completed_at = NOW()");
    }
  }
  if (start_date !== undefined) {
    updates.push("start_date = ?");
    args.push(start_date);
  }
  if (target_date !== undefined) {
    updates.push("target_date = ?");
    args.push(target_date);
  }

  if (updates.length === 0) {
    return { status: 400, body: { success: false, error: "No fields to update" } };
  }

  updates.push("updated_at = NOW()");
  args.push(id);

  await updateIntentFields(updates, args);

  await logAuditEvent({
    entity_type: "intent",
    entity_id: id,
    user_id: session.cid,
    user_name: session.name || "",
    action: "updated",
    details: `Intent "${intent.title}" updated`,
    metadata: { updated_fields: Object.keys(input).filter((key) => key !== "id") },
  });

  return { status: 200, body: { success: true, action: "updated" } };
}
