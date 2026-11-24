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
import { formatCurrencyAmount } from "@/lib/currencies";
import VentureStageCard from "./VentureStageCard";
import VentureGlossary from "./VentureGlossary";

/**
 * STUDIO — the monthly report review queue.
 *
 * This screen is the ONLY place a month becomes part of the record. A founder's
 * submission arrives as `submitted`; the reviewer sees the inputs AND the
 * numbers the engine will produce, then validates or rejects with a reason.
 *
 * Gated on `ventures.validate` — an assignable capability, deliberately not
 * `ventures.edit` (the founder's right) and not `ventures.view` (which every
 * founder holds for their own Venture).
 */

const METRICS = [
  "total_revenue",
  "lost_customers",
  "churn_rate",
  "retention",
  "customer_growth_3m",
  "mrr_growth_mom",
  "mrr_growth_3m",
  "user_to_paid",
  "arpu",
  "customer_lifetime_months",
  "ltv",
  "net_burn",
  "average_burn",
  "runway_months",
  "fte",
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

function moneyText(t, lang, money, currency) {
  if (!money || !money.mode) return t("venture.reporting.monthly.notProvided");
  if (money.mode === "band") return money.band || "—";
  // The report's OWN currency, not today's setting: a month filed in CFA must
  // keep reading as CFA after the Venture switches currency.
  return formatCurrencyAmount(money.value ?? 0, currency, localeFor(lang));
}

const countText = (value) => (value === null || value === undefined ? "—" : String(value));

export default function VentureMonthlyReview({ ventureId }) {
  const { t, lang } = useI18n();
  const { prompt } = useDialogs();

  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/monthly/review`;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await api(base);
    if (result.ok) {
      setReports(result.payload.reports || []);
    } else {
      setError(result.payload.error || "errors.insufficientPermissions");
    }
    setLoading(false);
  }, [base]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = useCallback(async (period) => {
    if (!period) return;
    const result = await api(`${base}?period=${encodeURIComponent(period)}`);
    if (result.ok) setDetail(result.payload);
  }, [base]);

  // One row per month: the API returns every version, newest first.
  const months = useMemo(() => {
    const map = new Map();
    for (const report of reports) {
      if (!map.has(report.period)) map.set(report.period, report);
    }
    return [...map.values()];
  }, [reports]);

  useEffect(() => {
    if (selected) return;
    if (!months.length) return;
    const pending = months.find((month) => month.status === "submitted") || months[0];
    setSelected(pending.period);
  }, [months, selected]);

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  const metrics = useMemo(() => {
    if (detail?.preview) return detail.preview;
    const map = {};
    for (const metric of detail?.metrics || []) map[metric.key] = metric;
    return map;
  }, [detail]);

  // The currency the month was FILED in (the report's stamp), falling back to
  // the Venture's current setting for a month with no report yet.
  const currency =
    detail?.report?.currency || detail?.open?.currency || detail?.validated?.currency || detail?.currency || "XOF";

  const pendingReport = detail?.open?.status === "submitted" ? detail.open : null;

  const refresh = async () => {
    await Promise.all([loadList(), loadDetail(selected)]);
  };

  const validate = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice("");
    const result = await api(base, {
      method: "POST",
      body: JSON.stringify({ period: selected, action: "validate" }),
    });
    setBusy(false);
    if (!result.ok) {
      setError((result.payload.errors || [result.payload.error])[0] || "errors.somethingWrong");
      return;
    }
    setNotice(t("venture.reporting.monthly.message.validated"));
    await refresh();
  };

  const reject = async () => {
    if (!selected) return;
    const reason = await prompt({
      message: t("venture.reporting.review.reasonPrompt"),
      hint: t("venture.reporting.review.reasonHint"),
      tone: "danger",
      confirmLabel: t("venture.reporting.monthly.action.reject"),
      cancelLabel: t("common.cancel"),
      required: true,
    });
    if (!reason) return;

    setBusy(true);
    setError(null);
    setNotice("");
    const result = await api(base, {
      method: "POST",
      body: JSON.stringify({ period: selected, action: "reject", reason }),
    });
    setBusy(false);
    if (!result.ok) {
      setError((result.payload.errors || [result.payload.error])[0] || "errors.somethingWrong");
      return;
    }
    setNotice(t("venture.reporting.monthly.message.rejected"));
    await refresh();
  };

  if (error && !reports.length) {
    return (
      <AppCard padding="normal" className="space-y-2">
        <SectionHead
          title={t("venture.reporting.review.title")}
          subtitle={t("venture.reporting.review.subtitle")}
        />
        <p className="text-xs text-rose-500">{t(error)}</p>
      </AppCard>
    );
  }

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.review.title")}
        subtitle={t("venture.reporting.review.subtitle")}
        action={
          <Link href={`/admin/ventures/${ventureId}/reporting/quarterly`} className="stf-link-btn">
            {t("venture.reporting.review.switchToQuarterly")}
          </Link>
        }
      />

      {notice && <p className="text-xs font-bold text-emerald-600">{notice}</p>}
      {error && <p className="text-xs text-rose-500">{t(error)}</p>}

      {/* The stage decision belongs beside the review queue: the reviewer
          sees the criteria the numbers have to satisfy. */}
      <VentureStageCard ventureId={ventureId} canDecide />

      {/* The definitions behind the numbers, readable where the decision is made. */}
      <VentureGlossary ventureId={ventureId} />

      <AppCard padding="normal" className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.review.queue")}
        </p>
        {months.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.review.empty")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {months.map((month) => (
              <button
                key={month.period}
                type="button"
                onClick={() => {
                  setNotice("");
                  setSelected(month.period);
                }}
                className="stf-tag"
                style={{
                  cursor: "pointer",
                  outline: month.period === selected ? "2px solid var(--brand-orange)" : "none",
                }}
              >
                {month.period?.slice(0, 7)} · {t(`venture.reporting.monthly.status.${month.status}`)}
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
              {detail.report.submittedAt && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {t("venture.reporting.review.submittedOn")}{" "}
                  {String(detail.report.submittedAt).slice(0, 10)}
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {["mrr", "otherRevenue", "expenses", "cash"].map((field) => (
                <div key={field} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.monthly.field.${field}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {moneyText(t, lang, detail.report[field], currency)}
                  </span>
                </div>
              ))}
              {[
                "activeUsers",
                "payingCustomers",
                "newPayingCustomers",
                "fullTime",
                "partTimeDays",
                "fullTimeFounders",
                "northStarValue",
              ].map((field) => (
                <div key={field} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.monthly.field.${field}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {countText(detail.report[field])}
                  </span>
                </div>
              ))}
            </div>

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
                    {t(`venture.reporting.metric.${key}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {formatMetric(t, lang, key, metrics[key], currency)}
                  </span>
                </div>
              ))}
            </div>

            {pendingReport && (
              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
                <AppButton onClick={validate} disabled={busy}>
                  {t("venture.reporting.monthly.action.validate")}
                </AppButton>
                <AppButton variant="danger" onClick={reject} disabled={busy}>
                  {t("venture.reporting.monthly.action.reject")}
                </AppButton>
              </div>
            )}
          </AppCard>

          {detail.history?.length > 1 && (
            <AppCard padding="normal" className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.version.history")}
              </p>
              <ul className="space-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {detail.history.map((entry) => (
                  <li key={entry.id}>
                    {t("venture.reporting.versionLabel")} {entry.version} ·{" "}
                    {t(`venture.reporting.monthly.status.${entry.status}`)}
                    {entry.supersededAt ? ` · ${t("venture.reporting.version.superseded")}` : ""}
                    {entry.rejectionReason ? ` · ${entry.rejectionReason}` : ""}
                  </li>
                ))}
              </ul>
            </AppCard>
          )}
        </>
      )}
    </div>
  );
}
