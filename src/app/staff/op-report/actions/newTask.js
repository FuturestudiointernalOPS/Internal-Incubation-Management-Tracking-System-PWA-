/**
 * The new-task form's field change.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 1 names this module reads into newTaskActions().
 */

export function newTaskActions({
  setNewTaskForm,
}) {
  const handleNewTaskFieldChange = (field, value) =>
    setNewTaskForm((prev) => ({ ...prev, [field]: value }));

  return {
    handleNewTaskFieldChange,
  };
}
