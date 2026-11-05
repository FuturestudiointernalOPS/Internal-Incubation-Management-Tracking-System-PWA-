"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import SectionHead from "@/components/ui/SectionHead";
import InfoHint from "@/components/ui/InfoHint";
import { formatCurrencyAmount, getCurrencySymbol } from "@/lib/currencies";
// Pure rules module (no database, no HTTP) — the ONE FTE formula, shared with
// the monthly metrics and the stage rules, so the tab cannot drift from them.
import { snapshotFte } from "@/services/ventures/reporting/rules";

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

/** An untouched input is "not reported", not a zero. */
function numOrNull(value) {
  return value === "" || value === null || value === undefined ? null : value;
}

const fteText = (value) =>
  value === null || value === undefined ? "—" : String(Math.round(Number(value) * 100) / 100);

/**
 * A baseline is captured with AMOUNTS. The range mode was withdrawn (Phase 4);
 * an amount that is not filled stays unanswered instead of becoming a band.
 */
function exactBaseline(form) {
  return {
    ...form,
    cashMode: "exact",
    cashBand: "",
    outsideFinancingMode: "exact",
    outsideFinancingBand: "",
  };
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
      // Exact only: the range mode was withdrawn (Phase 4).
      body: JSON.stringify(exactBaseline(baselineForm)),
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
      body: JSON.stringify({ reason: supersedeReason, baseline: exactBaseline(baselineForm) }),
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

  // FTE belongs to the WORKFORCE, not to the money grid: it is produced by the
  // team figures below and stored once, with the baseline.
  const workforceFte = snapshotFte({
    fullTime: numOrNull(team?.fullTimeEmployees),
    partTimeDays: numOrNull(team?.partTimeDays),
    fullTimeFounders: numOrNull(team?.fullTimeFounders),
  });
  const shownFte = baseline ? baseline.fte : workforceFte;

  return (
    <div className="space-y-6">
      <SectionHead
        title={t("venture.baseline") || "Venture Baseline"}
        subtitle={t("venture.reporting.baseline.subtitle")}
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

      {/* ── Section 1: money and customers — the financial starting line ── */}
      <AppCard padding="normal" className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[var(--brand-orange)]">
          {t("venture.reporting.baseline.sectionPositionTitle")}
          <InfoHint
            label={t("venture.reporting.hint.sectionFinancial")}
            text={t("venture.reporting.hint.sectionFinancial")}
          />
        </h3>
        {baseline ? (
          <>
            <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {t("venture.reporting.baseline.locked")}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {t("venture.reporting.baseline.lockedNote")}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>{t("venture.reporting.baseline.payingCustomers")}: <strong className="text-[var(--text-primary)]">{baseline.payingCustomers ?? "—"}</strong></span>
              <span>{t("venture.reporting.baseline.cash", { currency: currencySymbol })}: <strong className="text-[var(--text-primary)]">{cashText}</strong></span>
              <span>{t("venture.reporting.baseline.outsideFinancing", { currency: currencySymbol })}: <strong className="text-[var(--text-primary)]">{financingText}</strong></span>
            </div>
            <div className="border-t pt-3 space-y-3" style={{ borderColor: "var(--border-primary)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.baseline.supersedeTitle")}
              </p>
              <AppInput
                label={t("venture.reporting.baseline.reason")}
                hint={t("venture.reporting.hint.baselineSupersedeReason")}
                value={supersedeReason}
                onChange={(event) => setSupersedeReason(event.target.value)}
              />
              <AppButton variant="danger" onClick={supersedeBaseline} disabled={saving}>
                {t("venture.reporting.action.supersede")}
              </AppButton>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <AppInput
                type="number"
                label={t("venture.reporting.baseline.payingCustomers")}
                hint={t("venture.reporting.hint.baselinePayingCustomers")}
                value={baselineForm.payingCustomers}
                onChange={(event) => setBaselineForm((c) => ({ ...c, payingCustomers: event.target.value }))}
              />
              {/* Exact only: ranges were withdrawn from new captures (Phase 4). */}
              <AppInput
                type="number"
                label={t("venture.reporting.baseline.cash", { currency: getCurrencySymbol(currentCurrency) })}
                hint={t("venture.reporting.hint.baselineCash")}
                value={baselineForm.cashValue}
                onChange={(event) => setBaselineForm((c) => ({ ...c, cashValue: event.target.value }))}
              />
              {baselineForm.cashMode === "band" && baselineForm.cashBand ? (
                <p className="text-[11px] md:col-span-2" style={{ color: "var(--text-tertiary)" }}>
                  {t("venture.reporting.monthly.legacyBand", { band: baselineForm.cashBand })}
                </p>
              ) : null}
              <AppInput
                type="number"
                label={t("venture.reporting.baseline.outsideFinancing", { currency: getCurrencySymbol(currentCurrency) })}
                hint={t("venture.reporting.hint.baselineFinancing")}
                value={baselineForm.outsideFinancingValue}
                onChange={(event) => setBaselineForm((c) => ({ ...c, outsideFinancingValue: event.target.value }))}
              />
              {baselineForm.outsideFinancingMode === "band" && baselineForm.outsideFinancingBand ? (
                <p className="text-[11px] md:col-span-2" style={{ color: "var(--text-tertiary)" }}>
                  {t("venture.reporting.monthly.legacyBand", { band: baselineForm.outsideFinancingBand })}
                </p>
              ) : null}
            </div>
            <AppButton onClick={captureBaseline} disabled={saving}>
              {t("venture.reporting.baseline.capture")}
            </AppButton>
          </>
        )}
      </AppCard>

      {/* ── Section 2: the workforce, and the FTE it produces ── */}
      <AppCard padding="normal" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[var(--brand-orange)]">
            {t("venture.reporting.baseline.sectionWorkforceTitle")}
            <InfoHint
              label={t("venture.reporting.hint.sectionWorkforce")}
              text={t("venture.reporting.hint.sectionWorkforce")}
            />
          </h3>
          <span className="text-[11px] text-[var(--text-secondary)]">
            {t("venture.reporting.baseline.period")}: {teamPeriod}
          </span>
        </div>

        {/* The FTE is read, never typed: it is the workforce figures below, run
            through the one shared formula. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 p-3 rounded-lg bg-[var(--surface-2)] text-xs">
          <span className="font-bold text-[var(--text-primary)]">
            {t("venture.reporting.baseline.fte")}: {fteText(shownFte)}
          </span>
          <InfoHint
            label={t("venture.reporting.hint.baselineFte")}
            text={t("venture.reporting.hint.baselineFte")}
          />
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {baseline
              ? baseline.fte === null || baseline.fte === undefined
                ? t("venture.reporting.baseline.fteMissing")
                : t("venture.reporting.baseline.fteCaptured")
              : t("venture.reporting.baseline.fteComputed")}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {teamFields.map(([key]) => (
            <AppInput
              key={key}
              type="number"
              label={t(`venture.reporting.team.${key}`)}
              hint={t(`venture.reporting.hint.${key}`)}
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
            {t("venture.reporting.baseline.saveWorkforce")}
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
}
