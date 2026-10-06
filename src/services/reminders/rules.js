/**
 * Reminder rules — when a reminder is due, and who it covers (SERVICE layer).
 *
 * `days_before` is a SETTING on every rule, never a constant in the code. The
 * platform's older reminder jobs hardcode "within 24 hours"; nothing here may.
 *
 * TWO DECISIONS WORTH KNOWING BEFORE CHANGING ANYTHING
 *
 * 1. A reminder fires the FIRST time the sweep sees the work item inside the
 *    window, not only on the exact day. A sweep that did not run (an outage, a
 *    paused scheduler) must not silently swallow a reminder, so the window is
 *    `0 <= days left <= days_before` and it is the log — not arithmetic — that
 *    keeps it to one send.
 *
 * 2. Its identity is (work item, trigger, the DATE the rule watches, the
 *    recipient). That is what makes "3 days before Start" send once and not
 *    again tomorrow: tomorrow is still inside the window, but the key it would
 *    claim is already taken, and the database refuses the second row.
 *
 * No SQL, no HTTP: reads and writes go through `@/models/**`.
 */

export const REMINDER_TRIGGERS = ["start", "finish"];

/**
 * The level a Venture-wide rule covers unless it says otherwise: the ACTIVITY.
 *
 * ONE TRACKER ROW IS THREE WORK ITEMS. A row becomes an activity, the
 * deliverable it produces, and the milestone above it — and all three carry the
 * same source reference, because they are the same row seen at three levels. A
 * rule that covered every kind would therefore email the owner THREE TIMES about
 * one line of the tracker.
 *
 * The activity is the level that carries the owner, the dates and the Definition
 * of Done, so it is the level a reminder is about. A rule may still name another
 * kind — a milestone that holds nothing is worth chasing — but it is a choice,
 * not the default.
 */
export const DEFAULT_RULE_KIND = "activity";

/** The kinds a rule may target. */
export const RULE_KINDS = ["activity", "milestone", "deliverable"];

/** A kind this platform knows how to remind about, or the default. */
export function normalizeRuleKind(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return RULE_KINDS.includes(text) ? text : DEFAULT_RULE_KIND;
}

/** How far ahead a rule may look. A guard rail, not a policy. */
export const MAX_DAYS_BEFORE = 60;

/** A whole number of days inside the allowed range, or null. */
export function normalizeDaysBefore(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return null;
  const whole = Math.trunc(days);
  if (whole < 0 || whole > MAX_DAYS_BEFORE) return null;
  return whole;
}

/** Split a work item id (`activity:41`) into its kind and its own id. */
export function splitWorkItemId(id) {
  const [kind, ...rest] = String(id ?? "").split(":");
  const own = rest.join(":");
  return kind && own ? { kind, own } : null;
}

/** The date on a work item a trigger watches, as YYYY-MM-DD, or null. */
export function triggerDate(item, trigger) {
  return trigger === "start" ? item?.start || null : item?.finish || null;
}

/** Whole days from `today` to `date` (negative when the date has passed). */
export function daysUntil(today, date) {
  if (!today || !date) return null;
  const from = Date.parse(`${today}T00:00:00Z`);
  const to = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

/** Whether a rule is written for this work item. */
function ruleCoversItem(rule, item) {
  const itemId = splitWorkItemId(item?.id);
  if (!itemId) return false;
  if (rule.scope === "work_item") {
    return String(rule.work_item_kind) === itemId.kind && String(rule.work_item_id) === itemId.own;
  }
  // A Venture-wide rule covers ONE level — see DEFAULT_RULE_KIND for why it must
  // not cover all three.
  return normalizeRuleKind(rule.work_item_kind) === itemId.kind;
}

/**
 * The rules in force for ONE work item.
 *
 * A per-item rule REPLACES the Venture default for the same trigger — that is
 * what an override means; two rules for one trigger would send two reminders.
 */
export function rulesForItem(rules = [], item) {
  const applicable = (rules || []).filter((rule) => rule.is_active !== false && ruleCoversItem(rule, item));
  const byTrigger = new Map();
  for (const rule of applicable) {
    const existing = byTrigger.get(rule.trigger);
    // A work_item rule wins over a venture one; otherwise first in wins.
    if (!existing || (existing.scope !== "work_item" && rule.scope === "work_item")) {
      byTrigger.set(rule.trigger, rule);
    }
  }
  return [...byTrigger.values()];
}

/**
 * Every reminder that is DUE today, across a Venture's work items.
 *
 * Completed work is never reminded: a finished activity needs no nudge.
 * A work item with no date for a trigger simply has nothing to compare.
 */
export function dueReminders({ items = [], rules = [], today } = {}) {
  const due = [];
  for (const item of items) {
    if (item.is_complete) continue;
    for (const rule of rulesForItem(rules, item)) {
      const date = triggerDate(item, rule.trigger);
      const left = daysUntil(today, date);
      if (left === null) continue;
      // Inside the window, and not already past due by more than a day — a
      // reminder for work that went overdue a month ago is noise, not a service.
      if (left < 0 || left > rule.days_before) continue;
      due.push({ item, rule, trigger: rule.trigger, date, daysLeft: left });
    }
  }
  return due;
}

/**
 * The identity of one automatic reminder.
 *
 * Deliberately includes the DATE the rule watched, so the same rule on the same
 * work item may fire once per occurrence but never twice for one.
 */
export function reminderKey({ ventureId, item, trigger, date, email }) {
  return [
    "reminder",
    String(ventureId),
    String(item?.id ?? ""),
    String(trigger),
    String(date),
    String(email || "").toLowerCase(),
  ].join(":");
}
