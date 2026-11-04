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
import { getCurrencySymbol } from "@/lib/currencies";

/**
 * FOUNDER — the Quarterly tab (spec §9).
 *
 * Only what the monthly reports cannot answer. Customers, MRR, retention and
 * runway are already known, so the founder is not asked for them again.
 */

const CHANNELS = ["referral", "outbound", "partnership", "content", "paid_ads", "other"];
const TOP3 = ["under_30", "30_60", "over_60"];

const QUARTERLY_METRICS = [
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

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

const EMPTY = {
  teamConfirmed: "yes",
  mvpMilestonesPlanned: "",
  mvpMilestonesHit: "",
  pilotsSigned: "",
  pilotsConverted: "",
  channels: [],
  salesMarketingMode: "",
  salesMarketingValue: "",
  salesMarketingBand: "",
  openDeals: "",
  salesCycleDays: "",
  top3ShareBand: "",
  expansionMode: "",
  expansionValue: "",
  expansionBand: "",
  churnedMode: "",
  churnedValue: "",
  churnedBand: "",
  narrative: "",
};

function reportToForm(report) {
  if (!report) return EMPTY;
  const money = (field, prefix) => ({
    [`${prefix}Mode`]: report[field]?.mode || "",
    [`${prefix}Value`]: report[field]?.value ?? "",
    [`${prefix}Band`]: report[field]?.band || "",
  });
  return {
    ...EMPTY,
    ...money("salesMarketing", "salesMarketing"),
    ...money("expansion", "expansion"),
    ...money("churned", "churned"),
    teamConfirmed: report.teamConfirmed ? "yes" : "no",
    mvpMilestonesPlanned: report.mvpMilestonesPlanned ?? "",
    mvpMilestonesHit: report.mvpMilestonesHit ?? "",
    pilotsSigned: report.pilotsSigned ?? "",
    pilotsConverted: report.pilotsConverted ?? "",
    channels: report.channels || [],
    openDeals: report.openDeals ?? "",
    salesCycleDays: report.salesCycleDays ?? "",
    top3ShareBand: report.top3ShareBand || "",
    narrative: report.narrative || "",
  };
}

function MoneyRow({ prefix, labelKey, form, set, bands, disabled, t, lang, currency }) {
  const mode = form[`${prefix}Mode`] || "";
  const bandOptions = (bands?.flow || []).map((band) => ({
    value: band.code,
    label: formatBand(lang, band),
  }));
  return (
    <div className="rounded-xl border p-3 space-y-3" style={{ borderColor: "var(--border-primary)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {t(labelKey)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <AppSelect
          label={t("venture.reporting.monthly.mode")}
          value={mode}
          onChange={set(`${prefix}Mode`)}
          disabled={disabled}
          options={[
            { value: "", label: t("venture.reporting.monthly.notProvided") },
            { value: "exact", label: t("venture.reporting.mode.exact") },
            { value: "band", label: t("venture.reporting.mode.band") },
          ]}
        />
        {mode === "band" ? (
          <AppSelect
            label={t("venture.reporting.monthly.band")}
            value={form[`${prefix}Band`] || ""}
            onChange={set(`${prefix}Band`)}
            disabled={disabled}
            options={bandOptions}
          />
        ) : (
          <AppInput
            type="number"
            min="0"
            label={t("venture.reporting.monthly.amount", { currency: getCurrencySymbol(currency) })}
            value={form[`${prefix}Value`] ?? ""}
            onChange={set(`${prefix}Value`)}
            disabled={disabled || !mode}
          />
        )}
      </div>
    </div>
  );
}

export default function VentureQuarterlyReport({ ventureId, reloadKey = 0 }) {
  const { t, lang } = useI18n();
  const [month, setMonth] = useState(currentMonthValue());
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/quarterly`;

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const result = await api(`${base}?period=${encodeURIComponent(month)}`);
    if (result.ok) {
      setDetail(result.payload);
      setForm(reportToForm(result.payload.report));
    } else if (result.status !== 401 && result.status !== 404) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
    }
    setLoading(false);
  }, [base, month, reloadKey]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

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
      body: JSON.stringify({ ...form, period: month, submit }),
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
  // The quarter's own currency stamp, else the Venture's current setting.
  const currency = detail?.currency || detail?.report?.currency || "XOF";
  const locked = open?.status === "submitted";
  const currentStatus = open?.status || validated?.status || null;

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.quarterly.title")}
        subtitle={t("venture.reporting.quarterly.subtitle")}
      />

      <AppCard padding="normal" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <AppInput
            type="month"
            label={t("venture.reporting.quarterly.period")}
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setStatus("");
            }}
          />
          <div className="flex items-end gap-2 pb-1">
            {currentStatus && (
              <AppBadge variant={STATUS_VARIANT[currentStatus] || "default"} dot>
                {t(`venture.reporting.monthly.status.${currentStatus}`)}
              </AppBadge>
            )}
            {detail?.period && (
              <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                {detail.period}
              </span>
            )}
          </div>
        </div>

        {locked && (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.quarterly.lockedNote")}
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
            {t("venture.reporting.quarterly.correctionNote")}
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
        <AppSelect
          label={t("venture.reporting.quarterly.field.teamConfirmed")}
          value={form.teamConfirmed}
          onChange={set("teamConfirmed")}
          disabled={locked}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.mvpPlanned")} value={form.mvpMilestonesPlanned} onChange={set("mvpMilestonesPlanned")} disabled={locked} />
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.mvpHit")} value={form.mvpMilestonesHit} onChange={set("mvpMilestonesHit")} disabled={locked} />
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.pilotsSigned")} value={form.pilotsSigned} onChange={set("pilotsSigned")} disabled={locked} />
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.pilotsConverted")} value={form.pilotsConverted} onChange={set("pilotsConverted")} disabled={locked} />
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.openDeals")} value={form.openDeals} onChange={set("openDeals")} disabled={locked} />
          <AppInput type="number" min="0" label={t("venture.reporting.quarterly.field.salesCycleDays")} value={form.salesCycleDays} onChange={set("salesCycleDays")} disabled={locked} />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.quarterly.field.channels")}
          </p>
          <div className="flex flex-wrap gap-3">
            {CHANNELS.map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
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

        <AppSelect
          label={t("venture.reporting.quarterly.field.top3Share")}
          value={form.top3ShareBand}
          onChange={set("top3ShareBand")}
          disabled={locked}
          options={[
            { value: "", label: t("venture.reporting.monthly.notProvided") },
            ...TOP3.map((value) => ({ value, label: t(`venture.reporting.quarterly.top3.${value}`) })),
          ]}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <MoneyRow prefix="salesMarketing" labelKey="venture.reporting.quarterly.field.salesMarketing" form={form} set={set} bands={detail?.bands} disabled={locked} t={t} lang={lang} currency={currency} />
          <MoneyRow prefix="expansion" labelKey="venture.reporting.quarterly.field.expansion" form={form} set={set} bands={detail?.bands} disabled={locked} t={t} lang={lang} currency={currency} />
          <MoneyRow prefix="churned" labelKey="venture.reporting.quarterly.field.churned" form={form} set={set} bands={detail?.bands} disabled={locked} t={t} lang={lang} currency={currency} />
        </div>

        <div className="space-y-2">
          <label htmlFor="venture-quarterly-narrative" className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.quarterly.field.narrative")}
          </label>
          <textarea
            id="venture-quarterly-narrative"
            rows={4}
            value={form.narrative}
            onChange={set("narrative")}
            disabled={locked}
            className="w-full rounded-xl py-3 px-4 text-[13px] font-medium outline-none transition-all border focus:!border-[var(--brand-orange)]"
            style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
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
          {QUARTERLY_METRICS.map((key) => (
            <div key={key} className="flex items-baseline justify-between gap-3">
              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {t(`venture.reporting.quarterly.metric.${key}`)}
              </span>
              <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                {formatMetric(t, lang, key, metrics[key], currency)}
              </span>
            </div>
          ))}
        </div>
      </AppCard>
    </div>
  );
}
