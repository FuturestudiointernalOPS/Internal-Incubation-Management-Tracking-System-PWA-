/**
 * The blocker modal: resolve, and add from the modal.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 */
import { clearResponseCachePrefix } from "@/lib/hooks/useApi";

export function blockerModalActions({
  addBlockerToRow,
  blockerModal,
  newBlockerDescription,
  newBlockerNotes,
  newBlockerPriority,
  newBlockerRefUrl,
  newBlockerTitle,
  refreshTasks,
  resolveBlocker,
  setBlockerModal,
  setNewBlockerDescription,
  setNewBlockerNotes,
  setNewBlockerPriority,
  setNewBlockerRefUrl,
  setNewBlockerTitle,
  user,
}) {
  const handleResolveBlocker = async (blocker) => {
    if (blockerModal.type === "api") {
      await fetch("/api/blockers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blocker.id,
          user_id: user?.cid || user?.id,
          status: "resolved",
          resolved_by: user?.cid || user?.id,
        }),
      });
      clearResponseCachePrefix("/api/blockers");
      clearResponseCachePrefix("/api/tasks");
      refreshTasks();
    } else {
      resolveBlocker(blockerModal, blocker.id);
    }
    setBlockerModal(null);
  };

  const handleAddBlockerFromModal = async () => {
    if (!newBlockerTitle.trim()) return;
    const payload = {
      task_id: blockerModal.taskId,
      user_id: user?.cid || user?.id,
      user_name: user?.name || "",
      title: newBlockerTitle.trim(),
      description: newBlockerDescription.trim() || null,
      severity: newBlockerPriority,
      reference_url: newBlockerRefUrl.trim() || null,
      notes: newBlockerNotes.trim() || null,
    };
    if (blockerModal.type === "api") {
      await fetch("/api/blockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNewBlockerTitle("");
      setNewBlockerDescription("");
      setNewBlockerPriority("medium");
      setNewBlockerRefUrl("");
      setNewBlockerNotes("");
      clearResponseCachePrefix("/api/blockers");
      clearResponseCachePrefix("/api/tasks");
      refreshTasks();
    } else {
      addBlockerToRow(blockerModal, newBlockerTitle.trim());
      setNewBlockerTitle("");
      setNewBlockerDescription("");
      setNewBlockerPriority("medium");
      setNewBlockerRefUrl("");
      setNewBlockerNotes("");
    }
  };

  return {
    handleResolveBlocker,
    handleAddBlockerFromModal,
  };
}
