"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Loader2, ListTodo, Lock, Filter } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { notify } from "@/lib/notify";
import VenturePersonField from "@/components/ventures/VenturePersonField";

/**
 * VentureTasksPanel — the operational layer of a Venture: the work itself.
 *
 * Journey → Milestone → TASK → Deliverable. This is the level where somebody is
 * told "this is yours", which is why assignment lives here rather than only in
 * the importer. A manager runs the Venture, so a manager assigns its work.
 *
 * ── WHAT A MANAGER MAY AND MAY NOT DO ────────────────────────────────────────
 *
 * Allowed: assign, re-assign, and adjust status, priority and dates — the
 * decisions a person makes while the work is moving.
 *
 * Deliberately absent: archive and delete. Those are irreversible and belong to
 * the Super Admin console, which already has them. A screen that cannot destroy
 * anything is a screen a manager can be trusted with.
 *
 * The permission is not decided here. `canEdit` comes from
 * GET /api/ventures/[id]/my-access, the read built on the guard's OWN verdict
 * function, so this panel can never offer something the server would refuse. It
 * reads; it does not judge.
 *
 * ── THE PERSON HALF ─────────────────────────────────────────────────────────
 *
 * Assignment goes through <VenturePersonField>, the one control the whole
 * Venture uses, so a task and the milestone above it cannot disagree about who
 * is responsible. It carries an identity when the typed name matches a platform
 * member, and a name when it does not — an external assignment, which is a
 * complete state and the reason a Venture can track a lawyer or a vendor who
 * will never have an account.
 */

const EMPTY_LIST = [];
const EMPTY_MILESTONES = {};
const EMPTY_ACCESS = { capabilities: {} };

const STATUSES = ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"];
const PRIORITIES = ["low", "medium", "high", "critical"];

const STATUS_COLOR = {
  backlog: "bg-slate-500/10 text-slate-400",
  todo: "bg-blue-500/10 text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  review: "bg-purple-500/10 text-purple-400",
  done: "bg-emerald-500/10 text-emerald-400",
  blocked: "bg-rose-500/10 text-rose-400",
  cancelled: "bg-slate-500/5 text-slate-500",
};

const PRIORITY_COLOR = {
  low: "text-[var(--text-secondary)]",
  medium: "text-blue-400",
  high: "text-amber-400",
  critical: "text-rose-400",
};

// ─── Module-scope readers ────────────────────────────────────────────────────
// useApi keys its read on these, so they are built once rather than per render.

const pickTasks = (payload) => (payload?.success ? payload.tasks || [] : EMPTY_LIST);
const pickAccess = (payload) => (payload?.success ? payload : EMPTY_ACCESS);

/** Milestones live nested inside the Journey's stages; flatten them for lookup. */
const pickMilestones = (payload) => {
  if (!payload?.success) return EMPTY_MILESTONES;
  const byId = {};
  for (const stage of payload.stages || []) {
    for (const milestone of stage.milestones || []) {
      byId[String(milestone.id)] = { title: milestone.title || "", stage: stage.name || "" };
    }
  }
  return byId;
};

/** A date column arrives as a timestamp; an <input type="date"> wants the day. */
const dateOnly = (value) => (value ? String(value).slice(0, 10) : "");

const inputClass =
  "w-full px-2 py-1.5 rounded-lg outline-none border border-[var(--border-primary)] bg-[var(--surface-1)] text-[11px] text-[var(--text-primary)] focus:border-[var(--brand-orange)]";

function VentureTasksPanel({ ventureId }) {
  const { t } = useI18n();

  const { data: tasks, loading, refresh, setData: setTasks } = useApi(
    ventureId ? `/api/ventures/${ventureId}/tasks` : null,
    { defaultValue: EMPTY_LIST, transform: pickTasks, deps: [ventureId] },
  );
  const { data: access } = useApi(
    ventureId ? `/api/ventures/${ventureId}/my-access` : null,
    { defaultValue: EMPTY_ACCESS, transform: pickAccess, deps: [ventureId] },
  );
  const { data: milestoneById } = useApi(
    ventureId ? `/api/ventures/${ventureId}/journey` : null,
    { defaultValue: EMPTY_MILESTONES, transform: pickMilestones, deps: [ventureId] },
  );

  const canEdit = Boolean(access?.capabilities?.edit?.allowed);

  const [statusFilter, setStatusFilter] = useState("");
  // A Set, not one id: two saves can overlap (status on one task, priority on
  // another), and a single slot would let the first to finish hide the second's
  // spinner while its request is still in flight.
  const [savingIds, setSavingIds] = useState(() => new Set());
  // The assignee is TYPED, so it is held as a draft and written on blur: one
  // request per edit rather than one per keystroke.
  const [personDrafts, setPersonDrafts] = useState({});

  const visibleTasks = useMemo(
    () => (statusFilter ? tasks.filter((task) => task.status === statusFilter) : tasks),
    [tasks, statusFilter],
  );

  const openCount = useMemo(
    () => tasks.filter((task) => task.status !== "done" && task.status !== "cancelled").length,
    [tasks],
  );

  /**
   * One write path. The server answers with the saved row, so the list adopts IT
   * rather than assuming the write landed as sent — and a refusal re-reads,
   * because a screen showing a value the server rejected is worse than a delay.
   */
  const patchTask = useCallback(
    async (taskId, patch) => {
      setSavingIds((previous) => new Set(previous).add(taskId));
      try {
        const response = await fetch(`/api/ventures/${ventureId}/tasks?id=${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          notify("error", payload.error || t("venture.tasksPanel.saveFailed"));
          await refresh();
          return;
        }
        setTasks((previous) =>
          previous.map((task) => (task.id === taskId ? { ...task, ...(payload.task || patch) } : task)),
        );
      } catch (_) {
        notify("error", t("venture.tasksPanel.saveFailed"));
      } finally {
        setSavingIds((previous) => {
          const next = new Set(previous);
          next.delete(taskId);
          return next;
        });
      }
    },
    [ventureId, t, refresh, setTasks],
  );

  /**
   * The person field reports every keystroke, so the draft is written when focus
   * leaves the field — and only when it actually differs from what is stored,
   * so merely clicking in and out of a box sends nothing.
   *
   * Clearing is the one case blur cannot catch: the ✕ blurs the input BEFORE it
   * reports the empty value, so the blur above sees the old draft and finds
   * nothing to do. It is written from the change instead (see onChange), or the
   * clear would silently not happen.
   */
  const commitAssignee = (task) => {
    const draft = personDrafts[task.id];
    if (!draft) return;
    const unchanged =
      String(draft.assigned_cid || "") === String(task.assigned_cid || "") &&
      String(draft.assigned_name || "") === String(task.assigned_name || "");
    if (unchanged) return;
    patchTask(task.id, { assigned_cid: draft.assigned_cid || null, assigned_name: draft.assigned_name || null });
  };

  /** Hold the typed value until blur; write a CLEARED one immediately. */
  const changeAssignee = (task, { cid, name }) => {
    const next = { assigned_cid: cid || "", assigned_name: name || "" };
    setPersonDrafts((previous) => ({ ...previous, [task.id]: next }));
    const wasAssigned = Boolean(task.assigned_cid || task.assigned_name);
    if (wasAssigned && !next.assigned_name) patchTask(task.id, { assigned_cid: null, assigned_name: null });
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-2">
          <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
          {t("venture.tasks")} ({tasks.length}
          {openCount !== tasks.length ? ` · ${t("venture.tasksPanel.openCount", { count: openCount })}` : ""})
        </h3>

        <label className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
          <Filter className="w-3 h-3" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="px-2 py-1 rounded-lg outline-none border border-[var(--border-primary)] bg-[var(--surface-1)] text-[10px] font-bold text-[var(--text-primary)]"
          >
            <option value="">{t("venture.tasksPanel.allStatuses")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`venture.tasksPanel.statuses.${status}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Read-only is stated rather than silently enforced: a control that does
          nothing is worse than one that is absent and explained. */}
      {!canEdit && (
        <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> {t("venture.tasksPanel.readOnly")}
        </p>
      )}

      {visibleTasks.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)]">
          {statusFilter ? t("venture.tasksPanel.noneForStatus") : t("venture.noTasksYet")}
        </p>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const milestone = milestoneById[String(task.milestone_id)];
            const draft = personDrafts[task.id] || {
              assigned_cid: task.assigned_cid || "",
              assigned_name: task.assigned_name || "",
            };
            const busy = savingIds.has(task.id);

            return (
              <div
                key={task.id}
                className="rounded-xl border border-[var(--border-primary)] p-3 space-y-2.5 bg-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{task.title}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
                      {milestone
                        ? `${milestone.stage ? `${milestone.stage} · ` : ""}${milestone.title}`
                        : t("venture.tasksPanel.noMilestone")}
                      {Array.isArray(task.labels) && task.labels.length ? ` · ${task.labels.join(" · ")}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {busy && <Loader2 className="w-3 h-3 animate-spin text-[var(--text-secondary)]" />}
                    {canEdit ? (
                      <select
                        value={task.status || "backlog"}
                        onChange={(event) => patchTask(task.id, { status: event.target.value })}
                        className={`px-2 py-1 rounded-lg outline-none border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest ${STATUS_COLOR[task.status] || STATUS_COLOR.backlog}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`venture.tasksPanel.statuses.${status}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${STATUS_COLOR[task.status] || STATUS_COLOR.backlog}`}
                      >
                        {t(`venture.tasksPanel.statuses.${task.status || "backlog"}`)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("venture.tasksPanel.assignee")}
                    </p>
                    {canEdit ? (
                      <span onBlur={() => commitAssignee(task)}>
                        <VenturePersonField
                          value={{ cid: draft.assigned_cid, name: draft.assigned_name }}
                          onChange={(next) => changeAssignee(task, next)}
                          listId={`task-assignee-${task.id}`}
                        />
                      </span>
                    ) : (
                      <p className="text-[11px] text-[var(--text-primary)] truncate">
                        {task.assigned_name || t("venture.unassigned")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("venture.priority")}
                    </p>
                    {canEdit ? (
                      <select
                        value={task.priority || "medium"}
                        onChange={(event) => patchTask(task.id, { priority: event.target.value })}
                        className={`${inputClass} font-bold ${PRIORITY_COLOR[task.priority] || ""}`}
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {t(`venture.${priority}`)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className={`text-[11px] font-bold ${PRIORITY_COLOR[task.priority] || ""}`}>
                        {t(`venture.${task.priority || "medium"}`)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("venture.tasksPanel.startDate")}
                    </p>
                    {canEdit ? (
                      <input
                        type="date"
                        value={dateOnly(task.start_date)}
                        onChange={(event) => patchTask(task.id, { start_date: event.target.value })}
                        className={inputClass}
                      />
                    ) : (
                      <p className="text-[11px] text-[var(--text-primary)]">
                        {dateOnly(task.start_date) || t("venture.tasksPanel.noDate")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                      {t("venture.tasksPanel.dueDate")}
                    </p>
                    {canEdit ? (
                      <input
                        type="date"
                        value={dateOnly(task.due_date)}
                        onChange={(event) => patchTask(task.id, { due_date: event.target.value })}
                        className={inputClass}
                      />
                    ) : (
                      <p className="text-[11px] text-[var(--text-primary)]">
                        {dateOnly(task.due_date) || t("venture.tasksPanel.noDate")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default VentureTasksPanel;
