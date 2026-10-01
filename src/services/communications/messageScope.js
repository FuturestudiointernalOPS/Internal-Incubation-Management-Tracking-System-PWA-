import { selectMessagesForScope } from "@/models/messageScopeStore";

/**
 * Communications service — who may see which message.
 *
 * A Super Admin sees everything (individual messages and broadcasts), optionally
 * narrowed to one participant. Everyone else sees their own individual messages
 * plus group/program messages for the groups/programs they belong to; broadcasts
 * stay Super-Admin-only, except the FUTURE STUDIO staff broadcast.
 *
 * Layer (see docs/LAYER_SPLIT.md): the policy is decided here and encoded as a
 * plan; the statement lives in `@/models/messageScopeStore`.
 */
export async function listMessagesForScope({
  isSuperAdmin,
  targetCid,
  groupIds,
  programIds,
  isFutureStudioStaff,
}) {
  const plan = isSuperAdmin
    ? { mode: "all", targetCid: targetCid || null }
    : {
        mode: "scoped",
        targetCid,
        includeStaffBroadcast: Boolean(isFutureStudioStaff),
        groupIds,
        programIds,
      };

  return selectMessagesForScope(plan);
}
