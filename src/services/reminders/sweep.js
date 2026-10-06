/**
 * The reminder sweep — what a scheduled run does (SERVICE layer).
 *
 * Called by the cron endpoint. For every Venture that has at least one active
 * rule it:
 *
 *   reads the work items (the SAME ones the Projects screen shows),
 *   works out which rules came due today,
 *   resolves who each reminder reaches,
 *   sends, and records the outcome.
 *
 * A Venture with no active rules is not touched, and nothing here reads or
 * writes Venture work — reminders only ever append to the reminder log.
 *
 * One Venture failing must not stop the others: a sweep that aborts on the first
 * bad row silently stops chasing everything after it.
 */

import { getVentureDbIdByCodeOrId, getVentureNameByIdOrCode } from "@/models/ventureWorkspace";
import { selectReminderRules, selectVenturesWithActiveRules } from "@/models/ventureReminders";
import { buildWorkItems } from "@/services/workItems";
import { sendRuleReminder } from "./engine";
import { dueReminders } from "./rules";

/** Today as the rest of the platform derives it (UTC day). */
export function sweepToday(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Remind every Venture whose rules came due.
 *
 * @param {object} [options]
 * @param {string|null} [options.ventureCode] — sweep ONE Venture (a manual test
 *   run, or a re-run after a fix). Omit to sweep every Venture with rules.
 * @param {Date} [options.now]
 * @returns {Promise<object>} a per-Venture report; nothing is summarised away.
 */
export async function runReminderSweep({ ventureCode = null, now = new Date() } = {}) {
  const today = sweepToday(now);
  const codes = ventureCode
    ? [String(ventureCode)]
    : ((await selectVenturesWithActiveRules()).rows || []).map((row) => String(row.venture_id));

  const report = { today, ventures: [], sent: 0, skipped: 0, failed: 0, no_recipients: 0 };

  for (const code of codes) {
    const entry = { venture: code, name: null, due: 0, sent: 0, already_sent: 0, failed: 0, no_recipients: 0, errors: [] };
    try {
      const dbIdResult = await getVentureDbIdByCodeOrId(code).catch(() => ({ rows: [] }));
      const dbId = dbIdResult.rows?.[0]?.id || null;
      if (!dbId) {
        entry.errors.push("the Venture could not be resolved");
        report.ventures.push(entry);
        continue;
      }

      const nameResult = await getVentureNameByIdOrCode(code).catch(() => ({ rows: [] }));
      entry.name = nameResult.rows?.[0]?.company_name || nameResult.rows?.[0]?.name || null;

      const rulesResult = await selectReminderRules(code).catch(() => ({ rows: [] }));
      const rules = (rulesResult.rows || []).filter((rule) => rule.is_active !== false);
      if (rules.length === 0) {
        report.ventures.push(entry);
        continue;
      }

      const { items } = await buildWorkItems({ dbId, ventureCode: code, now });
      const due = dueReminders({ items, rules, today });
      entry.due = due.length;

      for (const reminder of due) {
        const outcome = await sendRuleReminder({
          ventureCode: code,
          ventureName: entry.name,
          item: reminder.item,
          rule: reminder.rule,
          trigger: reminder.trigger,
          watchedDate: reminder.date,
          daysLeft: reminder.daysLeft,
        });
        entry.sent += outcome.sent;
        entry.already_sent += outcome.already_sent;
        entry.failed += outcome.failed.length;
        if (outcome.no_recipients) entry.no_recipients += 1;
        for (const failure of outcome.failed) {
          entry.errors.push(`${reminder.item.ref || reminder.item.title}: ${failure.error || "send failed"}`);
        }
      }
    } catch (error) {
      entry.errors.push(error?.message || String(error));
    }

    report.sent += entry.sent;
    report.skipped += entry.already_sent;
    report.failed += entry.failed;
    report.no_recipients += entry.no_recipients;
    report.ventures.push(entry);
  }

  return report;
}
