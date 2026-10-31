"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Award,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Filter,
  Hourglass,
  Moon,
  Percent,
  PhoneCall,
  Timer,
  TrendingUp,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/constants";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";

/**
 * CRM — action dashboard.
 *
 * The workspace's answer to "what should we do today?", in four blocks:
 *   Today's Work      follow-ups due today, overdue, meetings and tasks
 *   Pipeline          active value per pipeline, one line per currency
 *   Attention         dormant opportunities, leads awaiting qualification,
 *                     opportunities approaching their close date, stuck deals
 *   Performance       new/qualified leads, conversion, won/lost, stage duration
 *
 * Visibility only — the endpoint re-authorizes every read. Values are never
 * summed across currencies: a total mixing XOF and EUR would be a wrong number.
 */

function recordHref(kind, id) {
  return kind === "lead" ? `/crm/leads/${id}` : `/crm/opportunities/${id}`;
}

/** One row of a detail list: a record link and its secondary line. */
function DetailRow({ href, title, meta, badge }) {
  return (
    <li className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <a
          href={href}
          className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--brand-orange)] hover:underline"
        >
          {title}
        </a>
        {meta && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{meta}</p>
        )}
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-500">
          {badge}
        </span>
      )}
    </li>
  );
}

/** A card holding a titled list of records that need a decision. */
function DetailCard({ title, icon: Icon, tone = "text-[var(--brand-orange)]", children }) {
  return (
    <div className="stf-card">
      <h3>
        <Icon size={16} className={tone} />
        {title}
      </h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

export default function CrmActionDashboard() {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

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
  }, [attempt]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((section) => (
          <div key={section} className="space-y-3">
            <div className="h-4 w-40 rounded bg-[var(--surface-3)] animate-pulse" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((card) => (
                <div key={card} className="h-20 rounded-xl bg-[var(--surface-2)] animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="stf-card">
        <p className="text-sm text-[var(--text-secondary)]">
          {t("crm.dashboard.loadFailed")}
        </p>
        <button
          type="button"
          className="stf-link-btn mt-2"
          onClick={() => {
            setLoading(true);
            setAttempt((value) => value + 1);
          }}
        >
          {t("crm.dashboard.retry")}
        </button>
      </div>
    );
  }

  const {
    counts = {},
    overdue = [],
    stale = [],
    stuck = [],
    pipelines = [],
    staleAfterDays = 14,
    closeSoonDays = 30,
    performance = {
      windowDays: 30,
      newLeads: 0,
      qualifiedLeads: 0,
      won: 0,
      lost: 0,
      averageStageDays: null,
      conversion: { rate: null, windowDays: 90 },
    },
  } = data;

  const conversionRate =
    performance.conversion?.rate == null
      ? t("crm.dashboard.noValue")
      : t("crm.dashboard.conversionValue", {
          percent: Math.round(performance.conversion.rate * 100),
        });

  return (
    <section className="space-y-8">
      {/* A — TODAY'S WORK */}
      <div className="space-y-3">
        <SectionHead
          icon={CalendarClock}
          title={t("crm.dashboard.todayTitle")}
          subtitle={t("crm.dashboard.todaySubtitle")}
        />
        <div className="stf-grid c4">
          <KpiCard
            compact
            icon={PhoneCall}
            label={t("crm.dashboard.followUpsDue")}
            value={counts.dueToday ?? 0}
            hint={t("crm.dashboard.next7Days", { count: counts.dueSoon ?? 0 })}
          />
          <KpiCard
            compact
            icon={AlertTriangle}
            label={t("crm.dashboard.overdue")}
            value={counts.overdue ?? 0}
          />
          <KpiCard
            compact
            icon={CalendarDays}
            label={t("crm.dashboard.meetings")}
            value={counts.meetingsToday ?? 0}
          />
          <KpiCard
            compact
            icon={CheckSquare}
            label={t("crm.dashboard.tasks")}
            value={counts.tasksToday ?? 0}
          />
        </div>

        {overdue.length > 0 && (
          <DetailCard
            icon={AlertTriangle}
            tone="text-red-500"
            title={t("crm.dashboard.attentionRequired")}
          >
            {overdue.map((item) => (
              <DetailRow
                key={`${item.kind}-${item.id}`}
                href={recordHref(item.kind, item.id)}
                title={item.title}
                meta={[
                  item.next_action,
                  item.due
                    ? formatDate(new Date(item.due), { short: true }, lang)
                    : null,
                  item.owner_name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                badge={t("crm.activities.nextActionOverdue")}
              />
            ))}
          </DetailCard>
        )}
      </div>

      {/* B — PIPELINE */}
      <div className="space-y-3">
        <SectionHead
          icon={TrendingUp}
          title={t("crm.dashboard.pipelineTitle")}
          subtitle={t("crm.dashboard.pipelineSubtitle")}
        />
        {pipelines.length === 0 ? (
          <p className="stf-empty">{t("crm.dashboard.pipelineEmpty")}</p>
        ) : (
          <div className="stf-grid">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="stf-card">
                <p className="stf-k">{pipeline.name}</p>
                <div className="mt-2 space-y-1">
                  {pipeline.values.map((entry) => (
                    <p
                      key={entry.currency ?? "none"}
                      className="flex items-baseline justify-between gap-2 text-xl font-black tabular-nums text-[var(--text-primary)]"
                    >
                      <span>{Number(entry.value).toLocaleString(lang)}</span>
                      <span className="stf-tag o">
                        {entry.currency ?? t("crm.dashboard.noCurrency")}
                      </span>
                    </p>
                  ))}
                </div>
                <p className="stf-small">
                  {t("crm.dashboard.opportunityCount", {
                    count: pipeline.opportunityCount,
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C — ATTENTION REQUIRED */}
      <div className="space-y-3">
        <SectionHead
          icon={AlertTriangle}
          title={t("crm.dashboard.attentionTitle")}
          subtitle={t("crm.dashboard.attentionSubtitle")}
        />
        <div className="stf-grid c4">
          <KpiCard
            compact
            icon={Moon}
            label={t("crm.dashboard.stale", { days: staleAfterDays })}
            value={counts.stale ?? 0}
          />
          <KpiCard
            compact
            icon={Filter}
            label={t("crm.dashboard.awaitingQualification")}
            value={counts.awaitingQualification ?? 0}
          />
          <KpiCard
            compact
            icon={CalendarClock}
            label={t("crm.dashboard.approachingClose")}
            value={counts.approachingClose ?? 0}
            hint={t("crm.dashboard.approachingCloseHint", { days: closeSoonDays })}
          />
          <KpiCard
            compact
            icon={Hourglass}
            label={t("crm.dashboard.stuck")}
            value={counts.stuck ?? 0}
          />
        </div>

        {stale.length > 0 && (
          <DetailCard
            icon={Moon}
            tone="text-amber-500"
            title={t("crm.dashboard.dormant", { days: staleAfterDays })}
          >
            {stale.map((item) => (
              <DetailRow
                key={item.id}
                href={`/crm/opportunities/${item.id}`}
                title={item.name}
                meta={[
                  t("crm.dashboard.lastActivity", {
                    date: item.last_activity_at
                      ? formatDate(
                          new Date(item.last_activity_at),
                          { short: true },
                          lang,
                        )
                      : "—",
                  }),
                  item.owner_name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </DetailCard>
        )}

        {stuck.length > 0 && (
          <DetailCard
            icon={Hourglass}
            tone="text-red-500"
            title={t("crm.dashboard.stuckTitle")}
          >
            {stuck.map((item) => (
              <DetailRow
                key={item.id}
                href={`/crm/opportunities/${item.id}`}
                title={item.name}
                meta={[
                  t("crm.dashboard.stuckItem", {
                    stage: item.stage_name,
                    days: item.days_in_stage,
                    target: item.target_days,
                  }),
                  item.owner_name,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </DetailCard>
        )}
      </div>

      {/* D — PERFORMANCE */}
      <div className="space-y-3">
        <SectionHead
          icon={Award}
          title={t("crm.dashboard.performanceTitle")}
          subtitle={t("crm.dashboard.performanceSubtitle", {
            days: performance.windowDays ?? 30,
          })}
        />
        <div className="stf-grid c4">
          <KpiCard
            compact
            icon={UserPlus}
            label={t("crm.dashboard.newLeads")}
            value={performance.newLeads ?? 0}
          />
          <KpiCard
            compact
            icon={UserCheck}
            label={t("crm.dashboard.qualifiedLeads")}
            value={performance.qualifiedLeads ?? 0}
          />
          <KpiCard
            compact
            icon={Percent}
            label={t("crm.dashboard.conversion", {
              days: performance.conversion?.windowDays ?? 90,
            })}
            value={conversionRate}
          />
          <KpiCard
            compact
            icon={Award}
            label={t("crm.dashboard.wonOpportunities")}
            value={performance.won ?? 0}
          />
          <KpiCard
            compact
            icon={XCircle}
            label={t("crm.dashboard.lostOpportunities")}
            value={performance.lost ?? 0}
          />
          <KpiCard
            compact
            icon={Timer}
            label={t("crm.dashboard.avgStage")}
            value={
              performance.averageStageDays == null
                ? t("crm.dashboard.noValue")
                : t("crm.dashboard.avgStageValue", {
                    days: performance.averageStageDays,
                  })
            }
          />
        </div>
      </div>
    </section>
  );
}
