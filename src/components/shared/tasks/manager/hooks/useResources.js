"use client";

import { useState } from "react";
import { uploadTaskAttachment } from "@/lib/storage";
import { notify } from "@/lib/notify";

/**
 * A task's resource links and attachments.
 *
 * A resource is either a URL or an uploaded file; when a file is chosen it is
 * uploaded first and the saved resource points at the stored copy. Removal asks
 * for confirmation, because a link can be the only copy of something.
 */
export default function useResources({ onTasksChange, setConfirmAction, t }) {
  const [addResourceTaskId, setAddResourceTaskId] = useState(null);
  const [resourceForm, setResourceForm] = useState({ name: "", url: "" });
  const [resourceAdding, setResourceAdding] = useState(false);
  const [resourceFile, setResourceFile] = useState(null);

  const handleSaveResource = async (taskId) => {
    if (!resourceFile && !resourceForm.url.trim()) return;
    setResourceAdding(true);
    try {
      let finalUrl = resourceForm.url.trim();
      let finalName = resourceForm.name.trim();
      let filePayload = {};

      // If a file is selected, upload it first
      if (resourceFile) {
        const upload = await uploadTaskAttachment(resourceFile, taskId);
        if (!upload.success) {
          notify(
            "error",
            t(upload.error || "Upload failed") || upload.error || "Upload failed",
          );
          setResourceAdding(false);
          return;
        }
        finalUrl = upload.url;
        finalName = finalName || resourceFile.name;
        filePayload = {
          type: "file",
          file_name: resourceFile.name,
          file_size: resourceFile.size,
        };
      }

      const res = await fetch("/api/tasks/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          name: finalName,
          url: finalUrl,
          ...filePayload,
        }),
      });
      if (res.ok) {
        notify("success", "Resource saved");
        if (onTasksChange) onTasksChange();
        setAddResourceTaskId(null);
        setResourceForm({ name: "", url: "" });
        setResourceFile(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setResourceAdding(false);
    }
  };

  const performDeleteResource = async (resourceId) => {
    try {
      const res = await fetch(`/api/tasks/resources?id=${resourceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        notify("success", "Resource removed");
        if (onTasksChange) onTasksChange();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    setConfirmAction({
      message: "Delete this resource link?",
      onConfirm: () => performDeleteResource(resourceId),
    });
  };

  return {
    addResourceTaskId,
    setAddResourceTaskId,
    resourceForm,
    setResourceForm,
    resourceAdding,
    resourceFile,
    setResourceFile,
    handleSaveResource,
    handleDeleteResource,
  };
}