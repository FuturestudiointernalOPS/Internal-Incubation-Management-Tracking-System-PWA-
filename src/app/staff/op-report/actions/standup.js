/**
 * The stand-up history: open, toggle, and the modals' close/save.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 14 names this module reads into standupActions().
 */

import {
  getWeekNumber,
  getCurrentWeek,
} from "@/components/staff/op-report/dates";

export function standupActions({
  handleSubmit,
  openStandupModal,
  setExpandedWeek,
  setIsHistorical,
  setNewTaskForm,
  setReadOnly,
  setShowStandupModal,
  setShowTaskForm,
  setTaskCreationOpen,
  setTaskRows,
  setWeekInfo,
  tasks,
  user,
  weekInfo,
}) {
  const handleOpenNewStandup = async () => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      weekInfo.week !== currentWeek.week || weekInfo.year !== currentWeek.year;
    setReadOnly(isPastWeek);
    setIsHistorical(isPastWeek);
    openStandupModal();

    // Only the current week's "new standup" flow pre-fills
    // carry-over tasks from previous weeks.
    if (isPastWeek) return;

    // ─── Compute current reporting week ───
    const now = new Date();
    const curWeek = getWeekNumber(now);
    const curYear = now.getFullYear();

    // ─── Fetch ALL tasks for user and filter past incomplete tasks ───
    const userId = user?.cid || user?.id;
    try {
      const response = await fetch(`/api/tasks?user_id=${userId}&sort=oldest`);
      const data = await response.json();
      const allTasks = data.tasks || [];

      // ── Collapse carry-over chains to their LATEST open copy ──
      // Every week a carried task is cloned (clone -> source via
      // carried_over_from_task_id). Pre-filling every chain member
      // made one submit clone the same task several times and flip
      // earlier copies (even completed ones) to 'carried_over'.
      // Only the newest open copy may be carried, and only once.
      const cloneIndex = new Map(); // source id -> clones
      for (const task of allTasks) {
        if (!task.carried_over_from_task_id) continue;
        const list = cloneIndex.get(task.carried_over_from_task_id) || [];
        list.push(task);
        cloneIndex.set(task.carried_over_from_task_id, list);
      }
      const latestOpenCopy = (task) => {
        let current = task;
        const seen = new Set();
        while (!seen.has(current.id)) {
          seen.add(current.id);
          const next = (cloneIndex.get(current.id) || [])
            .filter(
              (clone) => !["archived", "completed"].includes(clone.status),
            )
            .sort(
              (first, second) =>
                second.created_year - first.created_year ||
                second.created_week - first.created_week ||
                second.id - first.id,
            )[0];
          if (!next) break;
          current = next;
        }
        return current;
      };

      const chainsToCarry = new Map(); // head id -> task
      for (const task of allTasks) {
        // Only open, top-level tasks from earlier weeks can start a carry.
        if (
          ["archived", "completed"].includes(task.status) ||
          task.parent_task_id ||
          (task.created_week === curWeek && task.created_year === curYear)
        )
          continue;
        const head = latestOpenCopy(task);
        // Already carried into the current week — nothing to do.
        if (head.created_week === curWeek && head.created_year === curYear)
          continue;
        if (!chainsToCarry.has(head.id)) {
          chainsToCarry.set(head.id, head);
        }
      }
      const prevWeekTasks = [...chainsToCarry.values()];

      if (prevWeekTasks.length > 0) {
        // Subtasks are NOT pre-filled individually: they follow
        // their parent clone automatically (the carry-over API
        // re-parents them), which keeps the hierarchy intact.
        const allTaskRows = prevWeekTasks.map((task) => ({
          id: task.id,
          is_carryover: true,
          carried_over_from_task_id: task.id,
          name: task.title,
          description: task.description || "",
          project_id: task.project_id || null,
          category: task.category || "",
          start_date: task.start_date || "",
          start_time: "",
          due_date: task.end_date || "",
          due_time: "",
          blockers:
            task.blockers?.map((blocker) => ({
              id: blocker.id,
              description: blocker.title,
              severity: blocker.severity || "medium",
              status: blocker.status || "Active",
              created_at: blocker.created_at,
            })) || [],
          parent_task_id: null,
          status: task.status,
          collaborators: [],
          uncompleted_reason: "",
        }));
        setTaskRows(allTaskRows);
        setShowTaskForm(false);
        return;
      }
      setShowTaskForm(false);
    } catch (error) {
      console.error("Failed to fetch previous week tasks:", error);
    }
    setShowTaskForm(true);
  };

  const handleToggleStandupWeek = (report) => {
    const weekKey = `${report.week_number}-${report.year}`;
    setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));
  };

  const handleOpenHistoricalWeek = (report) => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      report.week_number !== currentWeek.week ||
      report.year !== currentWeek.year;
    setReadOnly(isPastWeek);
    setIsHistorical(isPastWeek);
    setWeekInfo({
      week: report.week_number,
      year: report.year,
    });
    // Load tasks for that week into taskRows
    const weekTasks = tasks.filter(
      (task) =>
        Number(task.created_week) === Number(report.week_number) &&
        Number(task.created_year) === Number(report.year) &&
        !task.parent_task_id,
    );
    const allTaskRows = [];
    for (const task of weekTasks) {
      allTaskRows.push({
        id: task.id,
        name: task.title,
        description: task.description || "",
        project_id: task.project_id || null,
        category: task.category || "",
        start_date: task.start_date || "",
        start_time: "",
        due_date: task.end_date || "",
        due_time: "",
        blockers:
          task.blockers?.map((blocker) => ({
            id: blocker.id,
            description: blocker.title,
            severity: blocker.severity || "medium",
            status: blocker.status || "Active",
            created_at: blocker.created_at,
          })) || [],
        parent_task_id: task.parent_task_id || null,
        status: task.status,
        collaborators: [],
        uncompleted_reason: "",
      });
      if (task.subtasks?.length > 0) {
        for (const subtask of task.subtasks) {
          allTaskRows.push({
            id: subtask.id,
            name: subtask.title,
            description: "",
            project_id: task.project_id || null,
            category: task.category || "",
            start_date: "",
            start_time: "",
            due_date: "",
            due_time: "",
            blockers: [],
            parent_task_id: task.id,
            status: subtask.status,
            collaborators: [],
            uncompleted_reason: "",
          });
        }
      }
    }
    setTaskRows(allTaskRows);
    openStandupModal();
    setShowTaskForm(false);
  };

  const handleOpenTaskCreation = (report) => {
    setReadOnly(false);
    setIsHistorical(false);
    setWeekInfo({
      week: report.week_number,
      year: report.year,
    });
    setNewTaskForm((prev) => ({
      ...prev,
      name: "",
      project_id: "",
      start_date: "",
      due_date: "",
    }));
    setTaskCreationOpen(true);
  };

  const handleOpenStandupModal = () => {
    const currentWeek = getCurrentWeek();
    const isPastWeek =
      weekInfo.week !== currentWeek.week || weekInfo.year !== currentWeek.year;
    setReadOnly(isPastWeek);
    setIsHistorical(isPastWeek);
    openStandupModal();
  };

  const handleCloseStandupModal = () => {
    setShowStandupModal(false);
    setReadOnly(false);
    setIsHistorical(false);
  };

  const handleSaveStandupFromModal = () => {
    handleSubmit("submitted");
    setShowStandupModal(false);
  };

  return {
    handleOpenNewStandup,
    handleToggleStandupWeek,
    handleOpenHistoricalWeek,
    handleOpenTaskCreation,
    handleOpenStandupModal,
    handleCloseStandupModal,
    handleSaveStandupFromModal,
  };
}
