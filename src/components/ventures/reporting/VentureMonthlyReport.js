"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";
import { formatMetric, formatBand } from "./monthlyDisplay";

/**
 * FOUNDER — the monthly report tab.
 *
 * Eleven inputs, nothing else: every figure below the form is calculated by the
 * server from what was typed here. The founder never enters churn, runway, LTV
 * or FTE.
 *
 * Money is answered in one of two modes per field — an exact amount, or a band
 * from the studio's ladder. The mode is part of the answer, so the system can
 * always say whether a number is precise or approximate.
 */

const MONEY_FIELDS = [
  { key: "mrr", kind: "flow", optional: false },
  { key: "otherRevenue", kind: "flow", optional: true },
  { key: "expenses", kind: "flow", optional: false },
  { key: "cash", kind: "cash", optional: false },
];

const COUNT_FIELDS = [
  "activeUsers",
  "payingCustomers",
  "newPayingCustomers",
  "fullTime",
  "partTime",
  "partTimeDays",
  "fullTimeFounders",
  "northStarValue",
];

/** The acquisition channels. The same six the quarterly form offers. */
const CHANNELS = ["referral", "outbound", "partnership", "content", "paid_ads", "other"];

/** The order the dashboard will show them in. */
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

const EMPTY_FORM = {
  mrrMode: "exact",
  mrrValue: "",
  mrrBand: "",
  otherRevenueMode: "",
  otherRevenueValue: "",
  otherRevenueBand: "",
  expensesMode: "exact",
  expensesValue: "",
  expensesBand: "",
  cashMode: "exact",
  cashValue: "",
  cashBand: "",
  financingReceived: "no",
  activeUsers: "",
  payingCustomers: "",
  newPayingCustomers: "",
  fullTime: "",
  partTime: "",
  partTimeDays: "",
  fullTimeFounders: "",
  northStarValue: "",
  channels: [],
  narrative: "",
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

/** Stored report → the flat form the inputs bind to. */
function reportToForm(report) {
  if (!report) return EMPTY_FORM;
  const money = (field) => ({
    [`${field}Mode`]: report[field]?.mode || (field === "otherRevenue" ? "" : "exact"),
    [`${field}Value`]: report[field]?.value ?? "",
    [`${field}Band`]: report[field]?.band || "",
  });
  return {
    ...EMPTY_FORM,
    ...money("mrr"),
    ...money("otherRevenue"),
    ...money("expenses"),
    ...money("cash"),
    financingReceived: report.financingReceived ? "yes" : "no",
    activeUsers: report.activeUsers ?? "",
    payingCustomers: report.payingCustomers ?? "",
    newPayingCustomers: report.newPayingCustomers ?? "",
    fullTime: report.fullTime ?? "",
    partTime: report.partTime ?? "",
    partTimeDays: report.partTimeDays ?? "",
    fullTimeFounders: report.fullTimeFounders ?? "",
    northStarValue: report.northStarValue ?? "",
    channels: report.channels || [],
    narrative: report.narrative || "",
  };
}

const STATUS_VARIANT = {
  draft: "default",
  submitted: "warning",
  validated: "success",
  rejected: "danger",
};

function MoneyField({ field, form, set, bands, disabled, t, lang }) {
  const mode = form[`${field.key}Mode`] || "";
  const bandOptions = (bands?.[field.kind] || []).map((band) => ({
    value: band.code,
    label: formatBand(lang, band),
  }));
  const modeOptions = [
    ...(field.optional ? [{ value: "", label: t("venture.reporting.monthly.notProvided") }] : []),
    { value: "exact", label: t("venture.reporting.mode.exact") },
    { value: "band", label: t("venture.reporting.mode.band") },
  ];

  return (
    <div
      className="rounded-xl border p-3 space-y-3"
      style={{ borderColor: "var(--border-primary)", background: "var(--surface-1)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {t(`venture.reporting.monthly.field.${field.key}`)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <AppSelect
          label={t("venture.reporting.monthly.mode")}
          value={mode}
          onChange={set(`${field.key}Mode`)}
          options={modeOptions}
          disabled={disabled}
        />
        {mode === "band" ? (
          <AppSelect
            label={t("venture.reporting.monthly.band")}
            value={form[`${field.key}Band`] || ""}
            onChange={set(`${field.key}Band`)}
            options={bandOptions}
            disabled={disabled}
          />
        ) : (
          <AppInput
            type="number"
            min="0"
            label={t("venture.reporting.monthly.amount")}
            value={form[`${field.key}Value`] ?? ""}
            onChange={set(`${field.key}Value`)}
            disabled={disabled || mode === ""}
          />
        )}
      </div>
    </div>
  );
}

export default function VentureMonthlyReport({ ventureId }) {
  const { t, lang } = useI18n();
  const [period, setPeriod] = useState(currentMonth());
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/monthly`;

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const result = await api(`${base}?period=${encodeURIComponent(period)}`);
    if (result.ok) {
      setDetail(result.payload);
      setForm(reportToForm(result.payload.report));
    } else if (result.status !== 401 && result.status !== 404) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
    }
    setLoading(false);
  }, [base, period]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleChannel = (channel) =>
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));

  const save = async (submit) => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(base, {
      method: "POST",
      body: JSON.stringify({ ...form, period, submit }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setStatus(
      t(
        submit
          ? "venture.reporting.monthly.message.submitted"
          : "venture.reporting.monthly.message.saved",
      ),
    );
    await load();
  };

  const metrics = useMemo(() => {
    if (detail?.preview) return detail.preview;
    const map = {};
    for (const metric of detail?.metrics || []) map[metric.key] = metric;
    return map;
  }, [detail]);

  const open = detail?.open || null;
  const validated = detail?.validated || null;
  const locked = open?.status === "submitted";
  const currentStatus = open?.status || validated?.status || null;
  // A rejected row is closed, so it never appears as `open` — it stays in the
  // history and is what the founder is correcting.
  const rejected = (detail?.history || []).find((entry) => entry.status === "rejected") || null;

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.monthly.title")}
        subtitle={t("venture.reporting.monthly.subtitle")}
      />

      <AppCard padding="normal" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <AppInput
            type="month"
            label={t("venture.reporting.monthly.period")}
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setStatus("");
            }}
          />
          <div className="flex items-end gap-2 pb-1">
            {currentStatus && (
              <AppBadge variant={STATUS_VARIANT[currentStatus] || "default"} dot>
                {t(`venture.reporting.monthly.status.${currentStatus}`)}
              </AppBadge>
            )}
            {open?.version ? (
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {t("venture.reporting.versionLabel")} {open.version}
              </span>
            ) : null}
          </div>
        </div>

        {locked && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.monthly.lockedNote")}
          </p>
        )}
        {detail?.schedule && (
          <p
            className="text-xs font-bold"
            style={{ color: detail.schedule.overdue ? "#EF4444" : "var(--text-secondary)" }}
          >
            {t("venture.reporting.due.dueOn")} {detail.schedule.dueDate}
            {detail.schedule.overdue ? ` · ${t("venture.reporting.due.overdue")}` : ""}
          </p>
        )}
        {!locked && validated && !open && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.monthly.correctionNote")}
          </p>
        )}
        {rejected && !open && (
          <p className="text-xs text-rose-500">
            {t("venture.reporting.monthly.rejectedNote")} {rejected.rejectionReason || ""}
          </p>
        )}
      </AppCard>

      {errors.length > 0 && (
        <AppCard padding="normal">
          <ul className="space-y-1 text-xs text-rose-500">
            {errors.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        </AppCard>
      )}
      {status && <p className="text-xs font-bold text-emerald-600">{status}</p>}

      <AppCard padding="normal" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {MONEY_FIELDS.map((field) => (
            <MoneyField
              key={field.key}
              field={field}
              form={form}
              set={set}
              bands={detail?.bands}
              disabled={locked}
              t={t}
              lang={lang}
            />
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <AppSelect
            label={t("venture.reporting.monthly.field.financingReceived")}
            value={form.financingReceived}
            onChange={set("financingReceived")}
            disabled={locked}
            options={[
              { value: "no", label: t("common.no") },
              { value: "yes", label: t("common.yes") },
            ]}
          />
          {COUNT_FIELDS.map((field) => (
            <AppInput
              key={field}
              type="number"
              min="0"
              label={t(`venture.reporting.monthly.field.${field}`)}
              value={form[field] ?? ""}
              onChange={set(field)}
              disabled={locked}
            />
          ))}
        </div>

        <div className="space-y-2">
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("venture.reporting.monthly.field.channels")}
          </p>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((channel) => (
              <label
                key={channel}
                className="flex items-center gap-2 text-[11px]"
                style={{ color: "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={form.channels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                  disabled={locked}
                />
                {t(`venture.reporting.quarterly.channel.${channel}`)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="venture-monthly-narrative"
            className="text-[10px] font-bold uppercase tracking-wider ml-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("venture.reporting.monthly.field.narrative")}
          </label>
          <textarea
            id="venture-monthly-narrative"
            rows={4}
            value={form.narrative}
            onChange={set("narrative")}
            disabled={locked}
            className="w-full rounded-xl py-3 px-4 text-[13px] font-medium outline-none transition-all border focus:!border-[var(--brand-orange)]"
            style={{
              background: "var(--surface-1)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {!locked && (
          <div className="flex flex-wrap gap-2">
            <AppButton variant="secondary" onClick={() => save(false)} disabled={saving}>
              {t("venture.reporting.monthly.action.saveDraft")}
            </AppButton>
            <AppButton onClick={() => save(true)} disabled={saving}>
              {t("venture.reporting.monthly.action.submit")}
            </AppButton>
          </div>
        )}
      </AppCard>

      <AppCard padding="normal" className="space-y-4">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {detail?.preview
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
                {formatMetric(t, lang, key, metrics[key])}
              </span>
            </div>
          ))}
        </div>
      </AppCard>

      {detail?.history?.length > 1 && (
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
    </div>
  );
}
