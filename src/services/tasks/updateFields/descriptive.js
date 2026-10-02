/**
 * Tasks — the descriptive field assembly (link, priority, content, project,
 * context).
 *
 * Part of the `updateFields` field assembly (see docs/LAYER_SPLIT.md). Decisions
 * only, no SQL, no HTTP. It reads and writes through `@/models/**`.
 */

import {
  getProjectMembership,
  insertProjectApprovalRequest,
} from "@/models/tasks";
import { pushTaskField } from "./patch";

const PRIORITIES = ["critical", "high", "medium", "low"];

/** The link and the priority — the two cheap, purely descriptive columns. */
export function applyLinkAndPriority(patch, { task, input }) {
  const { link, priority } = input;

  if (link !== undefined && link !== task.link) {
    pushTaskField(patch, "link", link || null, "link updated");
  }
  if (
    priority !== undefined &&
    PRIORITIES.includes(priority) &&
    priority !== task.priority
  ) {
    pushTaskField(patch, "priority", priority, `priority changed to ${priority}`);
  }
}

/**
 * Title, description, status, project and the context pair — everything that
 * describes the task itself.
 */
export async function applyContentFields(patch, { id, task, input }) {
  const {
    title,
    description,
    status,
    project_id,
    user_id,
    user_name,
    context_type,
    context_id,
  } = input;

  if (title !== undefined && title !== task.title) {
    pushTaskField(patch, "title", title, `title changed to "${title}"`);
  }

  if (description !== undefined && description !== task.description) {
    pushTaskField(patch, "description", description, "description updated");
  }

  if (status !== undefined && status !== task.status) {
    pushTaskField(patch, "status", status, `status changed to ${status}`);

    if (status === "completed") {
      patch.fields.push("completed_at = CURRENT_TIMESTAMP");
      patch.auditAction = "completed";
      patch.auditDetails = `Task "${task.title}" marked as completed`;
    } else if (status === "carried_over") {
      patch.auditAction = "carried_over";
      patch.auditDetails = `Task "${task.title}" carried over to next week`;
    } else if (status === "archived") {
      patch.auditAction = "archived";
      patch.auditDetails = `Task "${task.title}" archived`;
    } else {
      patch.auditDetails = `Task "${task.title}" status changed from ${task.status} to ${status}`;
    }

    // Reopening a completed task drops its completion timestamp, so a later
    // status change can never resurrect a "completed but carried over" state.
    if (task.status === "completed" && status !== "completed") {
      patch.fields.push("completed_at = NULL");
    }
  }

  if (project_id !== undefined) {
    const projectChanged = String(project_id) !== String(task.project_id);
    pushTaskField(
      patch,
      "project_id",
      project_id || null,
      "project reassigned",
    );

    if (projectChanged && project_id) {
      // Phase 5: re-validate the project assignment on change.
      const memberCheck = await getProjectMembership(
        project_id,
        user_id || task.user_id,
      );

      if (memberCheck.rows.length === 0) {
        // Not a member — reset to pending approval. The reset REPLACES a status
        // the caller sent: a SET list naming the same column twice is refused by
        // Postgres ("multiple assignments to same column"), which lost the whole
        // save, and the reset is the point of this branch.
        const statusAt = patch.fields.findIndex((field) =>
          field.startsWith("status ="),
        );
        if (statusAt >= 0) {
          patch.fields.splice(statusAt, 1);
          patch.args.splice(statusAt, 1);
        }
        patch.fields.push("status = 'pending_project_approval'");
        try {
          await insertProjectApprovalRequest(
            parseInt(id),
            user_id || task.user_id,
            user_name || task.user_name || "",
            project_id,
          );
        } catch (error) {
          console.error(
            "Failed to insert project_approval_request:",
            error.message,
          );
        }
        patch.changes.push("project reassignment requires approval");
      }
    }
  }

  // ── PHASE 1: Context fields ──
  if (context_type !== undefined && context_type !== (task.context_type || null)) {
    pushTaskField(
      patch,
      "context_type",
      context_type || null,
      `context_type changed to ${context_type}`,
    );
  }
  if (
    context_id !== undefined &&
    String(context_id) !== String(task.context_id || "")
  ) {
    pushTaskField(patch, "context_id", context_id || null, `context_id changed`);
  }
}
