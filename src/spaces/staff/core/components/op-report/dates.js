// ─── Week numbering ──────────────────────────────────────────────────────────
// Both the page and the summary cards read the same calendar week, so the two
// helpers are made once here.

export function getWeekNumber(date) {
  const weekDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = weekDate.getUTCDay() || 7;
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(weekDate.getUTCFullYear(), 0, 1));
  return Math.ceil(((weekDate - yearStart) / 86400000 + 1) / 7);
}

export function getCurrentWeek() {
  const now = new Date();
  return { week: getWeekNumber(now), year: now.getFullYear() };
}
