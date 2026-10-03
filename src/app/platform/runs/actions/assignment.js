/**
 * Assigning a run to people, groups and programs, and removing them.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 22 values this module reads into
 * assignmentActions().
 */



export function assignmentActions({
  assignGroupId,
  assignOtherId,
  assignOtherType,
  assignProgramId,
  assignTypes,
  assignUserId,
  confirm,
  notify,
  openRun,
  selectedRun,
  setAssignGroupId,
  setAssignOtherId,
  setAssignOtherType,
  setAssignProgramId,
  setAssignTypes,
  setAssignUserId,
  setAssignments,
  setInlineGroupName,
  setSaving,
  setShowAssign,
  setShowInlineGroup,
  t,
}) {
  const resetAssignModal = () => {
    setAssignTypes({ user: false, group: false, program: false, other: false });
    setAssignUserId("");
    setAssignGroupId("");
    setAssignProgramId("");
    setAssignOtherId("");
    setAssignOtherType("cohort");
  };

  const toggleAssignType = (type) => setAssignTypes((prev) => ({ ...prev, [type]: !prev[type] }));

  const handleAssignWithGroup = (group) => {
    setAssignGroupId(group.registration_id || group.id);
    setAssignTypes((prev) => ({ ...prev, group: true }));
    handleAssign();
  };

  const handleAssign = async () => {
    if (!selectedRun) return;

    const targets = [];
    if (assignTypes.user && assignUserId) targets.push({ target_type: "user", target_id: assignUserId });
    if (assignTypes.group && assignGroupId) targets.push({ target_type: "group", target_id: assignGroupId });
    if (assignTypes.program && assignProgramId) targets.push({ target_type: "program", target_id: assignProgramId });
    if (assignTypes.other && assignOtherId.trim()) targets.push({ target_type: assignOtherType, target_id: assignOtherId.trim() });

    const checkedTypes = Object.keys(assignTypes).filter((typeKey) => assignTypes[typeKey]);
    if (checkedTypes.length === 0) {
      notify(t("platformMisc.runs.assignErrorNoTargets"));
      return;
    }
    const missing = checkedTypes.find((typeKey) =>
      typeKey === "user" ? !assignUserId : typeKey === "group" ? !assignGroupId : typeKey === "program" ? !assignProgramId : !assignOtherId.trim(),
    );
    if (missing) {
      const typeLabel =
        missing === "user" ? t("platformMisc.runs.targetUser")
        : missing === "group" ? t("platformMisc.runs.targetGroup")
        : missing === "program" ? t("platformMisc.runs.targetProgram")
        : t("platformMisc.runs.targetId");
      notify(t("platformMisc.runs.assignErrorMissing", { type: typeLabel }));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/platform/form-runs?action=assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun.id, targets }),
      });
      let data = null;
      try { data = await response.json(); } catch (_) { data = null; }
      if (data && data.success) {
        setAssignments(data.assignments || []);
        const added = data.added ?? targets.length;
        const skipped = data.skipped ?? 0;
        if (added > 0 && skipped > 0) notify(t("platformMisc.runs.assignmentsAddedWithSkipped", { added, skipped }));
        else if (added > 0) notify(t("platformMisc.runs.assignmentsAdded", { count: added }));
        else notify(t("platformMisc.runs.assignmentsSkipped", { count: skipped }));
        setShowAssign(false);
        setShowInlineGroup(false);
        setInlineGroupName("");
        resetAssignModal();
      } else {
        notify(t((data?.error || t("platformMisc.runs.assignFailed")) || "") || (data?.error || t("platformMisc.runs.assignFailed")));
      }
    } catch (_) {
      notify(t("platformMisc.runs.assignFailed"));
    }
    setSaving(false);
  };

  const handleUnassign = async (assignmentId) => {
    try {
      const response = await fetch("/api/platform/form-runs?action=unassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });
      const data = await response.json();
      if (data.success) {
        setAssignments(data.assignments || []);
        notify(t("platformMisc.runs.assignmentRemoved"));
      }
    } catch (_) {}
  };

  const handleDeleteSubmission = async (submissionId) => {
    if (!(await confirm({ message: t("platformMisc.runs.deleteSubmissionConfirm"), tone: "danger" }))) return;
    try {
      const response = await fetch(`/api/platform/form-runs?action=delete_submission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.submissionDeleted"));
        // Reload run data
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(t((data.error || t("platformMisc.runs.deleteFailed")) || "") || (data.error || t("platformMisc.runs.deleteFailed")));
      }
    } catch (_) {}
  };

  return {
    resetAssignModal,
    toggleAssignType,
    handleAssignWithGroup,
    handleAssign,
    handleUnassign,
    handleDeleteSubmission,
  };
}
