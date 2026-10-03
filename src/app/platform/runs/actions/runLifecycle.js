/**
 * Launching, re-statusing, archiving, restoring and deleting a run.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 5 values this module reads into
 * runLifecycleActions().
 */



export function runLifecycleActions({
  confirm,
  notify,
  refreshRuns,
  setSelectedRun,
  t,
}) {
  const handleLaunch = async (id) => {
    try {
      const response = await fetch("/api/platform/form-runs?action=launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.runLaunched"));
        refreshRuns();
        setSelectedRun(data.run);
      }
    } catch (_) {}
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const response = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.runStatusChanged", { status: newStatus }));
        setSelectedRun(data.run);
        refreshRuns();
      }
    } catch (_) {}
  };

  const handleDeleteRun = async (id) => {
    if (!(await confirm({ message: t("platformMisc.runs.deleteRunConfirm"), tone: "danger" }))) return;
    try {
      const response = await fetch(`/api/platform/form-runs?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.runDeleted"));
        setSelectedRun(null);
        refreshRuns();
      }
    } catch (_) {}
  };

  const handleArchiveRun = async (id) => {
    if (!(await confirm({ message: t("platformMisc.runs.archiveRunConfirm"), tone: "danger" }))) return;
    try {
      const response = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "archived" }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.runStatusChanged", { status: "archived" }));
        refreshRuns();
      }
    } catch (_) {}
  };

  const handleRestoreRun = async (id) => {
    if (!(await confirm({ message: t("platformMisc.runs.restoreRunConfirm") }))) return;
    try {
      const response = await fetch("/api/platform/form-runs?action=status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "draft" }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.runStatusChanged", { status: "draft" }));
        refreshRuns();
      }
    } catch (_) {}
  };

  return {
    handleLaunch,
    handleStatusChange,
    handleDeleteRun,
    handleArchiveRun,
    handleRestoreRun,
  };
}
