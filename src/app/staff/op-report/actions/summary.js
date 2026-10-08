/**
 * The summary view's own toggles.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 3 names this module reads into summaryActions().
 */

export function summaryActions({
  setSummaryCollapsed,
  setSummaryProjectExpanded,
  setTaskReasons,
}) {
  const toggleSummaryCollapsed = (key) => {
    setSummaryCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleToggleProject = (key) =>
    setSummaryProjectExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSetTaskReason = (taskId, value) =>
    setTaskReasons((prev) => ({ ...prev, [taskId]: value }));

  return {
    toggleSummaryCollapsed,
    handleToggleProject,
    handleSetTaskReason,
  };
}
