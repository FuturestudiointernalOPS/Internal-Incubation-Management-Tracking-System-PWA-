"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";
import { formatMetric } from "./monthlyDisplay";

/**
 * STUDIO — the quarterly review queue.
 *
 * Same shape as the monthly review on purpose: a founder submits, the studio
 * sees the inputs AND the figures the engine will produce, then validates or
 * rejects with a reason. Gated on `ventures.validate`.
 */

const METRICS = [
  "net_new_customers",
  "net_new_mrr",
  "average_retention",
  "quarter_end_runway",
  "burn_multiple",
  "arpu_trend",
  "cac",
  "cac_payback_months",
  "ltv_cac",
  "pilot_to_paid",
  "mvp_on_time",
  "nrr",
];

const COUNT_FIELDS = [
  "mvpMilestonesPlanned",
  "mvpMilestonesHit",
  "pilotsSigned",
  "pilotsConverted",
  "openDeals",
  "salesCycleDays",
];

const STATUS_VARIANT = {
  draft: "default",
  submitted: "warning",
  validated: "success",
  rejected: "danger",
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

const localeFor = (lang) => (lang === "fr" ? "fr-FR" : "en-GB");

function moneyText(t, lang, money) {
  if (!money || !money.mode) return t("venture.reporting.monthly.notProvided");
  if (money.mode === "band") return money.band || "—";
  return `${new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: 0 }).format(
    money.value ?? 0,
  )} CFA`;
}

const countText = (value) => (value === null || value === undefined ? "—" : String(value));

export default function VentureQuarterlyReview({ ventureId }) {
  const { t, lang } = useI18n();
  const { prompt } = useDialogs();

  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/quarterly/review`;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await api(base);
    if (result.ok) setReports(result.payload.reports || []);
    else setError(result.payload.error || "errors.insufficientPermissions");
    setLoading(false);
  }, [base]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(
    async (period) => {
      if (!period) return;
      const result = await api(`${base}?period=${encodeURIComponent(period)}`);
      if (result.ok) setDetail(result.payload);
    },
    [base],
  );

  const quarters = useMemo(() => {
    const map = new Map();
    for (const report of reports) if (!map.has(report.period)) map.set(report.period, report);
    return [...map.values()];
  }, [reports]);

  useEffect(() => {
    if (selected || !quarters.length) return;
    const pending = quarters.find((quarter) => quarter.status === "submitted") || quarters[0];
    setSelected(pending.period);
  }, [quarters, selected]);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  const metrics = useMemo(() => {
    if (detail?.preview) return detail.preview;
    const map = {};
    for (const metric of detail?.metrics || []) map[metric.key] = metric;
    return map;
  }, [detail]);

  const pending = detail?.open?.status === "submitted" ? detail.open : null;

  const refresh = async () => {
    await Promise.all([loadList(), loadDetail(selected)]);
  };

  const decide = async (action) => {
    if (!selected) return;
    let reason = "";
    if (action === "reject") {
      const answer = await prompt({
        message: t("venture.reporting.review.reasonPrompt"),
        hint: t("venture.reporting.review.reasonHint"),
        tone: "danger",
        confirmLabel: t("venture.reporting.monthly.action.reject"),
        cancelLabel: t("common.cancel"),
        required: true,
      });
      if (!answer) return;
      reason = answer;
    }
    setBusy(true);
    setError(null);
    setNotice("");
    const result = await api(base, {
      method: "POST",
      body: JSON.stringify({ period: selected, action, reason }),
    });
    setBusy(false);
    if (!result.ok) {
      setError((result.payload.errors || [result.payload.error])[0] || "errors.somethingWrong");
      return;
    }
    setNotice(
      t(
        action === "validate"
          ? "venture.reporting.monthly.message.validated"
          : "venture.reporting.monthly.message.rejected",
      ),
    );
    await refresh();
  };

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.quarterly.title")}
        subtitle={t("venture.reporting.review.subtitle")}
        action={
          <Link href={`/admin/ventures/${ventureId}/reporting`} className="stf-link-btn">
            {t("venture.reporting.review.switchToMonthly")}
          </Link>
        }
      />

      {notice && <p className="text-xs font-bold text-emerald-600">{notice}</p>}
      {error && <p className="text-xs text-rose-500">{t(error)}</p>}

      <AppCard padding="normal" className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.review.queue")}
        </p>
        {quarters.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.review.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {quarters.map((quarter) => (
              <button
                key={quarter.period}
                type="button"
                onClick={() => {
                  setNotice("");
                  setSelected(quarter.period);
                }}
                className="stf-tag"
                style={{
                  cursor: "pointer",
                  outline: quarter.period === selected ? "2px solid var(--brand-orange)" : "none",
                }}
              >
                {quarter.period?.slice(0, 7)} · {t(`venture.reporting.monthly.status.${quarter.status}`)}
              </button>
            ))}
          </div>
        )}
      </AppCard>

      {detail?.report && (
        <>
          <AppCard padding="normal" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge variant={STATUS_VARIANT[detail.report.status] || "default"} dot>
                {t(`venture.reporting.monthly.status.${detail.report.status}`)}
              </AppBadge>
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {t("venture.reporting.versionLabel")} {detail.report.version}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COUNT_FIELDS.map((field) => (
                <div key={field} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.quarterly.field.${field}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {countText(detail.report[field])}
                  </span>
                </div>
              ))}
              {["salesMarketing", "expansion", "churned"].map((field) => (
                <div key={field} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.quarterly.field.${field}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {moneyText(t, lang, detail.report[field])}
                  </span>
                </div>
              ))}
            </div>

            {detail.report.channels?.length > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.quarterly.field.channels")}:{" "}
                {detail.report.channels
                  .map((channel) => t(`venture.reporting.quarterly.channel.${channel}`))
                  .join(", ")}
              </p>
            )}

            {detail.report.narrative && (
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {detail.report.narrative}
              </p>
            )}

            {detail.report.rejectionReason && (
              <p className="text-xs text-rose-500">
                {t("venture.reporting.monthly.rejectedNote")} {detail.report.rejectionReason}
              </p>
            )}
          </AppCard>

          <AppCard padding="normal" className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {detail.preview
                ? t("venture.reporting.monthly.preview")
                : t("venture.reporting.monthly.calculated")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {METRICS.map((key) => (
                <div key={key} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.quarterly.metric.${key}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {formatMetric(t, lang, key, metrics[key])}
                  </span>
                </div>
              ))}
            </div>

            {pending && (
              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
                <AppButton onClick={() => decide("validate")} disabled={busy}>
                  {t("venture.reporting.monthly.action.validate")}
                </AppButton>
                <AppButton variant="danger" onClick={() => decide("reject")} disabled={busy}>
                  {t("venture.reporting.monthly.action.reject")}
                </AppButton>
              </div>
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
