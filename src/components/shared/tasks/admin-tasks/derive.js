/**
 * The reads the dashboard does on the tasks it is showing: who owns them, which
 * project each belongs to, which of them the filters keep, and the counts in the
 * stats row.
 *
 * These are pure — the page calls them inside `useMemo` — so the rules a row is
 * filtered by stay in one readable place instead of being written out inside the
 * table's markup.
 */

/** The people who own at least one task, in the order the tasks name them. */
export function taskOwners(tasks) {
  const userMap = {};
  tasks.forEach((task) => {
    if (task.user_id && !userMap[task.user_id]) {
      userMap[task.user_id] = { id: task.user_id, name: task.user_name };
    }
  });
  return Object.values(userMap);
}

/** Project id to display name, with the empty id mapped to "no project". */
export function projectNameMap(projects) {
  const map = { "": null };
  projects.forEach((project) => {
    map[project.id] = project.name || project.title;
  });
  return map;
}

/**
 * Keep the tasks that match what is typed and what is selected.
 *
 * "All Users" / "All Projects" are the two sentinels that mean "no filter", and
 * "Independent" is the project filter's way of asking for the tasks that belong
 * to no project at all.
 */
export function filterTasks({
  tasks,
  search,
  filterUser,
  filterStatus,
  filterProject,
}) {
  return tasks.filter((task) => {
    const matchesSearch =
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(task.created_week).includes(search) ||
      String(task.created_year).includes(search);
    const matchesUser =
      filterUser === "All Users" || task.user_id === filterUser;
    const matchesStatus = filterStatus === "all" || task.status === filterStatus;
    const matchesProject =
      filterProject === "All Projects" ||
      (filterProject === "Independent" && !task.project_id) ||
      task.project_id === filterProject;
    return matchesSearch && matchesUser && matchesStatus && matchesProject;
  });
}

/** The counts behind the stats row, over every task rather than the filtered set. */
export function taskStats(tasks) {
  return {
    total: tasks.length,
    pending: tasks.filter((task) => task.status === "pending").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    carriedOver: tasks.filter((task) => task.status === "carried_over").length,
  };
}