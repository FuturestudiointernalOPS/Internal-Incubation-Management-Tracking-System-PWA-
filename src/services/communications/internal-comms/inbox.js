
import { ensureMessagesIsDeletedColumn } from "@/models/communications";
import { listMessagesForScope } from "@/services/communications/messageScope";

import { resolveUserMessageScope } from "./scope";
// ─── Use-cases ───────────────────────────────────────────────────────────────

/** Whether the caller may read the messages of `cid` (own inbox, or any as SA). */
export function mayReadInbox(session, cid) {
  return session.role === "super_admin" || cid === session.cid;
}

/** The inbox for `cid` under the caller's scope. */
export async function readMessageInbox({ session, cid }) {
  const targetCid = cid || session.cid;

  // Ensure is_deleted column exists (safe migration)
  try {
    await ensureMessagesIsDeletedColumn();
  } catch (_) {}

  // Message visibility policy lives in listMessagesForScope (./messageScope):
  // SA sees everything (individual + broadcasts); everyone else sees their own
  // messages + group/program messages for the groups/programs they belong to.
  let scope = null;
  if (session.role !== "super_admin") {
    scope = await resolveUserMessageScope(session);
  }

  const messagesResult = await listMessagesForScope({
    isSuperAdmin: session.role === "super_admin",
    targetCid,
    groupIds: scope ? Array.from(scope.groupIds) : [],
    programIds: scope ? Array.from(scope.programIds) : [],
    isFutureStudioStaff: scope ? scope.isFutureStudioStaff : false,
  });
  return messagesResult.rows;
}

