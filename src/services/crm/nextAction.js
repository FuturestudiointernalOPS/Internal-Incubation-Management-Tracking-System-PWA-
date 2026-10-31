import { isPlatformOwnerRole } from "@/lib/identity";

/**
 * CRM — the next action of a lead or an opportunity (DECISION layer).
 *
 * Product rules settled for Lot 1:
 *  - the next action is a first-class attribute of the record: a label and a
 *    due date, kept next to the record rather than inferred;
 *  - the record OWNER sets it. A platform owner may also set it, for support and
 *    repair, which keeps a record recoverable when its owner has left;
 *  - a label requires a due date — the whole point is that a date can go
 *    overdue, and the screens show that lateness everywhere;
 *  - clearing is allowed: the next action is not mandatory;
 *  - automation rules never write it. The engine can create a task, not decide
 *    what comes next.
 *
 * When the field is empty, the screens fall back to the earliest open task or
 * meeting, so a record is never silently without a next step.
 */

/** Does this request body touch the next action at all? */
export function touchesNextAction(body) {
  return body?.next_action !== undefined || body?.next_action_due !== undefined;
}

/**
 * Validate a next-action write and return the columns to persist.
 *
 * @returns {{updates: object, cleared: boolean} | {error: string, status: number}}
 */
export function planNextActionWrite({ body, existing, session }) {
  const isOwner = Boolean(existing?.owner_cid) && existing.owner_cid === session?.cid;

  if (!isOwner && !isPlatformOwnerRole(session?.role)) {
    return {
      // Two distinct messages on purpose: "assign an owner first" is actionable,
      // "not yours" is not.
      error: existing?.owner_cid
        ? "crm.activities.nextActionOwnerOnly"
        : "crm.activities.nextActionAssignOwner",
      status: 403,
    };
  }

  const rawLabel = body?.next_action;
  const label = typeof rawLabel === "string" ? rawLabel.trim() : rawLabel ?? null;

  if (!label) {
    return {
      updates: {
        next_action: null,
        next_action_due: null,
        next_action_set_by: session?.cid ?? null,
        next_action_set_at: new Date(),
      },
      cleared: true,
    };
  }

  if (!body?.next_action_due) {
    return { error: "crm.activities.nextActionDateRequired", status: 400 };
  }

  const due = new Date(body.next_action_due);
  if (Number.isNaN(due.getTime())) {
    return { error: "crm.activities.nextActionDateRequired", status: 400 };
  }

  return {
    updates: {
      next_action: label,
      next_action_due: body.next_action_due,
      next_action_set_by: session?.cid ?? null,
      next_action_set_at: new Date(),
    },
    cleared: false,
  };
}

/** The timeline sentence for a next-action change (stored data, not UI copy). */
export function nextActionTimelineEvent(plan) {
  return plan.cleared
    ? "Next action cleared"
    : `Next action: ${plan.updates.next_action}`;
}
