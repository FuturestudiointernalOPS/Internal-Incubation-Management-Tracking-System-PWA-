"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import SectionHead from "@/components/ui/SectionHead";
import { formatCurrencyAmount, getCurrencySymbol } from "@/lib/currencies";

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

export default function VentureBaselineTab({ ventureId }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");

  const [baseline, setBaseline] = useState(null);
  const [supersedeReason, setSupersedeReason] = useState("");
  const [baselineForm, setBaselineForm] = useState({
    fte: "",
    payingCustomers: "",
    cashMode: "exact",
    cashValue: "",
    cashBand: "",
    outsideFinancingMode: "exact",
    outsideFinancingValue: "",
    outsideFinancingBand: "",
  });

  // Starting Headcount Breakdown
  const [teamPeriod, setTeamPeriod] = useState(currentPeriod());
  const [team, setTeam] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting`;

  // The Venture's CURRENT reporting currency: the unit the new baseline is
  // entered in, and the fallback for one captured before it was stamped.
  const [currentCurrency, setCurrentCurrency] = useState("XOF");

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [baselineRes, teamRes, profileRes] = await Promise.all([
      api(`${base}/baseline`),
      api(`${base}/team?period=${encodeURIComponent(teamPeriod)}`),
      api(`${base}/profile`),
    ]);

    if (baselineRes.ok) setBaseline(baselineRes.payload.baseline || null);
    if (teamRes.ok) setTeam(teamRes.payload.team || null);
    if (profileRes.ok) setCurrentCurrency(profileRes.payload.profile?.reportingCurrency || "XOF");
    setLoading(false);
  }, [base, teamPeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const captureBaseline = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/baseline`, {
      method: "POST",
      body: JSON.stringify(baselineForm),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setBaseline(result.payload.baseline);
    setStatus(t("venture.reporting.message.saved"));
    await load();
  };

  const supersedeBaseline = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/baseline`, {
      method: "PUT",
      body: JSON.stringify({ reason: supersedeReason, baseline: baselineForm }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setBaseline(result.payload.baseline);
    setSupersedeReason("");
    setStatus(t("venture.reporting.message.superseded"));
    await load();
  };

  const saveTeam = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/team`, {
      method: "POST",
      body: JSON.stringify({ period: teamPeriod, ...(team || {}) }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setTeam(result.payload.team);
    setStatus(t("venture.reporting.message.saved"));
  };

  const teamFields = [
    ["fullTimeFounders", "fullTimeFounders"],
    ["partTimeFounders", "partTimeFounders"],
    ["fullTimeEmployees", "fullTimeEmployees"],
    ["partTimeEmployees", "partTimeEmployees"],
    ["partTimeDays", "partTimeDays"],
    ["womenEmployees", "womenEmployees"],
    ["menEmployees", "menEmployees"],
    ["under35Women", "under35Women"],
    ["under35Men", "under35Men"],
  ];

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  // The baseline's OWN currency when it has one, else the current setting.
  const baselineCurrency = baseline?.currency || currentCurrency;
  const currencySymbol = getCurrencySymbol(baselineCurrency);
  const cashText = baseline
    ? baseline.cashMode === "band"
      ? baseline.cashBand
      : baseline.cashValue != null
        ? formatCurrencyAmount(baseline.cashValue, baselineCurrency)
        : "—"
    : "—";
  const financingText = baseline
    ? baseline.outsideFinancingMode === "band"
      ? baseline.outsideFinancingBand
      : baseline.outsideFinancingValue != null
        ? formatCurrencyAmount(baseline.outsideFinancingValue, baselineCurrency)
        : "—"
    : "—";

  return (
    <div className="space-y-6">
      <SectionHead
        title={t("venture.baseline") || "Baseline"}
        subtitle="The historical starting line of the venture: initial finances, customer traction and genesis workforce."
      />

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

      {/* ── Section 1: Initial Business & Financial Position ── */}
      <AppCard padding="normal" className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-orange)]">
          1. Initial Financial & Traction Position
        </h3>
        {baseline ? (
          <>
            <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {t("venture.reporting.baseline.locked")}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                This initial baseline is locked as the historical reference for growth and job creation calculations.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>{t("venture.reporting.baseline.fte")}: <strong className="text-[var(--text-primary)]">{baseline.fte ?? "—"}</strong></span>
              <span>{t("venture.reporting.baseline.payingCustomers")}: <strong className="text-[var(--text-primary)]">{baseline.payingCustomers ?? "—"}</strong></span>
              <span>{t("venture.reporting.baseline.cash", { currency: currencySymbol })}: <strong className="text-[var(--text-primary)]">{cashText}</strong></span>
              <span>{t("venture.reporting.baseline.outsideFinancing", { currency: currencySymbol })}: <strong className="text-[var(--text-primary)]">{financingText}</strong></span>
            </div>
            <div className="border-t pt-3 space-y-3" style={{ borderColor: "var(--border-primary)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.baseline.supersedeTitle")}
              </p>
              <AppInput label={t("venture.reporting.baseline.reason")} value={supersedeReason} onChange={(event) => setSupersedeReason(event.target.value)} />
              <AppButton variant="danger" onClick={supersedeBaseline} disabled={saving}>
                {t("venture.reporting.action.supersede")}
              </AppButton>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <AppInput type="number" label={t("venture.reporting.baseline.fte")} value={baselineForm.fte} onChange={(event) => setBaselineForm((c) => ({ ...c, fte: event.target.value }))} />
              <AppInput type="number" label={t("venture.reporting.baseline.payingCustomers")} value={baselineForm.payingCustomers} onChange={(event) => setBaselineForm((c) => ({ ...c, payingCustomers: event.target.value }))} />
              <AppSelect
                label={t("venture.reporting.baseline.cashMode")}
                value={baselineForm.cashMode}
                onChange={(event) => setBaselineForm((c) => ({ ...c, cashMode: event.target.value }))}
                options={[
                  { value: "exact", label: t("venture.reporting.mode.exact") },
                  { value: "band", label: t("venture.reporting.mode.band") },
                ]}
              />
              {baselineForm.cashMode === "exact" ? (
                <AppInput type="number" label={t("venture.reporting.baseline.cash", { currency: getCurrencySymbol(currentCurrency) })} value={baselineForm.cashValue} onChange={(event) => setBaselineForm((c) => ({ ...c, cashValue: event.target.value }))} />
              ) : (
                <AppInput label={t("venture.reporting.baseline.cashBand")} value={baselineForm.cashBand} onChange={(event) => setBaselineForm((c) => ({ ...c, cashBand: event.target.value }))} />
              )}
              <AppSelect
                label={t("venture.reporting.baseline.financingMode")}
                value={baselineForm.outsideFinancingMode}
                onChange={(event) => setBaselineForm((c) => ({ ...c, outsideFinancingMode: event.target.value }))}
                options={[
                  { value: "exact", label: t("venture.reporting.mode.exact") },
                  { value: "band", label: t("venture.reporting.mode.band") },
                ]}
              />
              {baselineForm.outsideFinancingMode === "exact" ? (
                <AppInput type="number" label={t("venture.reporting.baseline.outsideFinancing", { currency: getCurrencySymbol(currentCurrency) })} value={baselineForm.outsideFinancingValue} onChange={(event) => setBaselineForm((c) => ({ ...c, outsideFinancingValue: event.target.value }))} />
              ) : (
                <AppInput label={t("venture.reporting.baseline.outsideFinancingBand")} value={baselineForm.outsideFinancingBand} onChange={(event) => setBaselineForm((c) => ({ ...c, outsideFinancingBand: event.target.value }))} />
              )}
            </div>
            <AppButton onClick={captureBaseline} disabled={saving}>
              {t("venture.reporting.baseline.capture")}
            </AppButton>
          </>
        )}
      </AppCard>

      {/* ── Section 2: Genesis Headcount & Demographic Breakdown ── */}
      <AppCard padding="normal" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-[var(--brand-orange)]">
            2. Starting Workforce & Demographic Indicators
          </h3>
          <span className="text-[11px] text-[var(--text-secondary)]">
            Period: {teamPeriod}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {teamFields.map(([key]) => (
            <AppInput
              key={key}
              type="number"
              label={t(`venture.reporting.team.${key}`)}
              value={team?.[key] ?? ""}
              onChange={(event) => setTeam((current) => ({ ...(current || {}), [key]: event.target.value }))}
            />
          ))}
        </div>
        {team?.shares && (
          <div className="flex flex-wrap gap-4 text-xs p-3 rounded-lg bg-[var(--surface-2)]" style={{ color: "var(--text-secondary)" }}>
            <span>
              {t("venture.reporting.team.womenShare")}:{" "}
              <strong className="text-[var(--text-primary)]">
                {team.shares.womenShare === null ? t("venture.reporting.notApplicable") : `${team.shares.womenShare}%`}
              </strong>
            </span>
            <span>
              {t("venture.reporting.team.youthShare")}:{" "}
              <strong className="text-[var(--text-primary)]">
                {team.shares.youthShare === null ? t("venture.reporting.notApplicable") : `${team.shares.youthShare}%`}
              </strong>
            </span>
          </div>
        )}
        <div className="flex justify-end">
          <AppButton onClick={saveTeam} disabled={saving}>
            {t("common.save")} Workforce Snapshot
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
}
