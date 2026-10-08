/**
 * The reminder engine — sending ONE reminder, manually or on a schedule
 * (SERVICE layer).
 *
 * Used by two controllers and nobody else: the Venture reminders route (a person
 * pressed Send) and the sweep endpoint (a clock did). Both go through the same
 * function so a manual reminder and an automatic one cannot drift apart.
 *
 * THE ORDER OF OPERATIONS IS THE DESIGN
 *
 * A reminder is CLAIMED in the log before it is sent: the insert carries the
 * dedupe key, and the database refuses a second row for the same key. Only then
 * does the email go out. A claim that the send failed is turned into a `failed`
 * row, which releases the slot so the next sweep may try again.
 *
 * Claiming first is what makes the guard real. Checking "has this been sent?"
 * and then sending is two steps with a gap, and two runs of the sweep inside
 * that gap would both send. A manual reminder carries NO key, so it is never
 * refused — asking twice on purpose is a legitimate thing to do.
 *
 * A recipient with no address is not a failure and not a silent skip: the send
 * reports them, and the caller tells the person who pressed the button.
 */

import { sendVentureReminderEmail } from "@/lib/email";
import {
  insertReminderLog,
  markReminderFailed,
  markReminderSent,
} from "@/models/ventureReminders";
import { reminderKey } from "./rules";
import { normalizeEmail, resolveWorkItemRecipients, splitReachable } from "./recipients";

/** Send one reminder to one recipient, claiming it in the log first. */
async function deliverOne({
  ventureCode,
  ventureName,
  item,
  recipient,
  trigger,
  watchedDate,
  daysLeft,
  ruleId,
  sentBy,
  automatic,
}) {
  const itemId = String(item.id || "");
  const [kind, ...ownParts] = itemId.split(":");
  const own = ownParts.join(":");

  const dedupeKey = automatic
    ? reminderKey({ ventureId: ventureCode, item, trigger, date: watchedDate, email: recipient.email })
    : null;

  const claim = await insertReminderLog({
    ventureId: ventureCode,
    workItemKind: kind || "unknown",
    workItemId: own || itemId,
    workItemRef: item.ref || null,
    workItemTitle: item.title || null,
    ruleId: ruleId ?? null,
    trigger,
    recipientName: recipient.name || null,
    recipientEmail: normalizeEmail(recipient.email) || String(recipient.email || ""),
    recipientRole: recipient.role || null,
    // Claimed as 'sent' so it holds the dedupe slot; corrected below if the
    // transport says otherwise.
    status: "sent",
    dedupeKey,
    sentAt: null,
  });

  // No row returned means the key was already taken: this exact reminder has
  // been sent before, and sending it again is the thing we are preventing.
  if (!claim.rows?.length) {
    return { email: recipient.email, name: recipient.name, role: recipient.role, outcome: "already_sent" };
  }

  const logId = claim.rows[0].id;
  const result = await sendVentureReminderEmail({
    to: recipient.email,
    item,
    ventureName,
    ventureCode,
    trigger,
    daysLeft: daysLeft === null || daysLeft === undefined ? null : daysLeft,
    watchedDate,
    sentBy,
    contact_cid: recipient.cid || null,
  });

  if (!result?.success) {
    const raw = result?.error != null ? result.error : result?.note;
    const errorText =
      raw == null || raw === ""
        ? "the transport refused the message"
        : typeof raw === "string"
          ? raw
          : (() => {
              try {
                return JSON.stringify(raw);
              } catch {
                return String(raw);
              }
            })();
    await markReminderFailed({ id: logId, error: errorText });
    return {
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      outcome: "failed",
      error: errorText,
    };
  }

  await markReminderSent({ id: logId, sentAt: new Date().toISOString() });
  return { email: recipient.email, name: recipient.name, role: recipient.role, outcome: "sent" };
}

/** Shared tail: resolve recipients, send to each reachable one, report the rest. */
async function deliver({
  ventureCode,
  ventureName,
  item,
  trigger,
  watchedDate,
  daysLeft,
  includeSupporting,
  ruleId,
  sentBy,
  automatic,
}) {
  const recipients = await resolveWorkItemRecipients({
    ventureId: ventureCode,
    item,
    includeOwner: true,
    includeSupporting,
  });
  const { reachable, unreachable } = splitReachable(recipients);

  const results = [];
  for (const recipient of reachable) {
    results.push(
      await deliverOne({
        ventureCode,
        ventureName,
        item,
        recipient,
        trigger,
        watchedDate,
        daysLeft,
        ruleId,
        sentBy,
        automatic,
      }),
    );
  }

  return {
    workItem: { id: item.id, ref: item.ref || null, title: item.title || null },
    trigger,
    sent: results.filter((entry) => entry.outcome === "sent").length,
    // Reported, not hidden: a reminder that reached nobody is an answer the
    // person who asked for it must see.
    already_sent: results.filter((entry) => entry.outcome === "already_sent").length,
    failed: results.filter((entry) => entry.outcome === "failed"),
    results,
    unreachable: unreachable.map((entry) => ({ name: entry.name, role: entry.role, reason: entry.reason })),
    // Nobody had an address at all — the caller says "no email on file" rather
    // than reporting a send that never happened.
    no_recipients: reachable.length === 0,
  };
}

/**
 * A person pressed Send. Goes to the Owner and to the people supporting them:
 * the manager does not choose recipients, the work item already knows them.
 *
 * Never deduped — pressing Send twice is a request, not a mistake.
 */
export async function sendManualReminder({ ventureCode, ventureName, item, sentBy = null }) {
  if (!item?.id) return { error: "item_required" };
  return deliver({
    ventureCode,
    ventureName,
    item,
    trigger: "manual",
    watchedDate: item.finish || item.start || null,
    daysLeft: null,
    includeSupporting: true,
    ruleId: null,
    sentBy,
    automatic: false,
  });
}

/**
 * A rule came due. The recipients are the rule's own choice, and the reminder is
 * claimed in the log so it can never be sent twice for the same occurrence.
 */
export async function sendRuleReminder({ ventureCode, ventureName, item, rule, trigger, watchedDate, daysLeft }) {
  return deliver({
    ventureCode,
    ventureName,
    item,
    trigger,
    watchedDate,
    daysLeft,
    includeSupporting: rule?.notify_supporting === true,
    ruleId: rule?.id ?? null,
    sentBy: null,
    automatic: true,
  });
}
