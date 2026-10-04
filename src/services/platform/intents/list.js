/**
 * Platform — intents: the list use case (SERVICE layer).
 *
 * The filtered Intent list: the own-responsible security refusal, the filtered
 * read through the repository, and the single batched task-count join. Split of
 * `services/platform/intents.js` — see docs/LAYER_SPLIT.md; the barrel at the
 * original path re-exports the same surface.
 *
 * Layer: decisions and shaping, no SQL, no HTTP. It reads through `@/models/**`.
 */

import { getIntentsByFilters, getIntentTaskCounts } from "@/models/intents";

/**
 * GET /api/intents — list intents filtered by context, status, responsible.
 *
 * SECURITY: a non-SA session may only ask for its OWN id as `responsible_id`;
 * the repository still narrows the row scope, but the refusal is a decision.
 */
export async function listIntentsForSession({ session, filters }) {
  const { contextType, contextId, responsibleId, status, projectId } = filters;

  if (
    session.role !== "super_admin" &&
    responsibleId &&
    String(responsibleId) !== String(session.cid)
  ) {
    return {
      status: 403,
      body: { success: false, error: "You can only view your own intents." },
    };
  }

  // SQL assembled in src/models/intents.js (getIntentsByFilters)
  const result = await getIntentsByFilters({
    isSuperAdmin: session.role === "super_admin",
    sessionCid: session.cid,
    responsibleId,
    contextType,
    contextId,
    status,
    projectId,
  });

  // Batch per-intent task counts into ONE grouped query instead of one query per
  // intent. Produces identical `taskCounts` per intent.
  const intentIds = result.rows.map((intent) => String(intent.id));
  const countMap = {};
  if (intentIds.length > 0) {
    const countResult = await getIntentTaskCounts(intentIds);
    for (const countRow of countResult.rows || []) countMap[countRow.iid] = countRow;
  }

  const intents = result.rows.map((intent) => {
    const intentId = String(intent.id);
    return {
      ...intent,
      taskCounts: countMap[intentId] || {
        active_count: 0,
        completed_count: 0,
        total_count: 0,
      },
    };
  });

  return { status: 200, body: { success: true, intents } };
}
