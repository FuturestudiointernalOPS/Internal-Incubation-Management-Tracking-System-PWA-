"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Phone, Mail, Users, FileText, Repeat, SquareCheck, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppSelect from "@/components/ui/AppSelect";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

export const dynamic = "force-dynamic";

const ICONS = {
  call:       <Phone className="w-4 h-4" />,
  email:      <Mail className="w-4 h-4" />,
  meeting:    <Users className="w-4 h-4" />,
  note:       <FileText className="w-4 h-4" />,
  follow_up:  <Repeat className="w-4 h-4" />,
  task:       <SquareCheck className="w-4 h-4" />,
  other:      <Clock className="w-4 h-4" />,
};

// Task rows carry native task statuses in the shared `outcome` column — those
// live in the status.* namespace, not in the CRM outcome vocabulary.
const TASK_STATUS_KEY = {
  pending:     "status.pending",
  in_progress: "status.inProgress",
  completed:   "status.completed",
  blocked:     "status.blocked",
  archived:    "status.archived",
};

function activityOutcomeLabel(activity, t) {
  if (activity.activity_type === "task") {
    const key = TASK_STATUS_KEY[activity.outcome];
    return key ? t(key) : activity.outcome;
  }
  return t(`crm.activities.outcomes.${activity.outcome}`);
}

export default function CrmActivitiesPage() {
  const { t } = useI18n();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterType, setFilterType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Activities page queries without a context filter for a global view
      const res  = await fetch("/api/crm/activities");
      const data = await res.json();
      setActivities(data.activities ?? []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterType
    ? activities.filter(a => a.activity_type === filterType)
    : activities;

  const typeOptions = [
    { value: "", label: t("crm.activities.filterAll") },
    { value: "call",      label: t("crm.activities.types.call") },
    { value: "meeting",   label: t("crm.activities.types.meeting") },
    { value: "email",     label: t("crm.activities.types.email") },
    { value: "note",      label: t("crm.activities.types.note") },
    { value: "follow_up", label: t("crm.activities.types.follow_up") },
    { value: "task",      label: t("crm.activities.types.task") },
    { value: "other",     label: t("crm.activities.types.other") },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          {t("crm.activities.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("crm.activities.subtitle")}
        </p>
      </div>

      {/* Filter */}
      <div className="flex gap-4 items-end">
        <div className="w-48">
          <AppSelect
            label={t("crm.activities.typeLabel")}
            value={filterType}
            onChange={setFilterType}
            options={typeOptions}
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <AppEmptyState
          message={t("crm.activities.noActivities")}
          hint={t("crm.activities.noActivitiesHint")}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(a => (
            <div
              key={a.id}
              className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-4 flex items-start gap-4"
            >
              <span className="mt-0.5 text-[var(--text-secondary)] shrink-0">
                {ICONS[a.activity_type] ?? ICONS.other}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {a.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  <span className="capitalize">
                    {t(`crm.activities.types.${a.activity_type}`) || a.activity_type}
                  </span>
                  {a.activity_date
                    ? ` · ${formatDate(new Date(a.activity_date))}`
                    : ""}
                  {a.owner_name ? ` · ${a.owner_name}` : ""}
                </p>
                {a.description && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                    {a.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {a.outcome && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-[var(--surface-3)] text-[var(--text-secondary)] capitalize">
                    {activityOutcomeLabel(a, t)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
