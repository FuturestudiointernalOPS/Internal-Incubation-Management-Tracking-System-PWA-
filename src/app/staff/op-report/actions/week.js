/**
 * The week arrows in the header.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 2 names this module reads into weekActions().
 */

export function weekActions({
  setWeekInfo,
  weekInfo,
}) {
  const navigateWeek = (direction) => {
    const newWeek = weekInfo.week + direction;
    const newYear = weekInfo.year;
    // Simple year boundary
    if (newWeek < 1) {
      setWeekInfo({ week: 52, year: newYear - 1 });
    } else if (newWeek > 52) {
      setWeekInfo({ week: 1, year: newYear + 1 });
    } else {
      setWeekInfo({ week: newWeek, year: newYear });
    }
  };

  return {
    navigateWeek,
  };
}
