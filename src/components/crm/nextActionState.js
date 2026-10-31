/**
 * Small date helpers shared by the next-action card and the list cells.
 * A date is "overdue" when its calendar day is strictly before today, in the
 * reader's timezone — a deadline set for today is not late yet.
 */

export function isOverdue(date) {
  if (!date) return false;
  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay.getTime() < today.getTime();
}

/** `YYYY-MM-DD` for an <input type="date">, in local time. */
export function toDateInputValue(date) {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (value) => String(value).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}
