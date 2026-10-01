/**
 * CONTACT DUPLICATE FLAGS — the review-queue use-cases.
 *
 * A candidate duplicate pair is a *pending* flag; a reviewer either merges it
 * (the merge route) or dismisses it. Dismissing only ever touches a flag that is
 * still pending, so a merged pair is never overwritten. The page size is clamped
 * here so a large backlog can't blow up the response.
 *
 * Reads and writes go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import { getPendingDuplicateFlags, dismissDuplicateFlag } from "@/models/contacts";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/** Clamp the requested page size (default 200, max 500). */
export function resolveDuplicateFlagLimit(raw) {
  const parsed = parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
}

/** The pending queue, each flag shaped with its two contact identities. */
export async function listPendingDuplicateFlags(rawLimit) {
  const flags = await getPendingDuplicateFlags(resolveDuplicateFlagLimit(rawLimit));
  return flags.rows.map(
    ({ contact_a_name, contact_a_email, contact_b_name, contact_b_email, ...rest }) => ({
      ...rest,
      contact_a: { name: contact_a_name, email: contact_a_email },
      contact_b: { name: contact_b_name, email: contact_b_email },
    }),
  );
}

/** Dismiss a still-pending flag; false when it was missing or already merged. */
export async function dismissPendingDuplicateFlag(id, actorCid) {
  const result = await dismissDuplicateFlag(id, actorCid);
  return !!result.rowsAffected;
}
