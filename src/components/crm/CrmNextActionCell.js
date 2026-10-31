"use client";

import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import { isOverdue } from "@/components/crm/nextActionState";

/**
 * The record's own next action, as a table cell.
 *
 * Lists show the field the owner set. The fallback on the earliest open task or
 * meeting is resolved on the record screen (it needs the activity stream); the
 * list deliberately does not pretend to know it.
 */
export default function CrmNextActionCell({ record }) {
  const { t } = useI18n();

  if (!record?.next_action) {
    return <span className="text-xs text-[var(--text-secondary)]">—</span>;
  }

  const overdue = isOverdue(record.next_action_due);

  return (
    <div className="min-w-0">
      <p className="text-sm text-[var(--text-primary)] truncate">{record.next_action}</p>
      <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-semibold" : "text-[var(--text-secondary)]"}`}>
        {record.next_action_due ? formatDate(new Date(record.next_action_due)) : "—"}
        {overdue ? ` · ${t("crm.activities.nextActionOverdue")}` : ""}
      </p>
    </div>
  );
}
