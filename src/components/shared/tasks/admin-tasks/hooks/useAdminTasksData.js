"use client";

import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickList = (field) => (payload) => (payload?.success ? payload[field] || [] : []);

// `pickList(...)` has to be CALLED here, once, rather than at the call site: it is
// a factory, so `pickList("tasks")` written inline is a new function on every
// render, and that new identity re-keyed the read and put its request back on the
// wire every render.
const pickTasks = pickList("tasks");
const pickProjects = pickList("projects");
const pickContacts = pickList("contacts");
const pickComments = pickList("comments");

/**
 * The dashboard's reads.
 *
 * The tasks, the projects they belong to, the people they can be assigned to and
 * the open task's comments, all through the shared hook: it owns the cache, the
 * cache-first paint and the discarding of a stale answer, so the page keeps no
 * copy of its own and reads its data during render.
 *
 * The comments are read for the task that is open, and not addressed at all when
 * none is.
 */
export default function useAdminTasksData(sortBy, viewingTaskId) {
  const {
    data: tasks,
    loading: tasksLoading,
    refresh: refreshTasks,
  } = useApi(`/api/tasks?sort=${sortBy}`, {
    defaultValue: EMPTY_LIST,
    transform: pickTasks,
    deps: [sortBy],
  });

  const {
    data: projects,
    loading: projectsLoading,
    refresh: refreshProjects,
  } = useApi("/api/projects", {
    defaultValue: EMPTY_LIST,
    transform: pickProjects,
  });

  const { data: allUsers } = useApi("/api/contacts", {
    defaultValue: EMPTY_LIST,
    transform: pickContacts,
  });

  const {
    data: comments,
    refresh: refreshComments,
  } = useApi(
    viewingTaskId ? `/api/tasks/comments?task_id=${viewingTaskId}` : null,
    {
      defaultValue: EMPTY_LIST,
      transform: pickComments,
      deps: [viewingTaskId],
    },
  );

  return {
    tasks,
    projects,
    allUsers,
    comments,
    loading: tasksLoading || projectsLoading,
    refreshTasks,
    refreshProjects,
    refreshComments,
  };
}