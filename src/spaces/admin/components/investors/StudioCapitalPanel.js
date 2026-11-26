"use client";

import { useMemo, useState } from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { useDialogs } from "@/components/ui/DialogProvider";
import AppButton from "@/components/ui/AppButton";

const pickMetrics = (payload) => (payload?.success ? payload.metrics || null : null);
const pickInputs = (payload) => (payload?.success ? payload.inputs || [] : []);
const EMPTY_INPUTS = [];
const EMPTY_FORM = {
  venture_id: "",
  studio_capital_invested: "",
  valuation: "",
  valuation_currency: "USD",
  ownership_pct: "",
  realized_proceeds: "",
  cash_distributed: "",
  exited: false,
  as_of: "",
};

const NUMERIC_FIELDS = {
  studio_capital_invested: "studioCapital",
  valuation: "valuation",
  ownership_pct: "ownership",
  realized_proceeds: "realized",
  cash_distributed: "distributed",
};

const CURRENCIES = ["USD", "EUR", "XOF", "GBP", "NGN", "ZAR", "KES", "GHS"];

function validate(form, t) {
  const errors = {};

  if (!String(form.venture_id || "").trim()) {
    errors.venture_id = t("investorAdmin.portfolio.errVentureId");
  }

  for (const [field, key] of Object.entries(NUMERIC_FIELDS)) {
    const raw = String(form[field] ?? "").trim();
    if (raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      errors[field] = t("investorAdmin.portfolio.errNumber", {
        field: t(`investorAdmin.portfolio.${key}`),
      });
    }
  }

  const ownership = String(form.ownership_pct ?? "").trim();
  if (ownership !== "" && Number(ownership) > 100) {
    errors.ownership_pct = t("investorAdmin.portfolio.errOwnership");
  }

  if (form.as_of && Number.isNaN(Date.parse(form.as_of))) {
    errors.as_of = t("investorAdmin.portfolio.errDate");
  }

  return errors;
}

function Stat({ label, value }) {
  return (
    <div className="stf-card" style={{ padding: 12, background: "var(--surface-2)" }}>
      <div className="stf-k">{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label className="stf-small" style={{ display: "block" }}>
      {label}
      {children}
      {error && (
        <span className="stf-small" style={{ display: "block", marginTop: 4, color: "var(--stf-crit)" }}>
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * Studio capital metrics (F1–F8) plus the inputs that unlock F2/F5/F6/F7.
 * Validation is inline, overwrites are confirmed, and a figure whose inputs are
 * missing shows "not captured yet" — never a fabricated zero.
 */
export default function StudioCapitalPanel() {
  const { t } = useI18n();
  const { confirm, alert } = useDialogs();
  const { data, loading, refresh } = useApi("/api/admin/investors/portfolio-metrics", {
    defaultValue: null,
    transform: pickMetrics,
  });
  const { data: inputs, refresh: refreshInputs } = useApi("/api/admin/investors/venture-capital", {
    defaultValue: EMPTY_INPUTS,
    transform: pickInputs,
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  const errors = useMemo(() => validate(form, t), [form, t]);
  const hasErrors = Object.keys(errors).length > 0;
  const existing = useMemo(
    () => new Set((inputs || []).map((row) => String(row.venture_id))),
    [inputs],
  );

  const stakePreview = useMemo(() => {
    const valuation = Number(form.valuation);
    const ownership = Number(form.ownership_pct);
    if (!Number.isFinite(valuation) || !Number.isFinite(ownership)) return null;
    if (valuation <= 0 || ownership <= 0) return null;
    return valuation * (ownership / 100);
  }, [form.valuation, form.ownership_pct]);

  const fieldError = (field) => (showErrors ? errors[field] : null);

  const set = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const reset = () => {
    setForm(EMPTY_FORM);
    setShowErrors(false);
  };

  const edit = (row) => {
    setForm({
      venture_id: row.venture_id || "",
      studio_capital_invested: row.studio_capital_invested ?? "",
      valuation: row.valuation ?? "",
      valuation_currency: row.valuation_currency || "USD",
      ownership_pct: row.ownership_pct ?? "",
      realized_proceeds: row.realized_proceeds ?? "",
      cash_distributed: row.cash_distributed ?? "",
      exited: Boolean(row.exited),
      as_of: row.as_of ? String(row.as_of).slice(0, 10) : "",
    });
    setShowErrors(false);
  };

  const save = async () => {
    setShowErrors(true);
    if (hasErrors) return;

    const ventureId = form.venture_id.trim();
    if (existing.has(ventureId)) {
      const ok = await confirm({
        message: t("investorAdmin.portfolio.confirmUpdate", { venture: ventureId }),
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/investors/venture-capital", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed");

      setForm(EMPTY_FORM);
      setShowErrors(false);
      refresh();
      refreshInputs();
      await alert({ message: t("investorAdmin.portfolio.savedToast") });
    } catch (error) {
      await alert({ message: error.message || t("investorAdmin.portfolio.saveFailed") });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[20vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
      </div>
    );
  }

  const F = data?.F || {};
  const n = (value) => (value == null ? "—" : Number(value).toLocaleString());
  const pct = (value) => (value == null ? "—" : `${Math.round(Number(value) * 100)}%`);
  const days = (value) => (value == null ? "—" : `${Number(value).toFixed(1)}d`);
  const notCaptured = t("investorAdmin.portfolio.notCaptured");

  const inputStyle = (field) => ({
    background: "var(--surface-2)",
    border: `1px solid ${fieldError(field) ? "var(--stf-crit)" : "var(--border-primary)"}`,
  });

  return (
    <section className="stf-sec">
      <div className="stf-head">
        <div>
          <h2 className="stf-title">{t("investorAdmin.portfolio.title")}</h2>
          <p className="stf-sub">{t("investorAdmin.portfolio.subtitle")}</p>
        </div>
      </div>

      <div className="stf-grid">
        <Stat label={t("investorAdmin.portfolio.financingTotal")} value={n(F.financingTotal)} />
        <Stat label={t("investorAdmin.portfolio.followOnCapital")} value={n(F.followOnCapital)} />
        <Stat label={t("investorAdmin.portfolio.medianDaysToFirstRound")} value={days(F.medianDaysToFirstRound)} />
        <Stat label={t("investorAdmin.portfolio.venturesWithFunding")} value={n(F.venturesWithFunding)} />
        <Stat label={t("investorAdmin.portfolio.platformOriginatedCapital")} value={n(F.platformOriginatedCapital)} />
        <Stat label={t("investorAdmin.portfolio.platformOriginatedShare")} value={pct(F.platformOriginatedShare)} />
        <Stat label={t("investorAdmin.portfolio.studioCapitalInvested")} value={n(F.studioCapitalInvested)} />
        <Stat label={t("investorAdmin.portfolio.outsideToStudioRatio")} value={F.outsideToStudioRatio == null ? notCaptured : n(F.outsideToStudioRatio)} />
        <Stat label={t("investorAdmin.portfolio.portfolioValuation")} value={F.portfolioValuation == null ? notCaptured : n(F.portfolioValuation)} />
        <Stat label={t("investorAdmin.portfolio.tvpi")} value={F.tvpi == null ? notCaptured : n(F.tvpi)} />
        <Stat label={t("investorAdmin.portfolio.dpi")} value={F.dpi == null ? notCaptured : n(F.dpi)} />
      </div>

      {F.financingApproximate && (
        <p className="stf-small" style={{ marginTop: 8 }}>
          {t("investorAdmin.portfolio.approximate")}
        </p>
      )}
      <p className="stf-small" style={{ marginTop: 8 }}>
        {t("investorAdmin.portfolio.note")}
      </p>

      <div className="stf-card" style={{ padding: 16, marginTop: 16 }}>
        <h3 className="stf-card-title">{t("investorAdmin.portfolio.inputsTitle")}</h3>
        <p className="stf-small" style={{ marginBottom: 12 }}>
          {t("investorAdmin.portfolio.formHint")}
        </p>

        {showErrors && hasErrors && (
          <p className="stf-small" style={{ color: "var(--stf-crit)", marginBottom: 8 }}>
            {t("investorAdmin.portfolio.fixErrors")}
          </p>
        )}

        <div
          className="stf-grid"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}
        >
          <Field
            label={t("investorAdmin.portfolio.ventureId")}
            error={fieldError("venture_id")}
          >
            <input
              value={form.venture_id}
              onChange={set("venture_id")}
              placeholder="VNT-1"
              aria-invalid={Boolean(fieldError("venture_id"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("venture_id")}
            />
          </Field>

          <Field
            label={t("investorAdmin.portfolio.studioCapital")}
            error={fieldError("studio_capital_invested")}
          >
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.studio_capital_invested}
              onChange={set("studio_capital_invested")}
              aria-invalid={Boolean(fieldError("studio_capital_invested"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("studio_capital_invested")}
            />
          </Field>

          <Field label={t("investorAdmin.portfolio.valuation")} error={fieldError("valuation")}>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.valuation}
              onChange={set("valuation")}
              aria-invalid={Boolean(fieldError("valuation"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("valuation")}
            />
          </Field>

          <Field label={t("investorAdmin.portfolio.currency")}>
            <input
              list="investor-currency-options"
              value={form.valuation_currency}
              onChange={set("valuation_currency")}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("valuation_currency")}
            />
            <datalist id="investor-currency-options">
              {CURRENCIES.map((code) => (
                <option key={code} value={code} />
              ))}
            </datalist>
          </Field>

          <Field label={t("investorAdmin.portfolio.ownership")} error={fieldError("ownership_pct")}>
            <input
              type="number"
              min="0"
              max="100"
              step="any"
              inputMode="decimal"
              value={form.ownership_pct}
              onChange={set("ownership_pct")}
              aria-invalid={Boolean(fieldError("ownership_pct"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("ownership_pct")}
            />
          </Field>

          <Field label={t("investorAdmin.portfolio.realized")} error={fieldError("realized_proceeds")}>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.realized_proceeds}
              onChange={set("realized_proceeds")}
              aria-invalid={Boolean(fieldError("realized_proceeds"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("realized_proceeds")}
            />
          </Field>

          <Field label={t("investorAdmin.portfolio.distributed")} error={fieldError("cash_distributed")}>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={form.cash_distributed}
              onChange={set("cash_distributed")}
              aria-invalid={Boolean(fieldError("cash_distributed"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("cash_distributed")}
            />
          </Field>

          <Field label={t("investorAdmin.portfolio.asOf")} error={fieldError("as_of")}>
            <input
              type="date"
              value={form.as_of}
              onChange={set("as_of")}
              aria-invalid={Boolean(fieldError("as_of"))}
              className="w-full mt-1 px-3 py-2 rounded-lg"
              style={inputStyle("as_of")}
            />
          </Field>

          <label className="stf-small" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24 }}>
            <input type="checkbox" checked={form.exited} onChange={set("exited")} />
            {t("investorAdmin.portfolio.exited")}
          </label>
        </div>

        {stakePreview != null && (
          <p className="stf-small" style={{ marginTop: 10 }}>
            {t("investorAdmin.portfolio.stakePreview")}:{" "}
            <b>{stakePreview.toLocaleString()}</b>
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <AppButton
            variant="primary"
            size="sm"
            icon={Save}
            onClick={save}
            disabled={busy || !form.venture_id.trim()}
          >
            {busy ? t("investorAdmin.portfolio.saving") : t("investorAdmin.portfolio.save")}
          </AppButton>
          <AppButton variant="secondary" size="sm" icon={RotateCcw} onClick={reset} disabled={busy}>
            {t("investorAdmin.portfolio.reset")}
          </AppButton>
        </div>

        {(inputs || []).length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="stf-small" style={{ fontWeight: 700 }}>
              {t("investorAdmin.portfolio.savedInputs")}
            </div>
            {(inputs || []).map((row) => {
              const stake =
                Number.isFinite(Number(row.valuation)) && Number.isFinite(Number(row.ownership_pct))
                  ? Number(row.valuation) * (Number(row.ownership_pct) / 100)
                  : null;
              return (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <span className="stf-small">
                    <b>{row.venture_id}</b> · capital {n(row.studio_capital_invested)} · valuation{" "}
                    {n(row.valuation)} · {n(row.ownership_pct)}% · stake{" "}
                    {stake == null ? "—" : stake.toLocaleString()}
                    {row.exited ? ` · ${t("investorAdmin.portfolio.exited")}` : ""}
                  </span>
                  <AppButton variant="secondary" size="sm" onClick={() => edit(row)}>
                    {t("investorAdmin.portfolio.edit")}
                  </AppButton>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
