"use client";

import React from "react";
import VenturePersonField from "@/components/shared/ventures/console/VenturePersonField";
import { useI18n } from "@/lib/i18n";
import { CATEGORY_COLOR, statusCategory } from "@/lib/workItemStatus";
import { DELIVERABLE_PROGRESS_WORDS, DELIVERABLE_REVIEW_WORDS } from "@/lib/ventureStatuses";

/**
 * The three facts a manager changes straight from a work item's row: who it is
 * assigned to, its priority, and its status (backlog…). They are the Tasks tab's
 * own controls, drawn small. Each kind of work is stored differently, so the
 * mapping from "change X" to the right request lives in `buildPatch`.
 *
 * The server is still the gate: a refused write is reported by the caller and
 * the row goes back to what is stored.
 */

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "review", "done", "blocked", "cancelled"];
export const MILESTONE_STATUSES = ["not_started", "in_progress", "blocked", "completed"];
/**
 * A deliverable's PROGRESS is the manager's to set.
 *
 * The review words are shown so the row's current state is readable, but they
 * are refused in the list: an approval or a change request comes from the
 * review action, which demands evidence, a reviewer and an audit row. A
 * dropdown must never be able to grant one.
 */
export const DELIVERABLE_WORDS = [...DELIVERABLE_PROGRESS_WORDS, ...DELIVERABLE_REVIEW_WORDS];
export const PRIORITIES = ["low", "medium", "high", "critical"];

const PRIORITY_COLOR = {
  low: "text-[var(--text-secondary)]",
  medium: "text-blue-400",
  high: "text-amber-400",
  critical: "text-rose-400",
};

const rawId = (item) => String(item.id).split(":").slice(1).join(":");

/** The request that writes ONE change to ONE kind of work. */
export function buildPatch(ventureId, item, change) {
  const id = rawId(item);
  if (item.kind === "activity") {
    return { url: `/api/ventures/${ventureId}/tasks?id=${encodeURIComponent(id)}`, body: change };
  }
  if (item.kind === "milestone") {
    const body = { ...change };
    if ("assigned_cid" in body) {
      body.owner_cid = body.assigned_cid;
      body.owner_name = body.assigned_name;
      delete body.assigned_cid;
      delete body.assigned_name;
    }
    return { url: `/api/ventures/${ventureId}/milestones?id=${encodeURIComponent(id)}`, body };
  }
  // A deliverable: the id travels in the body, and a status is one of five words.
  const body = { id: Number(id) || id, ...change };
  if ("status" in body) {
    body.status_word = body.status;
    delete body.status;
  }
  return { url: `/api/ventures/${ventureId}/deliverables`, body };
}

const stop = (event) => event.stopPropagation();

export function statusOptions(item) {
  if (item.kind === "activity") return TASK_STATUSES;
  if (item.kind === "milestone") return MILESTONE_STATUSES;
  return DELIVERABLE_WORDS;
}

// A status is what a person DECLARED. The start date is displayed in its own
// column and never rewrites the status: doing so made the row disagree with
// every count and report, which read the stored value.
export function currentStatus(item) {
  if (item.kind === "deliverable") return item.status?.id || "not_started";
  if (item.kind === "milestone") {
    const stored = String(item.stored_status || "").toLowerCase();
    return MILESTONE_STATUSES.includes(stored) ? stored : item.status?.id || "not_started";
  }
  return item.stored_status || "backlog";
}

export function StatusCell({ item, onChange, disabled }) {
  const { t } = useI18n();
  const value = currentStatus(item);
  const options = statusOptions(item);
  const label = (option) =>
    item.kind === "activity"
      ? t(`venture.tasksPanel.statuses.${option}`)
      : t(`status.${option.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())}`);
  return (
    <select
      value={options.includes(value) ? value : ""}
      disabled={disabled}
      onClick={stop}
      onChange={(event) => onChange({ status: event.target.value })}
      aria-label={t("venture.projects.status")}
      className={`px-2 py-1 rounded-lg outline-none border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest ${CATEGORY_COLOR[statusCategory(value)] || ""}`}
    >
      {!options.includes(value) ? <option value="">{value || "—"}</option> : null}
      {options.map((option) => {
        // A review outcome is not the manager's to pick — the review action owns
        // it. It stays visible (the row must read correctly) but cannot be chosen.
        const refused = item.kind === "deliverable" && DELIVERABLE_REVIEW_WORDS.includes(option);
        return (
          <option key={option} value={option} disabled={refused}>{label(option)}</option>
        );
      })}
    </select>
  );
}

export function PriorityCell({ item, onChange, disabled }) {
  const { t } = useI18n();
  if (item.kind === "deliverable") return <span className="text-[var(--text-tertiary)]">—</span>;
  const value = item.priority || "medium";
  return (
    <select
      value={PRIORITIES.includes(value) ? value : "medium"}
      disabled={disabled}
      onClick={stop}
      onChange={(event) => onChange({ priority: event.target.value })}
      aria-label={t("venture.priority")}
      className={`px-2 py-1 rounded-lg outline-none border border-[var(--border-primary)] bg-transparent text-[11px] font-bold ${PRIORITY_COLOR[value] || ""}`}
    >
      {PRIORITIES.map((priority) => (
        <option key={priority} value={priority}>{t(`venture.${priority}`)}</option>
      ))}
    </select>
  );
}

/** Typed, so it is written when focus leaves (and at once when cleared). */
export function AssigneeCell({ item, onChange, disabled }) {
  const [draft, setDraft] = React.useState(null);
  const current = { cid: item.owner?.cid || "", name: item.owner?.name || "" };
  const shown = draft || current;

  const commit = () => {
    if (!draft) return;
    if (draft.cid === current.cid && draft.name === current.name) return;
    onChange({ assigned_cid: draft.cid || null, assigned_name: draft.name || null });
    setDraft(null);
  };

  return (
    <div className="min-w-[170px]" onClick={stop}>
      <span onBlur={commit}>
        <VenturePersonField
          value={shown}
          disabled={disabled}
          listId={`work-assignee-${item.id}`}
          onChange={({ cid, name }) => {
            const next = { cid: cid || "", name: name || "" };
            setDraft(next);
            if ((current.cid || current.name) && !next.name) {
              onChange({ assigned_cid: null, assigned_name: null });
              setDraft(null);
            }
          }}
        />
      </span>
    </div>
  );
}
