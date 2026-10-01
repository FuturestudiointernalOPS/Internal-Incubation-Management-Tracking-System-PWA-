/**
 * Tasks — resource use cases (SERVICE layer).
 *
 * The domain work behind `/api/tasks/resources`: attaching a link or file to a
 * task, and removing one. The CONTROLLER authenticates and validates; the access
 * rule (portfolio role, or the task's owner/assignee/supervisor) and the write
 * order live here.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`.
 */

import {
  getTaskAccessById,
  createResource,
  getResourceById,
  getTaskAccessForDelete,
  deleteResource,
} from "@/models/taskResources";
import { canAccessTask } from "./access";

/** Attach a resource to a task. */
export async function addTaskResource({
  taskId,
  name,
  url,
  type,
  fileName,
  fileSize,
  role,
  sessionCid,
}) {
  const taskResult = await getTaskAccessById(taskId);
  const task = taskResult.rows[0];
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return { status: 403, error: "You do not have access to this task." };
  }

  const result = await createResource(
    taskId,
    name,
    url,
    type,
    fileName,
    fileSize,
    sessionCid,
  );

  return {
    status: 200,
    body: {
      success: true,
      id: Number(result.rows[0]?.id || result.lastInsertRowid),
      message: "Resource added successfully",
    },
  };
}

/** Remove a resource (access is checked through its owning task). */
export async function removeTaskResource({ id, role, sessionCid }) {
  const resourceResult = await getResourceById(id);
  const resource = resourceResult.rows[0];
  if (!resource) return { status: 404, error: "Resource not found." };

  const taskResult = await getTaskAccessForDelete(resource.task_id);
  const task = taskResult.rows[0];
  if (!task) return { status: 404, error: "Task not found" };
  if (!canAccessTask({ task, role, cid: sessionCid })) {
    return { status: 403, error: "You do not have access to this task." };
  }

  await deleteResource(id);
  return {
    status: 200,
    body: { success: true, message: "Resource deleted successfully" },
  };
}
