/**
 * The stand-up form rows: priorities, deliverables, wins, carry-over, tasks, subtasks.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 20 names this module reads into formRowActions().
 */

export function formRowActions({
  newCarryover,
  newDeliverable,
  newPriority,
  newTaskForm,
  newWin,
  setConfirmTarget,
  setForm,
  setNewCarryover,
  setNewDeliverable,
  setNewPriority,
  setNewTaskForm,
  setNewWin,
  setShowTaskForm,
  setSubTaskModal,
  setSubTaskName,
  setTaskRows,
  subTaskModal,
  subTaskName,
  taskRows,
  user,
}) {
  // ─── BULLET-LIST ITEM HANDLERS (priorities / deliverables / wins / carryover) ───
  const _addPriority = () => {
    const value = newPriority.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      top_priorities: [...(prev.top_priorities || []), value],
    }));
    setNewPriority("");
  };

  const _addDeliverable = () => {
    const value = newDeliverable.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      expected_deliverables: [...(prev.expected_deliverables || []), value],
    }));
    setNewDeliverable("");
  };

  const _addWin = () => {
    const value = newWin.trim();
    if (!value) return;
    setForm((prev) => ({ ...prev, wins: [...(prev.wins || []), value] }));
    setNewWin("");
  };

  const _addCarryover = () => {
    const value = newCarryover.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      carryover_items: [...(prev.carryover_items || []), value],
    }));
    setNewCarryover("");
  };

  const _addSubTaskRow = (parentRowId) => {
    setSubTaskModal(parentRowId);
    setSubTaskName("");
  };

  const _addSubTaskFromModal = () => {
    const name = subTaskName.trim();
    if (!name) return;
    const parentId = subTaskModal;
    setTaskRows((prev) => {
      const newRow = {
        id: Date.now(),
        name,
        description: "",
        project_id: prev.find((row) => row.id === parentId)?.project_id || null,
        category: prev.find((row) => row.id === parentId)?.category || "",
        start_date: "",
        start_time: "",
        due_date: "",
        due_time: "",
        blockers: [],
        collaborators: [],
        parent_task_id: parentId,
        status: null,
        uncompleted_reason: "",
      };
      const parentIdx = prev.findIndex((row) => row.id === parentId);
      if (parentIdx !== -1) {
        const updated = [...prev];
        updated.splice(parentIdx + 1, 0, newRow);
        return updated;
      }
      return [...prev, newRow];
    });
    setSubTaskName("");
  };

  const _addTaskRow = () => {
    if (!newTaskForm.name.trim()) return;
    setTaskRows((prev) => {
      const newRow = {
        id: Date.now(),
        name: newTaskForm.name.trim(),
        description: "",
        project_id: newTaskForm.project_id || null,
        category: newTaskForm.category || "",
        start_date: newTaskForm.start_date || "",
        start_time: newTaskForm.start_time || "",
        due_date: newTaskForm.due_date || "",
        due_time: newTaskForm.due_time || "",
        blockers: [],
        collaborators: newTaskForm.collaborator
          ? [
              {
                id: newTaskForm.collaborator,
                note: newTaskForm.collaborator_note,
              },
            ]
          : [],
        parent_task_id: null,
        status: null,
        uncompleted_reason: "",
      };
      return [...prev, newRow];
    });
    setNewTaskForm({
      name: "",
      project_id: "",
      category: "",
      start_date: "",
      start_time: "",
      due_date: "",
      due_time: "",
      collaborator: "",
      collaborator_note: "",
      project_search: "",
      show_dropdown: false,
    });
    setShowTaskForm(false);
  };

  const _updateTaskRow = (index, field, value) => {
    setTaskRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const _removeTaskRow = (index) => {
    const row = taskRows[index];
    if (!row?.status) {
      setTaskRows((prev) =>
        prev.filter((_, currentIndex) => currentIndex !== index),
      );
      return;
    }
    setConfirmTarget({
      id: row.id,
      message: "Are you sure you want to archive this task?",
      onConfirm: () => performArchiveTask(index),
    });
  };

  const performArchiveTask = async (index) => {
    const row = taskRows[index];
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          status: "archived",
          user_id: user?.cid || user?.id,
        }),
      });
      if (!response.ok) throw new Error("Failed to archive task");
    } catch (err) {
      console.error(err);
      return;
    }
    setTaskRows((prev) =>
      prev.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  return {
    _addPriority,
    _addDeliverable,
    _addWin,
    _addCarryover,
    _addSubTaskRow,
    _addSubTaskFromModal,
    _addTaskRow,
    _updateTaskRow,
    _removeTaskRow,
    performArchiveTask,
  };
}
