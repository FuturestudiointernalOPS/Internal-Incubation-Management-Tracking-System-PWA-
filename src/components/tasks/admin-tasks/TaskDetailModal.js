"use client";

import React from "react";
import { X, Send } from "lucide-react";
import {
  STATUS_CONFIG,
  formatStatusLabel,
  getStatusBg,
  getStatusColor,
  getCarryOverCount,
} from "@/components/tasks/admin-tasks/constants";

/**
 * One task in full, over the page.
 *
 * Three things can be done from here that the row cannot: reassign the task,
 * jump it to any other status, and talk about it in comments. The quick actions
 * close the modal on the way out — the table row it came from re-reads and shows
 * the new status.
 */
export default function TaskDetailModal({
  task,
  projectMap,
  allUsers,
  comments,
  assignValue,
  assigningUser,
  statusUpdating,
  commentInput,
  setCommentInput,
  onAssign,
  onStatusUpdate,
  onAddComment,
  onClose,
  t,
}) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-secondary border border-[var(--border-primary)] rounded-2xl w-full max-w-lg p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
            {t("adminMisc.tasks.taskDetails")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
              {t("adminMisc.tasks.title")}
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {task.title}
            </p>
          </div>

          {task.description && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("adminMisc.tasks.description")}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {task.description}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("adminMisc.tasks.owner")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {task.user_name || t("adminMisc.tasks.unknown")}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("adminMisc.tasks.project")}
              </p>
              <p className="text-xs font-bold text-indigo-500">
                {task.project_id
                  ? projectMap[task.project_id] ||
                    t("adminMisc.tasks.projectNumber", {
                      id: task.project_id,
                    })
                  : t("adminMisc.tasks.independentTask")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("adminMisc.tasks.status")}
              </p>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${getStatusBg(task.status)} ${getStatusColor(task.status)}`}
                >
                {formatStatusLabel(task.status, t)}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("reports.carryOver")}
              </p>
              <p className="text-xs font-bold text-amber-500">
                {getCarryOverCount(task)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1">
                {t("time.created")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {t("adminMisc.tasks.week")} {task.created_week} ·{" "}
                {task.created_year}
              </p>
            </div>
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t("time.updated")}
              </p>
              <p className="text-[10px] font-bold text-[var(--text-primary)]">
                {new Date(
                  task.updated_at || task.created_at,
                ).toLocaleDateString()}
              </p>
            </div>
          </div>

          {task.completed_at && (
            <div>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                {t("adminMisc.tasks.completedAt")}
              </p>
              <p className="text-[10px] font-bold text-emerald-500">
                {new Date(task.completed_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {task.carried_over_from_task_id && (
            <div className="bg-amber-500/5 p-3 rounded-xl">
              <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">
                {t("reports.carryOver")}
              </p>
              <p className="text-[10px] text-slate-500">
                {t("adminMisc.tasks.originallyCreatedAs", {
                  id: task.carried_over_from_task_id,
                })}
              </p>
            </div>
          )}

          {/* Linked Blockers */}
          {task.blockers && task.blockers.length > 0 && (
            <div>
              <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-2">
                {t("adminMisc.tasks.linkedBlockers", {
                  count: task.blockers.length,
                })}
              </p>
              <div className="space-y-1.5">
                {task.blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-primary border border-[var(--border-primary)]"
                  >
                    <span className="text-[10px] font-bold">
                      {blocker.title}
                    </span>
                    <span
                      className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${blocker.status === "active" ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500"}`}
                    >
                      {blocker.status === "active"
                        ? t("status.active")
                        : t("status.resolved")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignment */}
          <div className="border-t border-[var(--border-primary)] pt-4">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
              {t("adminMisc.tasks.assignment")}
            </p>
            <div className="flex gap-2">
              <select
                value={assignValue}
                disabled={assigningUser}
                onChange={(event) => onAssign(task.id, event.target.value)}
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-wait"
              >
                <option value="">{t("adminMisc.tasks.unassigned")}</option>
                {allUsers.map((user) => (
                  <option key={user.cid} value={user.cid}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border-primary)]">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
              {t("admin.quickActions")}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {["pending", "in_progress", "blocked", "completed"].map(
                (statusOption) => {
                  if (task.status === statusOption) return null;
                  return (
                    <button
                      key={statusOption}
                      onClick={() => {
                        onStatusUpdate(task.id, statusOption);
                        onClose();
                      }}
                      disabled={statusUpdating !== null}
                      className={`text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all ${STATUS_CONFIG[statusOption]?.bg} ${STATUS_CONFIG[statusOption]?.color} ${STATUS_CONFIG[statusOption]?.border} hover:brightness-110 disabled:opacity-40 disabled:cursor-wait`}
                    >
                      {t(
                        "status." +
                          (statusOption === "in_progress" ? "inProgress" : statusOption),
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="border-t border-[var(--border-primary)] pt-4">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">
              {t("adminMisc.tasks.comments")}
            </p>
            <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="text-[10px] p-2 rounded-lg bg-primary border border-[var(--border-primary)]"
                >
                  <span className="font-bold text-[var(--text-primary)]">
                    {comment.sender_name}:
                  </span>{" "}
                  <span className="text-[var(--text-secondary)]">
                    {comment.body}
                  </span>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-[10px] text-slate-500 italic">
                  {t("adminMisc.tasks.noCommentsYet")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onAddComment(task.id);
                }}
                placeholder={t("adminMisc.tasks.addCommentPlaceholder")}
                className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] transition-all"
              />
              <button
                onClick={() => onAddComment(task.id)}
                className="p-2 rounded-lg bg-brand-orange/10 text-[var(--brand-orange)] hover:bg-brand-orange/20 transition-all"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}