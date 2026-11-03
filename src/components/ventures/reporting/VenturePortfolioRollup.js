"use client";

import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { useApi } from "@/lib/hooks/useApi";
import AppCard from "@/components/ui/AppCard";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";

/**
 * THE PORTFOLIO ROLL-UP — spec §14, with the reporting discipline of §13.9.
 *
 * A read-only fold over the whole portfolio: nothing on this screen is stored,
 * so it cannot disagree with the Ventures it summarises. Where a figure cannot
 * be produced from the records — a missing amount, a Venture too young to
 * judge — the screen says so instead of showing a zero.
 */

const LIGHT_VARIANT = {
  green: "success",
  amber: "warning",
  red: "danger",
  unknown: "default",
};

const localeFor = (lang) => (lang === "fr" ? "fr-FR" : "en-GB");

const number = (value, lang, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: digits }).format(Number(value));

const percent = (value, lang) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : `${number(Number(value) * 100, lang, 1)}%`;

const STAGES = ["idea", "validation", "early_traction", "growth", "scaling", "unset"];

/** One label / value line. */
function Stat({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
        {value}
      </span>
    </div>
  );
}

/** A horizontal bar, used for the stage distribution. */
function Bar({ value, total, label }) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span style={{ color: "var(--text-secondary)" }}>{label}</span>
        <span className="font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
          <span className="ml-1 font-normal" style={{ color: "var(--text-secondary)" }}>
            {total > 0 ? `(${share}%)` : ""}
          </span>
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full" style={{ background: "var(--surface-3)" }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${share}%`, background: "var(--brand-orange)" }}
        />
      </div>
    </div>
  );
}

export default function VenturePortfolioRollup() {
  const { t, lang } = useI18n();
  const { data, loading, error } = useApi("/api/reporting/portfolio", { defaultValue: null });

  const portfolio = data?.portfolio || null;
  const discipline = data?.discipline || null;

  if (loading && !portfolio) {
    return (
      <p className="py-20 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        {t("venture.reporting.portfolio.loading")}
      </p>
    );
  }

  if (error || !portfolio) {
    return (
      <p className="py-20 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
        {t(error || "venture.reporting.portfolio.error")}
      </p>
    );
  }

  const stageTotal = portfolio.totalVentures;
  const light = portfolio.trafficLight;
  const lightTotal = light.green + light.amber + light.red + light.unknown;

  return (
    <div className="space-y-8 pb-20">
      {/* Always-visible way back: this screen is global, so it is not inside a
          Venture and has no Venture navigation bar above it. */}
      <div className="flex flex-wrap items-center gap-5">
        <Link
          href="/admin/ventures"
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft className="w-3 h-3" /> {t("vadmin.detail.backToVentures")}
        </Link>
        <Link
          href="/admin"
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80"
          style={{ color: "var(--text-secondary)" }}
        >
          <LayoutDashboard className="w-3 h-3" /> {t("navigation.dashboard")}
        </Link>
      </div>

      <div className="space-y-2 border-b pb-6" style={{ borderColor: "var(--border-primary)" }}>
        <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
          {t("venture.reporting.portfolio.title")}
        </h1>
        <p className="max-w-3xl text-[12px]" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.portfolio.subtitle")}
        </p>
        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.portfolio.generated")}:{" "}
          {new Date(portfolio.generatedAt).toLocaleString(localeFor(lang))}
        </p>
      </div>

      {portfolio.totalVentures === 0 && (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.portfolio.empty")}
        </p>
      )}

      {/* Stage distribution and health, side by side */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard padding="normal" className="space-y-4">
          <SectionHead title={t("venture.reporting.portfolio.stage.title")} />
          {stageTotal === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.portfolio.empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {STAGES.map((stage) => {
                const row = portfolio.stages.find((entry) => entry.stage === stage);
                if (!row) return null;
                return (
                  <Bar
                    key={stage}
                    value={row.total}
                    total={stageTotal}
                    label={
                      stage === "unset"
                        ? t("venture.reporting.portfolio.stage.unset")
                        : t(`venture.reporting.stage.name.${stage}`)
                    }
                  />
                );
              })}
            </div>
          )}
        </AppCard>

        <AppCard padding="normal" className="space-y-4">
          <SectionHead title={t("venture.reporting.portfolio.traffic.title")} />
          {lightTotal === 0 ? (
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.portfolio.empty")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {["green", "amber", "red", "unknown"].map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-xl border px-3 py-2"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <AppBadge variant={LIGHT_VARIANT[key]}>
                    {t(`venture.reporting.portfolio.traffic.${key}`)}
                  </AppBadge>
                  <span className="text-[15px] font-black" style={{ color: "var(--text-primary)" }}>
                    {light[key]}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.portfolio.traffic.hint")}
          </p>
        </AppCard>
      </div>

      {/* Funnel, time and survival */}
      <div className="grid gap-5 lg:grid-cols-3">
        <AppCard padding="normal" className="space-y-3">
          <SectionHead title={t("venture.reporting.portfolio.funnel.title")} />
          <Stat
            label={t("venture.reporting.portfolio.funnel.ventures")}
            value={number(portfolio.funnel.ventures, lang)}
          />
          <Stat
            label={t("venture.reporting.portfolio.funnel.withPaying")}
            value={number(portfolio.funnel.withPayingCustomer, lang)}
          />
          <Stat
            label={t("venture.reporting.portfolio.funnel.participants")}
            value={t("venture.reporting.portfolio.funnel.participantsUnknown")}
          />
        </AppCard>

        <AppCard padding="normal" className="space-y-3">
          <SectionHead title={t("venture.reporting.portfolio.time.title")} />
          <Stat
            label={t("venture.reporting.portfolio.time.average")}
            value={
              portfolio.timeToFirstPaying.averageDays === null
                ? "—"
                : t("venture.reporting.portfolio.time.days", {
                    days: number(portfolio.timeToFirstPaying.averageDays, lang, 1),
                  })
            }
          />
          <Stat
            label={t("venture.reporting.portfolio.time.median")}
            value={
              portfolio.timeToFirstPaying.medianDays === null
                ? "—"
                : t("venture.reporting.portfolio.time.days", {
                    days: number(portfolio.timeToFirstPaying.medianDays, lang, 1),
                  })
            }
          />
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.portfolio.time.toFirstPaying")} ·{" "}
            {t("venture.reporting.portfolio.time.ventures", {
              count: portfolio.timeToFirstPaying.ventures,
            })}
          </p>
        </AppCard>

        <AppCard padding="normal" className="space-y-3">
          <SectionHead title={t("venture.reporting.portfolio.survival.title")} />
          {[12, 24, 36].map((months) => {
            const row = portfolio.survival[`m${months}`];
            return (
              <Stat
                key={months}
                label={t("venture.reporting.portfolio.survival.months", { months })}
                value={
                  row.eligible === 0
                    ? t("venture.reporting.portfolio.survival.none")
                    : t("venture.reporting.portfolio.survival.eligible", {
                        survived: row.survived,
                        eligible: row.eligible,
                      })
                }
              />
            );
          })}
        </AppCard>
      </div>

      {/* Time in stage */}
      <AppCard padding="normal" className="space-y-3">
        <SectionHead title={t("venture.reporting.portfolio.time.inStage")} />
        {portfolio.timeInStage.every((row) => row.ventures === 0) ? (
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.portfolio.time.none")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr style={{ color: "var(--text-secondary)" }}>
                  <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                    {t("venture.reporting.portfolio.time.stage")}
                  </th>
                  <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                    {t("venture.reporting.portfolio.time.venturesShort")}
                  </th>
                  <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                    {t("venture.reporting.portfolio.time.average")}
                  </th>
                  <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                    {t("venture.reporting.portfolio.time.median")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {portfolio.timeInStage.map((row) => (
                  <tr key={row.stage} style={{ borderTop: "1px solid var(--border-primary)" }}>
                    <td className="py-2 font-bold" style={{ color: "var(--text-primary)" }}>
                      {t(`venture.reporting.stage.name.${row.stage}`)}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-secondary)" }}>
                      {row.ventures}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>
                      {row.averageDays === null
                        ? "—"
                        : t("venture.reporting.portfolio.time.days", {
                            days: number(row.averageDays, lang, 1),
                          })}
                    </td>
                    <td className="py-2" style={{ color: "var(--text-primary)" }}>
                      {row.medianDays === null
                        ? "—"
                        : t("venture.reporting.portfolio.time.days", {
                            days: number(row.medianDays, lang, 1),
                          })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AppCard>

      {/* Capital, jobs, team */}
      <div className="grid gap-5 lg:grid-cols-2">
        <AppCard padding="normal" className="space-y-3">
          <SectionHead title={t("venture.reporting.portfolio.capital.title")} />
          <Stat
            label={t("venture.reporting.portfolio.capital.total")}
            value={
              portfolio.financing.total === null
                ? "—"
                : `${portfolio.financing.approximate ? "≈ " : ""}${number(portfolio.financing.total, lang)}`
            }
          />
          <Stat
            label={t("venture.reporting.portfolio.capital.ventures")}
            value={number(portfolio.financing.ventures, lang)}
          />
          {portfolio.financing.total === null ? (
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.portfolio.capital.none")}
            </p>
          ) : (
            <>
              {portfolio.financing.byType.map((row) => (
                <Stat
                  key={row.type}
                  label={t(`venture.reporting.portfolio.capital.type.${row.type}`)}
                  value={`${row.approximate ? "≈ " : ""}${number(row.total, lang)}`}
                />
              ))}
              {portfolio.financing.approximate && (
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.reporting.portfolio.capital.approximate")}
                </p>
              )}
            </>
          )}
        </AppCard>

        <AppCard padding="normal" className="space-y-3">
          <SectionHead title={t("venture.reporting.portfolio.jobs.title")} />
          <Stat
            label={t("venture.reporting.portfolio.jobs.fte")}
            value={number(portfolio.jobs.fte, lang, 1)}
          />
          <Stat
            label={t("venture.reporting.portfolio.jobs.created")}
            value={number(portfolio.jobs.created, lang, 1)}
          />
          <Stat
            label={t("venture.reporting.portfolio.jobs.women")}
            value={
              portfolio.team.womenShare === null ? "—" : `${portfolio.team.womenShare}%`
            }
          />
          <Stat
            label={t("venture.reporting.portfolio.jobs.youth")}
            value={
              portfolio.team.youthShare === null ? "—" : `${portfolio.team.youthShare}%`
            }
          />
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.portfolio.jobs.members", { count: portfolio.team.members })}
          </p>
        </AppCard>
      </div>

      {/* Reporting discipline (§13.9) */}
      <AppCard padding="normal" className="space-y-4">
        <SectionHead
          title={t("venture.reporting.portfolio.discipline.title")}
          subtitle={t("venture.reporting.portfolio.discipline.subtitle")}
        />
        {!discipline ? (
          <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.portfolio.discipline.none")}
          </p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              {["monthly", "quarterly"].map((kind) => {
                const row = discipline[kind];
                return (
                  <div
                    key={kind}
                    className="space-y-2 rounded-xl border p-3"
                    style={{ borderColor: "var(--border-primary)" }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      {t(`venture.reporting.portfolio.discipline.${kind}`)}
                    </p>
                    <Stat label={t("venture.reporting.portfolio.discipline.due")} value={row.due} />
                    <Stat
                      label={t("venture.reporting.portfolio.discipline.received")}
                      value={`${row.received} (${percent(row.rate, lang)})`}
                    />
                    <Stat
                      label={t("venture.reporting.portfolio.discipline.onTime")}
                      value={`${row.onTime} (${percent(row.onTimeRate, lang)})`}
                    />
                    <Stat
                      label={t("venture.reporting.portfolio.discipline.rejected")}
                      value={`${row.rejected} (${percent(row.rejectedShare, lang)})`}
                    />
                  </div>
                );
              })}
            </div>

            {discipline.ventures.length === 0 ? (
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.portfolio.discipline.none")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr style={{ color: "var(--text-secondary)" }}>
                      <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                        {t("venture.reporting.portfolio.discipline.venture")}
                      </th>
                      <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                        {t("venture.reporting.portfolio.discipline.monthly")}
                      </th>
                      <th className="py-2 font-bold uppercase tracking-wider text-[9px]">
                        {t("venture.reporting.portfolio.discipline.quarterly")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {discipline.ventures.map((row) => (
                      <tr
                        key={row.ventureUuid}
                        style={{ borderTop: "1px solid var(--border-primary)" }}
                      >
                        <td className="py-2 font-mono" style={{ color: "var(--text-primary)" }}>
                          {row.venture}
                        </td>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>
                          {row.months.received}/{row.months.due} · {percent(row.months.rate, lang)}
                        </td>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>
                          {row.quarters.received}/{row.quarters.due} ·{" "}
                          {percent(row.quarters.rate, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </AppCard>
    </div>
  );
}
