/**
 * Creating a run, and the group a run can be shared with in one step.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 12 values this module reads into
 * runFormActions().
 */



export function runFormActions({
  createData,
  fetchGroups,
  inlineGroupName,
  notify,
  openRun,
  refreshRuns,
  setCreatingGroup,
  setInlineGroupName,
  setSaving,
  setShowCreate,
  setShowInlineGroup,
  t,
}) {
  const handleCreateGroupInline = async (onDone) => {
    const name = inlineGroupName.trim();
    if (!name) return;
    setCreatingGroup(true);
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (data.success && data.group) {
        notify(t("platformMisc.runs.groupCreated"));
        setShowInlineGroup(false);
        setInlineGroupName("");
        await fetchGroups(true);
        if (onDone) onDone(data.group);
      } else {
        notify(t((data.error || t("platformMisc.runs.failedToCreateGroup")) || "") || (data.error || t("platformMisc.runs.failedToCreateGroup")));
      }
    } catch (_) {
      notify(t("platformMisc.runs.failedToCreateGroup"));
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleCreate = async () => {
    if (!createData.form_id || !createData.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...createData };
      // Attach group assignment if selected
      if (createData.group_id) {
        body.assignments = [{ target_type: "group", target_id: createData.group_id }];
      }
      delete body.group_id; // not a DB column
      const response = await fetch("/api/platform/form-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.formRunCreated"));
        setShowCreate(false);
        refreshRuns();
        openRun(data.run);
      }
    } catch (_) {}
    setSaving(false);
  };

  return {
    handleCreateGroupInline,
    handleCreate,
  };
}
