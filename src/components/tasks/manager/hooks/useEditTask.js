"use client";

import { useState } from "react";

/**
 * The edit-task modal's state.
 *
 * `editTaskModal` is the task being edited and `editForm` is the working copy of
 * its fields — the modal writes the copy, so closing without saving leaves the
 * task itself untouched. The save itself lives in the modal, because it is the
 * only place that knows which fields were edited.
 */
export default function useEditTask() {
  const [editTaskModal, setEditTaskModal] = useState(null); // task object or null
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    project_id: "",
    category: "",
    start_date: "",
    due_date: "",
    status: "",
    assigned_to: "",
    priority: "medium",
    link: "",
  });

  return { editTaskModal, setEditTaskModal, editForm, setEditForm };
}