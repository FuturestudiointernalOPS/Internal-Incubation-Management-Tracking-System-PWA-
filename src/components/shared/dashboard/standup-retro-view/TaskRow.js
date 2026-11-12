"use client";

import React, { useState } from "react";
import {
  ChevronDown, CheckCircle2, AlertTriangle, User, Paperclip,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STATUS_CFG = {
  pending:      { dot: "bg-slate-500",   text: "text-slate-400" },
  in_progress:  { dot: "bg-blue-500",    text: "text-blue-400" },
  blocked:      { dot: "bg-red-500",     text: "text-red-400" },
  completed:    { dot: "bg-emerald-500", text: "text-emerald-400" },
  carried_over: { dot: "bg-purple-500",  text: "text-purple-400" },
};

function TaskDot({ status, onClick }) {
  const { t } = useI18n();
  const statusConfig = STATUS_CFG[status] || STATUS_CFG.pending;
  const statusLabels = {
    pending: t("staffMisc.standupRetro.statusPending"),
    in_progress: t("staffMisc.standupRetro.statusActive"),
    blocked: t("staffMisc.standupRetro.statusBlocked"),
    completed: t("staffMisc.standupRetro.statusDone"),
    carried_over: t("staffMisc.standupRetro.statusCarried"),
  };
  return (
    <button
      onClick={onClick}
      title={t("staffMisc.standupRetro.changeStatusTitle", { label: statusLabels[status] || statusLabels.pending })}
      className={`w-3 h-3 rounded-full shrink-0 transition-transform hover:scale-125 ${statusConfig.dot}`}
    />
  );
}

export default function TaskRow({ task, expanded, onToggle, onStatusChange, onArchive, onDelete, onAssign, onAddBlocker, onSetDueDate, allStaff }) {
  const { t } = useI18n();
  const statusConfig = STATUS_CFG[task.status] || STATUS_CFG.pending;
  const statusLabels = {
    pending: t("staffMisc.standupRetro.statusPending"),
    in_progress: t("staffMisc.standupRetro.statusActive"),
    blocked: t("staffMisc.standupRetro.statusBlocked"),
    completed: t("staffMisc.standupRetro.statusDone"),
    carried_over: t("staffMisc.standupRetro.statusCarried"),
  };
  const isDone = task.status === "completed";
  const [showAssign, setShowAssign] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [showDueDate, setShowDueDate] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [blockerTitle, setBlockerTitle] = useState("");
  const [dueDate, setDueDate] = useState(task.end_date || "");

  const cycleStatus = () => {
    const next = task.status === "completed" ? "in_progress" : task.status === "blocked" ? "in_progress" : "completed";
    onStatusChange(task.id, next);
  };

  const filteredStaff = (allStaff || []).filter((staffMember) =>
    !assignSearch || (staffMember.name || "").toLowerCase().includes(assignSearch.toLowerCase())
  ).slice(0, 5);

  const handleBlockerSubmit = (event) => {
    event.preventDefault();
    if (!blockerTitle.trim()) return;
    onAddBlocker(task.id, blockerTitle.trim());
    setBlockerTitle("");
    setShowBlocker(false);
  };

  return (
    <div>
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors group"
        style={{ borderBottom: "1px solid rgb(255 255 255 / 0.04)" }}
      >
        <TaskDot status={task.status} onClick={(event) => { event.stopPropagation(); cycleStatus(); }} />
        <span className="text-[12px] font-bold text-[var(--text-primary)] truncate flex-1"
          style={{ textDecoration: isDone ? "line-through" : "none", opacity: isDone ? 0.45 : 1 }}>
          {task.title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {task.blockers?.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
              <AlertTriangle className="w-3 h-3" /> {task.blockers.length}
            </span>
          )}
          {(task.link || task.attachments?.length > 0) && (
            <Paperclip className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          )}
          {task.assigned_to && (
            <User className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          )}
          {task.is_carryover && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 uppercase">
              {t("staffMisc.standupRetro.carryoverWeek", { week: task.created_week })}
            </span>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-widest ${statusConfig.text}`}>{statusLabels[task.status] || statusLabels.pending}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-tertiary)] ml-1 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="px-6 py-4 space-y-3 border-b border-white/[0.04]" style={{ backgroundColor: "rgb(255 255 255 / 0.01)" }}>
          {task.description && (
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{task.description}</p>
          )}
          {task.blockers?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-1.5">{t("staffMisc.standupRetro.blockers", { count: task.blockers.length })}</p>
              {task.blockers.map((blocker) => (
                <div key={blocker.id} className="flex items-center gap-2 text-[10px]">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  <span className="text-[var(--text-primary)]">{blocker.title}</span>
                  <span className="text-[var(--text-tertiary)]">· {blocker.severity}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-[var(--text-tertiary)]">
            {task.start_date && <span>{t("staffMisc.standupRetro.startDate", { date: task.start_date })}</span>}
            {task.end_date && <span>{t("staffMisc.standupRetro.dueDate", { date: task.end_date })}</span>}
            {task.assigned_to && <span>{t("staffMisc.standupRetro.assignedTo", { name: task.assigned_to })}</span>}
          </div>

          {/* ── Assign / Blocker / Due Date (Phase 8) ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Assign */}
            <div className="relative">
              {!showAssign ? (
                <button onClick={(event) => { event.stopPropagation(); setShowAssign(true); }} className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  + {task.assigned_to ? t("staffMisc.standupRetro.reassign") : t("staffMisc.standupRetro.assign")}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text" value={assignSearch} onChange={(event) => setAssignSearch(event.target.value)}
                    placeholder={t("staffMisc.standupRetro.searchTeammate")} autoFocus
                    className="w-40 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => { if (event.key === "Escape") { setShowAssign(false); setAssignSearch(""); } }} />
                  <button onClick={(event) => { event.stopPropagation(); setShowAssign(false); setAssignSearch(""); }} className="text-[10px] text-[var(--text-tertiary)]">✕</button>
                  {assignSearch && filteredStaff.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-white/10 bg-[#0f172a] shadow-xl z-10" onClick={(event) => event.stopPropagation()}>
                      {filteredStaff.map((staffMember) => (
                        <button key={staffMember.id} onClick={() => { onAssign(task.id, staffMember.id); setShowAssign(false); setAssignSearch(""); }}
                          className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--text-primary)] hover:bg-white/10">
                          {staffMember.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Due date */}
            {!showDueDate ? (
              <button onClick={(event) => { event.stopPropagation(); setShowDueDate(true); }} className="text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                + {task.end_date ? t("staffMisc.standupRetro.changeDue") : t("staffMisc.standupRetro.dueDateButton")}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input type="date" value={dueDate} onChange={(event) => { setDueDate(event.target.value); onSetDueDate(task.id, event.target.value); setShowDueDate(false); }}
                  className="w-32 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none"
                  onClick={(event) => event.stopPropagation()} />
                <button onClick={(event) => { event.stopPropagation(); setShowDueDate(false); }} className="text-[10px] text-[var(--text-tertiary)]">✕</button>
              </div>
            )}

            {/* Add blocker */}
            {!showBlocker ? (
              <button onClick={(event) => { event.stopPropagation(); setShowBlocker(true); }} className="text-[10px] font-bold text-red-400/70 hover:text-red-400 transition-colors">
                + {t("staffMisc.standupRetro.blocker")}
              </button>
            ) : (
              <form onSubmit={handleBlockerSubmit} className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                <input type="text" value={blockerTitle} onChange={(event) => setBlockerTitle(event.target.value)}
                  placeholder={t("staffMisc.standupRetro.whatsBlocking")} autoFocus
                  className="w-40 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[10px] text-[var(--text-primary)] outline-none" />
                <button type="submit" className="text-[10px] font-bold text-red-400">{t("staffMisc.standupRetro.add")}</button>
                <button type="button" onClick={() => { setShowBlocker(false); setBlockerTitle(""); }} className="text-[10px] text-[var(--text-tertiary)]">✕</button>
              </form>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            {!isDone && (
              <button onClick={(event) => { event.stopPropagation(); onStatusChange(task.id, "completed"); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                <CheckCircle2 className="w-3 h-3" /> {t("staffMisc.standupRetro.complete")}
              </button>
            )}
            {task.status === "blocked" && (
              <button onClick={(event) => { event.stopPropagation(); onStatusChange(task.id, "in_progress"); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 transition-colors">
                {t("staffMisc.standupRetro.unblock")}
              </button>
            )}
            <button onClick={(event) => { event.stopPropagation(); onArchive(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
              {t("staffMisc.standupRetro.archive")}
            </button>
            <button onClick={(event) => { event.stopPropagation(); onDelete(task.id); }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-red-400/60 hover:text-red-400 transition-colors">
              {t("staffMisc.standupRetro.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
