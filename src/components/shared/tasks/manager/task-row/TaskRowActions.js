"use client";

import { MessageSquare, Plus } from "lucide-react";

/**
 * The row's footer actions: add a resource, open the comments thread, add a
 * sub-task.
 */
export default function TaskRowActions({
  task,
  isSub,
  readOnly,
  setAddResourceTaskId,
  toggleComments,
  openSubTask,
}) {
  return (
      <div
        className={`mt-1 flex items-center gap-3 ${isSub ? "ml-10" : "ml-8"}`}
      >
        {!readOnly && (
          <button
            onClick={() => setAddResourceTaskId(task.id)}
            className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Plus className="w-2.5 h-2.5" /> Resource
          </button>
        )}
        <button
          onClick={() => toggleComments(task.id)}
          className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-400 hover:text-blue-400 transition-colors"
        >
          <MessageSquare className="w-2.5 h-2.5" />
          Comments{task.commentCount > 0 ? ` (${task.commentCount})` : ""}
        </button>
        {!readOnly && !isSub && (
          <button
            onClick={() =>
              openSubTask(task.id, task.project_id, task.category, task.title)
            }
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-indigo-300 transition-all"
          >
            <Plus className="w-2.5 h-2.5" /> Sub-task
          </button>
        )}
      </div>
  );
}
