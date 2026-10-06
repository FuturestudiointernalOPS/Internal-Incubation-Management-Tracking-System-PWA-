/**
 * Tasks — the intent-link field (with the best-effort supervisor inheritance).
 *
 * Part of the `updateFields` field assembly (see docs/LAYER_SPLIT.md). Decisions
 * only, no SQL, no HTTP. It reads through `@/models/**`.
 */

import { getIntentResponsibleId } from "@/models/tasks";
import { pushTaskField } from "./patch";

/** The intent link, with the best-effort supervisor inheritance from it. */
export async function applyIntentField(patch, { task, input }) {
  const { intent_id, supervisor_id } = input;

  if (
    intent_id === undefined ||
    String(intent_id) === String(task.intent_id || "")
  ) {
    return;
  }

  pushTaskField(patch, "intent_id", intent_id || null, "intent linked");

  // Auto-populate the supervisor from the intent if not explicitly set.
  if (intent_id && !supervisor_id && !task.supervisor_id) {
    try {
      const intentResult = await getIntentResponsibleId(intent_id);
      if (intentResult.rows.length > 0 && intentResult.rows[0].responsible_id) {
        pushTaskField(
          patch,
          "supervisor_id",
          intentResult.rows[0].responsible_id,
          "supervisor inherited from intent",
        );
      }
    } catch {
      /* inheritance is best-effort */
    }
  }
}
