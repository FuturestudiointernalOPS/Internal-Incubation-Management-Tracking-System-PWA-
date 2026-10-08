/**
 * Week navigation: the three handlers behind the header arrows.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 3 names this hook reads into useOpReportNav().
 */

import { useCallback } from "react";

export function useOpReportNav({
  reportType,
  router,
  weekInfo,
}) {
  // The controls ASK FOR another tab or week by changing the address, which is what
  // makes the derived values above the only ones the screen reads. The two names
  // below keep every existing call site working, including the ones that pass an
  // updater, as the setters they replace accepted.
  const goTo = useCallback(
    (next) => {
      const qs = new URLSearchParams({
        tab: next.tab ?? reportType,
        week: String(next.week ?? weekInfo.week),
        year: String(next.year ?? weekInfo.year),
      }).toString();
      router.replace(`/staff/op-report?${qs}`, { scroll: false });
    },
    [router, reportType, weekInfo.week, weekInfo.year],
  );

  const setReportType = useCallback((tab) => goTo({ tab }), [goTo]);

  const setWeekInfo = useCallback(
    (next) => {
      const value = typeof next === "function" ? next(weekInfo) : next;
      goTo({ week: value.week, year: value.year });
    },
    [goTo, weekInfo],
  );

  return {
    goTo,
    setReportType,
    setWeekInfo,
  };
}
