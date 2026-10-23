"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Layers,
  ListChecks,
  Mail,
  PlayCircle,
  SlidersHorizontal,
} from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useContentTranslation } from "@/lib/hooks/useContentTranslation";
import { WORK_ITEM_TEXT_PATHS } from "@/lib/workItemText";
import { useI18n } from "@/lib/i18n";
import AppTable from "@/components/ui/AppTable";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import WorkItemDetailModal from "./WorkItemDetailModal";
import { formatDay } from "./projectFormat";
import { AssigneeCell, PriorityCell, StatusCell, buildPatch } from "./WorkItemInlineEdit";
import { notify } from "@/lib/notify";

/**
 * The Project Management view of ONE Venture (Phase 1, read-only).
 *
 * It shows the work the Venture already has — milestones, activities and
 * deliverables — with the operational facts a manager needs in one row:
 * who owns it, who supports, when it starts, when it finishes, what state it is
 * in, and where it sits in the Journey.
 *
 * Percentage Progress is deliberately absent: it is a roll-up of evidence, not
 * a management signal, and showing it beside Status invited the two to disagree.
 *
 * The component holds NO business rules. The buckets, the one-authoritative
 * owner, the dependency labels and the filter options are all decided by
 * `@/services/workItems`; this file decides only how they are laid out. That is
 * what keeps a future reminders engine able to reuse the same work items.
 */

/** Filters use this sentinel for "any" — a select cannot hold an empty value meaningfully. */
const ANY = "all";
const SHOULD_START = "shouldStart";

// A task that has begun to move, as opposed to one still waiting.
const WORKING = ["in_progress", "review", "done"];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** A task whose start date has come (today or before) and that is not cancelled. */
const ought = (item, today) =>
  item.kind === "activity" &&
  Boolean(item.start) &&
  String(item.start).slice(0, 10) <= today &&
  item.stored_status !== "cancelled";

export default function ProjectsWorkItemsView({ ventureId, emailsHref = null }) {
  const { t, lang } = useI18n();

  // One read per Venture; `deps` keeps its size fixed (the hook's contract).
  const { data, loading, error, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/work-items` : null,
    { deps: [ventureId], defaultValue: null },
  );

  // One deduplicated request for the whole screen; the answer is remembered, so
  // the next visit asks the provider for nothing. The payload is untouched — a
  // reminder still sends the title exactly as the tracker stored it. The Venture
  // travels with the request because the server checks the reader may see it.
  const { tv, translating } = useContentTranslation(data, WORK_ITEM_TEXT_PATHS, { ventureId });

  const [bucket, setBucket] = useState(ANY);
  const [owner, setOwner] = useState(ANY);
  const [supporting, setSupporting] = useState(ANY);
  const [journey, setJourney] = useState(ANY);
  const [milestone, setMilestone] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  // What the manager has just changed in place, per work item. It is laid over
  // the list instead of re-reading it, so the table does not blink or lose its
  // place; a refused write removes its own entry again.
  const [edits, setEdits] = useState({});
  const [saving, setSaving] = useState(() => new Set());

  const applyEdit = (item, change) => ({
    ...item,
    ...(change.priority ? { priority: change.priority } : {}),
    ...(change.status
      ? item.kind === "activity"
        ? { stored_status: change.status }
        : { stored_status: change.status, status: { ...item.status, id: change.status } }
      : {}),
    ...("assigned_cid" in change
      ? { owner: change.assigned_name ? { name: change.assigned_name, cid: change.assigned_cid, external: !change.assigned_cid } : null }
      : {}),
  });

  const options = data?.options || {};
  const summary = data?.summary || { total: 0, today: 0, upcoming: 0, overdue: 0, completed: 0 };

  const hasFilters =
    bucket !== ANY ||
    owner !== ANY ||
    supporting !== ANY ||
    journey !== ANY ||
    milestone !== ANY ||
    status !== ANY ||
    search.trim() !== "";

  const clearFilters = () => {
    setBucket(ANY);
    setOwner(ANY);
    setSupporting(ANY);
    setJourney(ANY);
    setMilestone(ANY);
    setStatus(ANY);
    setSearch("");
  };

  const patchItem = async (item, change) => {
    const { url, body } = buildPatch(ventureId, item, change);
    setSaving((previous) => new Set(previous).add(item.id));
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        notify("error", payload.error ? t(payload.error) : t("venture.manager.actionFailed"));
        return;
      }
      setEdits((previous) => ({ ...previous, [item.id]: { ...(previous[item.id] || {}), ...change } }));
    } catch (_) {
      notify("error", t("venture.manager.actionFailed"));
    } finally {
      setSaving((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
    }
  };

  const edited = useMemo(
    () => (data?.items || []).map((item) => (edits[item.id] ? applyEdit(item, edits[item.id]) : item)),
    [data, edits],
  );

  // Tasks that ought to have started (their start date has come), and, per
  // assignee, whether the work has actually begun.
  const due = useMemo(() => {
    const today = localToday();
    return edited.filter((item) => ought(item, today));
  }, [edited]);

  const buckets = [
    { id: ANY, label: t("venture.projects.allWork"), count: summary.total, icon: Layers },
    { id: "today", label: t("time.today"), count: summary.today, icon: CalendarClock },
    { id: SHOULD_START, label: t("venture.projects.shouldStart"), count: due.length, icon: PlayCircle },
    { id: "upcoming", label: t("time.upcoming"), count: summary.upcoming, icon: CalendarDays },
    { id: "overdue", label: t("status.overdue"), count: summary.overdue, icon: AlertTriangle },
    { id: "completed", label: t("status.completed"), count: summary.completed, icon: CheckCircle2 },
  ];

  const followUp = useMemo(() => {
    const rows = new Map();
    for (const item of due) {
      const name = item.owner?.name || "";
      if (!rows.has(name)) rows.set(name, { name, due: 0, working: 0, blocked: 0, waiting: 0 });
      const row = rows.get(name);
      row.due += 1;
      if (WORKING.includes(item.stored_status)) row.working += 1;
      else if (item.stored_status === "blocked") row.blocked += 1;
      else row.waiting += 1;
    }
    return [...rows.values()].sort((left, right) => right.waiting + right.blocked - (left.waiting + left.blocked) || right.due - left.due);
  }, [due]);

  const filtered = useMemo(() => {
    // Read the list INSIDE the memo: `data?.items || []` would be a new array on
    // every render and the memo would never hold.
    const all = edited;
    const needle = search.trim().toLowerCase();
    // By start date: what starts today comes first, then tomorrow, and so on;
    // work that already started follows (most recent first) and undated work
    // goes last.
    const today = localToday();
    const startOf = (item) => (item.start ? String(item.start).slice(0, 10) : null);
    const rank = (item) => {
      const start = startOf(item);
      if (!start) return 2;
      return start >= today ? 0 : 1;
    };
    const byDue = [...all].sort((left, right) => {
      const leftRank = rank(left);
      const rightRank = rank(right);
      if (leftRank !== rightRank) return leftRank - rightRank;
      const a = startOf(left) || "";
      const b = startOf(right) || "";
      if (a !== b) return leftRank === 1 ? (a < b ? 1 : -1) : a < b ? -1 : 1;
      const fa = left.finish ? new Date(left.finish).getTime() : Infinity;
      const fb = right.finish ? new Date(right.finish).getTime() : Infinity;
      return fa - fb;
    });
    return byDue.filter((item) => {
      if (bucket === SHOULD_START) {
        if (!ought(item, today)) return false;
      } else if (bucket !== ANY && item.bucket !== bucket) return false;
      if (owner !== ANY && item.owner?.name !== owner) return false;
      if (supporting !== ANY && !(item.supporting_names || []).includes(supporting)) return false;
      if (journey !== ANY && String(item.journey?.id || "") !== journey) return false;
      if (milestone !== ANY && String(item.milestone?.id || "") !== milestone) return false;
      if (status !== ANY && item.status?.id !== status) return false;
      if (!needle) return true;
      // Both wordings are searchable: a reader who types the original language
      // finds the row, and so does the reader who types the displayed one.
      const haystack = [
        item.title,
        item.ref,
        item.activity,
        item.deliverable,
        item.definition_of_done,
        item.owner?.name,
        item.supporting,
        item.journey?.name,
        item.milestone?.title,
      ]
        .filter(Boolean)
        .flatMap((value) => [value, tv(value)])
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [edited, bucket, owner, supporting, journey, milestone, status, search, tv]);

  const selectOptions = (values, anyLabel) => [
    { value: ANY, label: anyLabel },
    ...values.map((value) => ({ value, label: value })),
  ];

  // Five columns, each answering one question: what, who, when, in what state,
  // and where in the Journey. Related facts share a cell so a row reads at a glance.
  const columns = [
    {
      key: "title",
      label: t("venture.projects.work"),
      render: (_value, item) => (
        <div className="min-w-[300px] max-w-[520px]">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="stf-tag">{t(`venture.projects.kind.${item.kind}`)}</span>
            {item.ref && <span className="stf-tag o">{item.ref}</span>}
          </div>
          <p className="font-semibold text-[15px] text-[var(--text-primary)] break-words leading-snug">{tv(item.title)}</p>
          {item.deliverable && item.deliverable !== item.title && (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{tv(item.deliverable)}</p>
          )}
        </div>
      ),
    },
    {
      key: "owner",
      label: t("venture.tasksPanel.assignee"),
      render: (_value, item) => (
        <div className="min-w-[170px]">
          <AssigneeCell item={item} disabled={saving.has(item.id)} onChange={(change) => patchItem(item, change)} />
          {item.supporting && (
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
              {t("venture.projects.withSupport", { names: item.supporting })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "priority",
      label: t("venture.priority"),
      render: (_value, item) => (
        <PriorityCell item={item} disabled={saving.has(item.id)} onChange={(change) => patchItem(item, change)} />
      ),
    },
    {
      key: "finish",
      label: t("venture.projects.dates"),
      render: (_value, item) => (
        <div className="whitespace-nowrap text-[13px] leading-relaxed">
          <p className="text-[var(--text-secondary)]">
            <span className="text-[var(--text-tertiary)]">{t("venture.projects.startShort")} </span>
            {item.start ? formatDay(item.start, lang) : "—"}
          </p>
          <p className={item.bucket === "overdue" ? "text-rose-400 font-semibold" : "text-[var(--text-primary)]"}>
            <span className="text-[var(--text-tertiary)] font-normal">{t("venture.projects.finishShort")} </span>
            {item.finish ? formatDay(item.finish, lang) : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: t("venture.projects.status"),
      render: (_value, item) => (
        <StatusCell item={item} disabled={saving.has(item.id)} onChange={(change) => patchItem(item, change)} />
      ),
    },
    {
      key: "milestone",
      label: t("venture.projects.placement"),
      render: (_value, item) =>
        item.journey?.name || item.milestone?.title ? (
          <div className="min-w-[170px] max-w-[280px]">
            {item.journey?.name && <p className="text-[var(--text-secondary)] text-[13px]">{tv(item.journey.name)}</p>}
            {item.milestone?.title && (
              <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 line-clamp-2">{tv(item.milestone.title)}</p>
            )}
          </div>
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        ),
    },
  ];

  return (
    <div>
      {/* WHAT NEEDS ATTENTION — compact figures; a click filters on one. They sit
          in a single row so the work items below get the room they need. */}
      <div
        className="stf-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 10, maxWidth: 1000 }}
      >
        {buckets.map((entry) => (
          <KpiCard
            key={entry.id}
            compact
            label={entry.label}
            value={entry.count}
            icon={entry.icon}
            loading={loading}
            active={bucket === entry.id}
            onClick={() => setBucket(entry.id)}
          />
        ))}
      </div>

      {/* Who is on the tasks that ought to have started: one line per assignee. */}
      {bucket === SHOULD_START && (
        <div className="stf-card" style={{ marginBottom: 10, padding: 14 }}>
          <p className="stf-k" style={{ marginBottom: 8 }}>{t("venture.projects.followUp.title")}</p>
          {followUp.length === 0 ? (
            <p className="stf-small">{t("venture.projects.followUp.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="stf-tw" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>{t("venture.projects.followUp.assignee")}</th>
                    <th>{t("venture.projects.followUp.due")}</th>
                    <th>{t("venture.projects.followUp.working")}</th>
                    <th>{t("venture.projects.followUp.blocked")}</th>
                    <th>{t("venture.projects.followUp.waiting")}</th>
                    <th>{t("venture.projects.followUp.verdict")}</th>
                  </tr>
                </thead>
                <tbody>
                  {followUp.map((row) => {
                    const verdict = !row.name
                      ? ["r", "unassigned"]
                      : row.working === 0
                        ? ["r", "notStarted"]
                        : row.waiting + row.blocked > 0
                          ? ["o", "partial"]
                          : ["g", "onIt"];
                    return (
                      <tr key={row.name || "none"}>
                        <td>{row.name || t("venture.projects.followUp.nobody")}</td>
                        <td>{row.due}</td>
                        <td>{row.working}</td>
                        <td>{row.blocked}</td>
                        <td>{row.waiting}</td>
                        <td><span className={`stf-tag ${verdict[0]}`}>{t(`venture.projects.followUp.verdicts.${verdict[1]}`)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* FILTERS — every option is drawn from the loaded work, never hardcoded,
          and the whole set sits on one line: search, then one compact dropdown
          per fact. The list below is the screen. */}
      <div className="stf-bar" style={{ marginBottom: 10 }}>
        <span className="stf-k" style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          <SlidersHorizontal size={13} /> {t("venture.projects.filters")}
        </span>
        <input
          className="stf-input"
          style={{ flex: "2 1 200px" }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("venture.projects.searchPlaceholder")}
          aria-label={t("common.search")}
        />
        <select
          className="stf-input"
          style={{ flex: "1 1 130px" }}
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          aria-label={t("venture.manager.milestoneOwner")}
          title={t("venture.manager.milestoneOwner")}
        >
          {selectOptions(options.owners || [], t("venture.manager.milestoneOwner")).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="stf-input"
          style={{ flex: "1 1 130px" }}
          value={supporting}
          onChange={(event) => setSupporting(event.target.value)}
          aria-label={t("venture.manager.supporting")}
          title={t("venture.manager.supporting")}
        >
          {selectOptions(options.supporting || [], t("venture.manager.supporting")).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          className="stf-input"
          style={{ flex: "1 1 120px" }}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t("venture.projects.status")}
          title={t("venture.projects.status")}
        >
          <option value={ANY}>{t("venture.projects.status")}</option>
          {(options.statuses || []).map((entry) => (
            <option key={entry.id} value={entry.id}>{t(entry.key)}</option>
          ))}
        </select>
        <select
          className="stf-input"
          style={{ flex: "1 1 140px" }}
          value={journey}
          onChange={(event) => setJourney(event.target.value)}
          aria-label={t("venture.projects.journey")}
          title={t("venture.projects.journey")}
        >
          <option value={ANY}>{t("venture.projects.journey")}</option>
          {(options.journeys || []).map((entry) => (
            <option key={entry.id} value={String(entry.id)}>{tv(entry.name)}</option>
          ))}
        </select>
        <select
          className="stf-input"
          style={{ flex: "1 1 140px" }}
          value={milestone}
          onChange={(event) => setMilestone(event.target.value)}
          aria-label={t("venture.projects.milestone")}
          title={t("venture.projects.milestone")}
        >
          <option value={ANY}>{t("venture.projects.milestone")}</option>
          {(options.milestones || []).map((entry) => (
            <option key={entry.id} value={String(entry.id)}>{tv(entry.title)}</option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" className="stf-link-btn" style={{ flex: "none" }} onClick={clearFilters}>
            {t("venture.projects.clearFilters")}
          </button>
        )}
      </div>

      <SectionHead
        icon={ListChecks}
        title={t("venture.projects.workItems")}
        subtitle={t("venture.projects.itemCount", { count: filtered.length, total: summary.total })}
        action={
          emailsHref ? (
            <Link href={emailsHref} className="stf-btn sm">
              <Mail size={13} /> {t("venture.sentEmails.open")}
            </Link>
          ) : null
        }
      />

      {/* The source text stays on screen while the answer lands — no spinner
          over the list, only a quiet note that the wording is still settling. */}
      {translating && (
        <p className="stf-k" style={{ marginTop: -6, marginBottom: 8 }}>
          {t("venture.projects.translating")}
        </p>
      )}

      {error ? (
        <AppEmptyState
          title={t("venture.projects.loadFailed")}
          description={error}
          action={
            <AppButton variant="secondary" onClick={() => refresh()}>
              {t("common.retry")}
            </AppButton>
          }
        />
      ) : loading ? (
        <AppTable loading roomy columns={columns} data={[]} />
      ) : filtered.length === 0 ? (
        <AppEmptyState title={t("venture.projects.empty")} description={t("venture.projects.emptyHint")} />
      ) : (
        <AppTable roomy columns={columns} data={filtered} onRowClick={(item) => setSelected(item)} />
      )}

      <WorkItemDetailModal
        item={selected}
        ventureId={ventureId}
        tv={tv}
        onClose={() => setSelected(null)}
        onChanged={() => refresh()}
      />
    </div>
  );
}
