"use client";

import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import { useI18n } from "@/lib/i18n";
import { statusLabel, statusChipClass } from "@/lib/ventureStatuses";
import AppTable from "@/components/ui/AppTable";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import WorkItemDetailModal from "./WorkItemDetailModal";
import { formatDay } from "./projectFormat";

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

export default function ProjectsWorkItemsView({ ventureId }) {
  const { t, lang } = useI18n();

  // One read per Venture; `deps` keeps its size fixed (the hook's contract).
  const { data, loading, error, refresh } = useApi(
    ventureId ? `/api/ventures/${ventureId}/work-items` : null,
    { deps: [ventureId], defaultValue: null },
  );

  const [bucket, setBucket] = useState(ANY);
  const [owner, setOwner] = useState(ANY);
  const [supporting, setSupporting] = useState(ANY);
  const [journey, setJourney] = useState(ANY);
  const [milestone, setMilestone] = useState(ANY);
  const [status, setStatus] = useState(ANY);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const options = data?.options || {};
  const summary = data?.summary || { total: 0, today: 0, upcoming: 0, overdue: 0, completed: 0 };

  const buckets = [
    { id: ANY, label: t("venture.projects.filterAll"), count: summary.total },
    { id: "today", label: t("time.today"), count: summary.today },
    { id: "upcoming", label: t("time.upcoming"), count: summary.upcoming },
    { id: "overdue", label: t("status.overdue"), count: summary.overdue },
    { id: "completed", label: t("status.completed"), count: summary.completed },
  ];

  const filtered = useMemo(() => {
    // Read the list INSIDE the memo: `data?.items || []` would be a new array on
    // every render and the memo would never hold.
    const all = data?.items || [];
    const needle = search.trim().toLowerCase();
    return all.filter((item) => {
      if (bucket !== ANY && item.bucket !== bucket) return false;
      if (owner !== ANY && item.owner?.name !== owner) return false;
      if (supporting !== ANY && !(item.supporting_names || []).includes(supporting)) return false;
      if (journey !== ANY && String(item.journey?.id || "") !== journey) return false;
      if (milestone !== ANY && String(item.milestone?.id || "") !== milestone) return false;
      if (status !== ANY && item.status?.id !== status) return false;
      if (!needle) return true;
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
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [data, bucket, owner, supporting, journey, milestone, status, search]);

  const selectOptions = (values, anyLabel) => [
    { value: ANY, label: anyLabel },
    ...values.map((value) => ({ value, label: value })),
  ];

  const columns = [
    {
      key: "title",
      label: t("venture.projects.work"),
      render: (_value, item) => (
        <div className="min-w-[240px] max-w-[420px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.ref && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--brand-orange)] shrink-0">
                {item.ref}
              </span>
            )}
            <span className="font-semibold text-[var(--text-primary)] break-words">{item.title}</span>
          </div>
          {item.deliverable && item.deliverable !== item.title && (
            <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 line-clamp-1">{item.deliverable}</p>
          )}
        </div>
      ),
    },
    {
      key: "kind",
      label: t("venture.projects.type"),
      render: (_value, item) => (
        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] whitespace-nowrap">
          {t(`venture.projects.kind.${item.kind}`)}
        </span>
      ),
    },
    {
      key: "owner",
      label: t("venture.manager.milestoneOwner"),
      render: (_value, item) =>
        item.owner ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[var(--text-primary)]">{item.owner.name}</span>
            {item.owner.external && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-tertiary)]">
                {t("venture.personField.external")}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[var(--text-tertiary)]">—</span>
        ),
    },
    {
      key: "supporting",
      label: t("venture.manager.supporting"),
      render: (_value, item) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {item.supporting || <span className="text-[var(--text-tertiary)]">—</span>}
        </span>
      ),
    },
    {
      key: "start",
      label: t("venture.manager.startDate"),
      render: (_value, item) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {item.start ? formatDay(item.start, lang) : "—"}
        </span>
      ),
    },
    {
      key: "finish",
      label: t("venture.manager.finishDate"),
      render: (_value, item) => (
        <span
          className={`whitespace-nowrap ${item.bucket === "overdue" ? "text-rose-400 font-semibold" : "text-[var(--text-secondary)]"}`}
        >
          {item.finish ? formatDay(item.finish, lang) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: t("venture.projects.status"),
      render: (_value, item) => (
        <span
          className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded whitespace-nowrap ${statusChipClass(item.status)}`}
        >
          {statusLabel(item.status, t)}
        </span>
      ),
    },
    {
      key: "journey",
      label: t("venture.projects.journey"),
      render: (_value, item) => (
        <span className="text-[var(--text-secondary)] whitespace-nowrap">
          {item.journey?.name || <span className="text-[var(--text-tertiary)]">—</span>}
        </span>
      ),
    },
    {
      key: "milestone",
      label: t("venture.projects.milestone"),
      render: (_value, item) => (
        <span className="text-[var(--text-secondary)]">
          {item.milestone?.title || <span className="text-[var(--text-tertiary)]">—</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* WHAT NEEDS ATTENTION — the buckets, with their counts, before the detail. */}
      <div className="flex flex-wrap items-center gap-2">
        {buckets.map((entry) => {
          const active = bucket === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setBucket(entry.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors ${
                active
                  ? "bg-[var(--brand-orange)] text-black border-transparent"
                  : "text-[var(--text-secondary)] border-[var(--border-primary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {entry.label}
              <span className={`ml-1.5 ${active ? "text-black/60" : "text-[var(--text-tertiary)]"}`}>{entry.count}</span>
            </button>
          );
        })}
      </div>

      {/* FILTERS — every option is drawn from the loaded work, never hardcoded. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <AppInput
          label={t("common.search")}
          icon={Search}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("venture.projects.searchPlaceholder")}
        />
        <AppSelect
          label={t("venture.manager.milestoneOwner")}
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          options={selectOptions(options.owners || [], t("venture.projects.anyOption"))}
        />
        <AppSelect
          label={t("venture.manager.supporting")}
          value={supporting}
          onChange={(event) => setSupporting(event.target.value)}
          options={selectOptions(options.supporting || [], t("venture.projects.anyOption"))}
        />
        <AppSelect
          label={t("venture.projects.journey")}
          value={journey}
          onChange={(event) => setJourney(event.target.value)}
          options={[
            { value: ANY, label: t("venture.projects.anyOption") },
            ...(options.journeys || []).map((entry) => ({ value: String(entry.id), label: entry.name })),
          ]}
        />
        <AppSelect
          label={t("venture.projects.milestone")}
          value={milestone}
          onChange={(event) => setMilestone(event.target.value)}
          options={[
            { value: ANY, label: t("venture.projects.anyOption") },
            ...(options.milestones || []).map((entry) => ({ value: String(entry.id), label: entry.title })),
          ]}
        />
        <AppSelect
          label={t("venture.projects.status")}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: ANY, label: t("venture.projects.anyOption") },
            ...(options.statuses || []).map((entry) => ({ value: entry.id, label: t(entry.key) })),
          ]}
        />
      </div>

      <p className="text-[10px] text-[var(--text-tertiary)]">
        {t("venture.projects.itemCount", { count: filtered.length, total: summary.total })}
      </p>

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
        <AppTable loading columns={columns} data={[]} />
      ) : filtered.length === 0 ? (
        <AppEmptyState title={t("venture.projects.empty")} description={t("venture.projects.emptyHint")} />
      ) : (
        <AppTable columns={columns} data={filtered} onRowClick={(item) => setSelected(item)} />
      )}

      <WorkItemDetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
