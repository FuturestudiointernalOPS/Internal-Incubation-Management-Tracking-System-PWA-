/**
 * KPI and personnel actions: defining/decommissioning a program KPI, assigning
 * and removing program staff, and the KPI recalculation the config tab offers.
 */

export function kpiActions({
  t,
  notify,
  id,
  user,
  newKPI,
  newStaff,
  assignedStaff,
  setNewKPI,
  setNewStaff,
  setShowKPIModal,
  setShowStaffModal,
  setConfirmTarget,
  setIsSaving,
  fetchProgramData,
}) {
  const addKPI = async () => {
    if (user.role !== "super_admin") {
      notify(t("pmMisc.workspace.superAdminKpiDefineOnly"), "error");
      return;
    }
    if (!newKPI.title.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/v2/kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newKPI, program_id: id }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.kpiDefined"));
        setShowKPIModal(false);
        setNewKPI({ title: "" });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.failed") || "") ||
            data.error ||
            t("pmMisc.workspace.failed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const _removeKPI = (kpiId) => {
    if (user.role !== "super_admin") {
      notify(t("pmMisc.workspace.superAdminKpiRemoveOnly"), "error");
      return;
    }
    setConfirmTarget({
      id: kpiId,
      message: t("pmMisc.workspace.confirmDecommissionKpi"),
      onConfirm: () => performRemoveKPI(kpiId),
    });
  };

  const performRemoveKPI = async (kpiId) => {
    try {
      await fetch("/api/v2/kpis", {
        method: "DELETE",
        body: JSON.stringify({ id: kpiId }),
      });
      notify(t("pmMisc.workspace.kpiRemoved"));
      fetchProgramData(true);
    } catch {}
  };

  const assignStaff = async () => {
    if (!newStaff.staff_id) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/v2/program-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newStaff, program_id: id }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.personnelAssigned"));
        setShowStaffModal(false);
        setNewStaff({ staff_id: "", role: "staff" });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.assignmentFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.assignmentFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const removeStaff = (staffId) => {
    setConfirmTarget({
      id: staffId,
      message: t("pmMisc.workspace.confirmRemoveStaff"),
      onConfirm: () => performRemoveStaff(staffId),
    });
  };

  const performRemoveStaff = async (staffId) => {
    try {
      const record = assignedStaff.find((member) => member.cid === staffId);
      if (record && record.id) {
        await fetch("/api/v2/program-staff", {
          method: "DELETE",
          body: JSON.stringify({ id: record.id }),
        });
        notify(t("pmMisc.workspace.personnelRemoved"));
        fetchProgramData(true);
      }
    } catch {}
  };

  const handleRecalculateKpis = async () => {
    try {
      const response = await fetch(`/api/kpi-progress?program_id=${id}`);
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.kpiRecalculated"));
        fetchProgramData(true);
      }
    } catch (_) {
      notify(t("pmMisc.workspace.recalculationFailed"), "error");
    }
  };

  return {
    addKPI,
    _removeKPI,
    assignStaff,
    removeStaff,
    handleRecalculateKpis,
  };
}
