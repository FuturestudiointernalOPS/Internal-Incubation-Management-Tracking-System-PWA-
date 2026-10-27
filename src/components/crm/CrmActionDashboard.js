"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Award, CalendarClock, Filter, Moon, Percent, Timer, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";

/**
 * CRM — action dashboard.
 *
 * The workspace's answer to "what needs attention now?": four counts, the most
 * overdue next actions, the most dormant opportunities and the active value of
 * each pipeline (one line per currency — values are never summed across
 * currencies).
 *
 * Workspace-wide by decision: no owner filter. Visibility only — the endpoint
 * re-authorizes.
 */

function Stat({ label, value, tone = "neutral", icon: Icon }) {
  const tones = {
    neutral: "text-[var(--text-primary)]",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-4">
      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-black mt-2 ${tones[tone] ?? tones.neutral}`}>{value}</p>
    </div>
  );
}

function recordHref(kind, id) {
  return kind === "lead" ? `/crm/leads/${id}` : `/crm/opportunities/${id}`;
}

export default function CrmActionDashboard() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/crm/dashboard")
      .then((response) => response.json())
      .then((payload) => {
        if (alive && payload.success) setData(payload);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-40 rounded bg-[var(--surface-3)] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((key) => (
            <div key={key} className="h-20 rounded-xl bg-[var(--surface-2)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { counts, overdue = [], stale = [], pipelines = [], performance = { won: 0, lost: 0, averageStageDays: null, conversion: { rate: null, windowDays: 90 } }, staleAfterDays = 14 } = data;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("crm.dashboard.title")}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">{t("crm.dashboard.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={AlertTriangle}
          label={t("crm.dashboard.overdue")}
          value={counts.overdue}
          tone={counts.overdue > 0 ? "danger" : "neutral"}
        />
        <Stat
          icon={CalendarClock}
          label={t("crm.dashboard.dueSoon")}
          value={counts.dueSoon}
          tone={counts.dueSoon > 0 ? "warning" : "neutral"}
        />
        <Stat
          icon={Filter}
          label={t("crm.dashboard.awaitingQualification")}
          value={counts.awaitingQualification}
        />
        <Stat
          icon={Moon}
          label={t("crm.dashboard.stale", { days: staleAfterDays })}
          value={counts.stale}
          tone={counts.stale > 0 ? "warning" : "neutral"}
        />
      </div>

      {overdue.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
            {t("crm.dashboard.attentionRequired")}
          </h3>
          <ul className="space-y-2">
            {overdue.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={recordHref(item.kind, item.id)}
                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--brand-orange)] hover:underline"
                  >
                    {item.title}
                  </a>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {item.next_action}
                    {item.due ? ` · ${formatDate(new Date(item.due), { short: true }, lang)}` : ""}
                    {item.owner_name ? ` · ${item.owner_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                  {t("crm.activities.nextActionOverdue")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stale.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
            {t("crm.dashboard.dormant", { days: staleAfterDays })}
          </h3>
          <ul className="space-y-2">
            {stale.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <Moon className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/crm/opportunities/${item.id}`}
                    className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--brand-orange)] hover:underline"
                  >
                    {item.name}
                  </a>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {t("crm.dashboard.lastActivity", {
                      date: item.last_activity_at
                        ? formatDate(new Date(item.last_activity_at), { short: true }, lang)
                        : "—",
                    })}
                    {item.owner_name ? ` · ${item.owner_name}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pipelines.length > 0 && (
        <div className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] mb-3">
            {t("crm.dashboard.pipelineTitle")}
          </h3>
          <ul className="space-y-2">
            {pipelines.map((pipeline) => (
              <li key={pipeline.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  {pipeline.name}
                </span>
                <span className="text-sm text-[var(--text-secondary)]">
                  {pipeline.values
                    .map((entry) =>
                      `${Number(entry.value).toLocaleString()}${entry.currency ? ` ${entry.currency}` : ""}`,
                    )
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {t("crm.dashboard.performanceTitle")}
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={Award} label={t("crm.dashboard.won")} value={performance.won} />
          <Stat icon={XCircle} label={t("crm.dashboard.lost")} value={performance.lost} />
          <Stat
            icon={Timer}
            label={t("crm.dashboard.avgStage")}
            value={
              performance.averageStageDays == null
                ? t("crm.dashboard.noValue")
                : t("crm.dashboard.avgStageValue", { days: performance.averageStageDays })
            }
          />
          <Stat
            icon={Percent}
            label={t("crm.dashboard.conversion", { days: performance.conversion?.windowDays ?? 90 })}
            value={
              performance.conversion?.rate == null
                ? t("crm.dashboard.noValue")
                : t("crm.dashboard.conversionValue", {
                    percent: Math.round(performance.conversion.rate * 100),
                  })
            }
          />
        </div>
      </div>
    </section>
  );
}
