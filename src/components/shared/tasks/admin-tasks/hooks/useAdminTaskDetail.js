"use client";

import { useState } from "react";

/**
 * Which task the detail modal is showing.
 *
 * The modal is the only thing that opens a task, so the whole of this hook is the
 * open task and the way to close it. It knows nothing about the server: the
 * writes live in `useAdminTaskWrites`, and the comment thread for the open task
 * is read by `useAdminTasksData` from the id returned here.
 */
export default function useAdminTaskDetail() {
  const [viewingTask, setViewingTask] = useState(null);

  return {
    viewingTask,
    viewingTaskId: viewingTask?.id ?? null,
    setViewingTask,
    openTask: setViewingTask,
    closeTask: () => setViewingTask(null),
  };
}