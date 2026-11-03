"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import SectionHead from "@/components/ui/SectionHead";
import VentureMonthlyReport from "./VentureMonthlyReport";
import VentureQuarterlyReport from "./VentureQuarterlyReport";
import VentureEvents from "./VentureEvents";
import VentureStageCard from "./VentureStageCard";
import VentureGlossary from "./VentureGlossary";
import VentureDataDashboard from "./VentureDataDashboard";

/**
 * FOUNDER-FILLED venture reporting (Phase 1).
 *
 * The founder owns the static profile, the founder list, the team counts and
 * the baseline. The studio reads the same data; settings are studio-only and
 * are not exposed here.
 *
 * Every visible string comes from `t()`; no hardcoded copy.
 */

const TABS = ["dashboard", "profile", "founders", "team", "baseline", "monthly", "quarterly", "events", "stage", "glossary"];

const BUSINESS_MODELS = [
  { value: "subscription", labelKey: "venture.reporting.model.subscription" },
  { value: "transactional", labelKey: "venture.reporting.model.transactional" },
  { value: "marketplace", labelKey: "venture.reporting.model.marketplace" },
  { value: "services", labelKey: "venture.reporting.model.services" },
  { value: "other", labelKey: "venture.reporting.model.other" },
];

const EMPTY_PROFILE = {
  legalName: "",
  tradeName: "",
  foundingDate: "",
  registrationStatus: "",
  registrationCountry: "",
  paysTaxes: "",
  socialProtection: "",
  sector: "",
  businessModel: "",
  problemStatement: "",
  idealCustomerProfile: "",
  countriesOfOperation: "",
  northStarName: "",
  northStarDefinition: "",
  northStarUnit: "",
  reportingCurrency: "XOF",
  accountingBasis: "",
  vatIncluded: "",
};

const EMPTY_FOUNDER = {
  name: "",
  gender: "",
  dateOfBirth: "",
  role: "",
  employmentType: "",
};

function currentPeriod() {
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

const profileToForm = (profile) =>
  profile
    ? {
        legalName: profile.legalName || "",
        tradeName: profile.tradeName || "",
        foundingDate: profile.foundingDate || "",
        registrationStatus: profile.registrationStatus || "",
        registrationCountry: profile.registrationCountry || "",
        paysTaxes: profile.paysTaxes ? "yes" : "no",
        socialProtection: profile.socialProtection ? "yes" : "no",
        sector: profile.sector || "",
        businessModel: profile.businessModel || "",
        problemStatement: profile.problemStatement || "",
        idealCustomerProfile: profile.idealCustomerProfile || "",
        countriesOfOperation: (profile.countriesOfOperation || []).join(", "),
        northStarName: profile.northStarName || "",
        northStarDefinition: profile.northStarDefinition || "",
        northStarUnit: profile.northStarUnit || "",
        reportingCurrency: profile.reportingCurrency || "XOF",
        accountingBasis: profile.accountingBasis || "",
        vatIncluded: profile.vatIncluded ? "yes" : "no",
      }
    : EMPTY_PROFILE;

export default function VentureReportingScreen({ ventureId }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [founders, setFounders] = useState([]);
  const [teamPeriod, setTeamPeriod] = useState(currentPeriod());
  const [team, setTeam] = useState(null);
  const [baseline, setBaseline] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting`;

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [profileRes, foundersRes, teamRes, baselineRes] = await Promise.all([
      api(`${base}/profile`),
      api(`${base}/founders`),
      api(`${base}/team?period=${encodeURIComponent(teamPeriod)}`),
      api(`${base}/baseline`),
    ]);

    if (profileRes.ok) {
      setProfile(profileRes.payload.profile || null);
      setHistory(profileRes.payload.history || []);
      setForm(profileToForm(profileRes.payload.profile));
    } else if (profileRes.status !== 401 && profileRes.status !== 404) {
      setErrors((current) => [...current, profileRes.payload.error || "errors.somethingWrong"]);
    }
    if (foundersRes.ok) setFounders(foundersRes.payload.founders || []);
    if (teamRes.ok) setTeam(teamRes.payload.team || null);
    if (baselineRes.ok) setBaseline(baselineRes.payload.baseline || null);
    setLoading(false);
  }, [base, teamPeriod]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const setFounder = (index, key) => (event) =>
    setFounders((current) =>
      current.map((founder, i) => (i === index ? { ...founder, [key]: event.target.value } : founder)),
    );

  const saveProfile = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/profile`, {
      method: "POST",
      body: JSON.stringify({
        ...form,
        paysTaxes: form.paysTaxes === "yes",
        socialProtection: form.socialProtection === "yes",
        vatIncluded: form.vatIncluded === "yes",
        countriesOfOperation: form.countriesOfOperation
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setProfile(result.payload.profile);
    setHistory((current) => current);
    setStatus(t("venture.reporting.message.saved"));
    await load();
  };

  const saveFounders = async () => {
    setSaving(true);
    setErrors([]);
    setStatus("");
    const result = await api(`${base}/founders`, {
      method: "POST",
      body: JSON.stringify({ founders }),
    });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.payload.errors || [result.payload.error || "errors.somethingWrong"]);
      return;
    }
    setFounders(result.payload.founders || []);
    setStatus(t("venture.reporting.message.saved"));
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
  };

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
  const [supersedeReason, setSupersedeReason] = useState("");

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
  };

  const teamFields = useMemo(
    () => [
      ["womenEmployees", "womenEmployees"],
      ["menEmployees", "menEmployees"],
      ["under35Women", "under35Women"],
      ["under35Men", "under35Men"],
      ["fullTimeEmployees", "fullTimeEmployees"],
      ["partTimeEmployees", "partTimeEmployees"],
      ["partTimeDays", "partTimeDays"],
      ["fullTimeFounders", "fullTimeFounders"],
      ["partTimeFounders", "partTimeFounders"],
    ],
    [],
  );

  if (loading) {
    return <AppCard>{t("common.loading")}</AppCard>;
  }

  return (
    <div className="space-y-5">
      <SectionHead title={t("venture.reporting.title")} subtitle={t("venture.reporting.subtitle")} />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <AppButton
            key={item}
            size="sm"
            variant={tab === item ? "primary" : "secondary"}
            onClick={() => {
              setErrors([]);
              setStatus("");
              setTab(item);
            }}
          >
            {t(`venture.reporting.tab.${item}`)}
          </AppButton>
        ))}
      </div>

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

      {tab === "dashboard" && <VentureDataDashboard ventureId={ventureId} />}

      {tab === "profile" && (
        <AppCard padding="normal" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AppInput label={t("venture.reporting.field.legalName")} value={form.legalName} onChange={set("legalName")} />
            <AppInput label={t("venture.reporting.field.tradeName")} value={form.tradeName} onChange={set("tradeName")} />
            <AppInput type="date" label={t("venture.reporting.field.foundingDate")} value={form.foundingDate} onChange={set("foundingDate")} />
            <AppInput label={t("venture.reporting.field.registrationStatus")} value={form.registrationStatus} onChange={set("registrationStatus")} />
            <AppInput label={t("venture.reporting.field.registrationCountry")} value={form.registrationCountry} onChange={set("registrationCountry")} />
            <AppInput label={t("venture.reporting.field.sector")} value={form.sector} onChange={set("sector")} />
            <AppSelect
              label={t("venture.reporting.field.businessModel")}
              value={form.businessModel}
              onChange={set("businessModel")}
              options={BUSINESS_MODELS.map((item) => ({ value: item.value, label: t(item.labelKey) }))}
            />
            <AppSelect
              label={t("venture.reporting.field.paysTaxes")}
              value={form.paysTaxes}
              onChange={set("paysTaxes")}
              options={[
                { value: "yes", label: t("common.yes") },
                { value: "no", label: t("common.no") },
              ]}
            />
            <AppSelect
              label={t("venture.reporting.field.socialProtection")}
              value={form.socialProtection}
              onChange={set("socialProtection")}
              options={[
                { value: "yes", label: t("common.yes") },
                { value: "no", label: t("common.no") },
              ]}
            />
            <AppInput label={t("venture.reporting.field.countries")} value={form.countriesOfOperation} onChange={set("countriesOfOperation")} />
            <AppInput label={t("venture.reporting.field.currency")} value={form.reportingCurrency} onChange={set("reportingCurrency")} />
            <AppSelect
              label={t("venture.reporting.field.accountingBasis")}
              value={form.accountingBasis}
              onChange={set("accountingBasis")}
              options={[
                { value: "cash", label: t("venture.reporting.accounting.cash") },
                { value: "accrual", label: t("venture.reporting.accounting.accrual") },
              ]}
            />
            <AppSelect
              label={t("venture.reporting.field.vatIncluded")}
              value={form.vatIncluded}
              onChange={set("vatIncluded")}
              options={[
                { value: "yes", label: t("common.yes") },
                { value: "no", label: t("common.no") },
              ]}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AppInput label={t("venture.reporting.field.northStarName")} value={form.northStarName} onChange={set("northStarName")} />
            <AppInput label={t("venture.reporting.field.northStarUnit")} value={form.northStarUnit} onChange={set("northStarUnit")} />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.field.northStarDefinition")}
            </label>
            <textarea
              value={form.northStarDefinition}
              onChange={set("northStarDefinition")}
              rows={2}
              className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.field.problemStatement")}
            </label>
            <textarea
              value={form.problemStatement}
              onChange={set("problemStatement")}
              rows={3}
              className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("venture.reporting.field.icp")}
            </label>
            <textarea
              value={form.idealCustomerProfile}
              onChange={set("idealCustomerProfile")}
              rows={3}
              className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {profile
                ? `${t("venture.reporting.version.current")}: v${profile.version}`
                : t("venture.reporting.version.none")}
            </p>
            <AppButton onClick={saveProfile} disabled={saving}>
              {profile ? t("venture.reporting.action.newVersion") : t("venture.reporting.action.save")}
            </AppButton>
          </div>

          {history.length > 0 && (
            <div className="space-y-1 border-t pt-3" style={{ borderColor: "var(--border-primary)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.version.history")}
              </p>
              {history.map((entry) => (
                <p key={entry.version} className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  v{entry.version} — {entry.is_current ? t("venture.reporting.version.current") : t("venture.reporting.version.superseded")}
                  {entry.superseded_reason ? ` · ${entry.superseded_reason}` : ""}
                </p>
              ))}
            </div>
          )}
        </AppCard>
      )}

      {tab === "founders" && (
        <AppCard padding="normal" className="space-y-4">
          <div className="space-y-4">
            {founders.map((founder, index) => (
              <div key={index} className="grid gap-3 rounded-xl border p-3 md:grid-cols-5" style={{ borderColor: "var(--border-primary)" }}>
                <AppInput label={t("venture.reporting.founder.name")} value={founder.name || ""} onChange={setFounder(index, "name")} />
                <AppSelect
                  label={t("venture.reporting.founder.gender")}
                  value={founder.gender || ""}
                  onChange={setFounder(index, "gender")}
                  options={[
                    { value: "female", label: t("venture.reporting.gender.female") },
                    { value: "male", label: t("venture.reporting.gender.male") },
                    { value: "other", label: t("venture.reporting.gender.other") },
                    { value: "undisclosed", label: t("venture.reporting.gender.undisclosed") },
                  ]}
                />
                <AppInput type="date" label={t("venture.reporting.founder.dateOfBirth")} value={founder.dateOfBirth || ""} onChange={setFounder(index, "dateOfBirth")} />
                <AppInput label={t("venture.reporting.founder.role")} value={founder.role || ""} onChange={setFounder(index, "role")} />
                <AppSelect
                  label={t("venture.reporting.founder.employment")}
                  value={founder.employmentType || ""}
                  onChange={setFounder(index, "employmentType")}
                  options={[
                    { value: "full_time", label: t("venture.reporting.employment.fullTime") },
                    { value: "part_time", label: t("venture.reporting.employment.partTime") },
                  ]}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <AppButton variant="secondary" onClick={() => setFounders((current) => [...current, { ...EMPTY_FOUNDER }])}>
              {t("venture.reporting.founder.add")}
            </AppButton>
            <AppButton onClick={saveFounders} disabled={saving}>
              {t("venture.reporting.action.save")}
            </AppButton>
          </div>
        </AppCard>
      )}

      {tab === "team" && (
        <AppCard padding="normal" className="space-y-4">
          <AppInput
            type="month"
            label={t("venture.reporting.team.period")}
            value={teamPeriod}
            onChange={(event) => setTeamPeriod(event.target.value)}
          />
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
            <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>
                {t("venture.reporting.team.womenShare")}:{" "}
                {team.shares.womenShare === null ? t("venture.reporting.notApplicable") : `${team.shares.womenShare}%`}
              </span>
              <span>
                {t("venture.reporting.team.youthShare")}:{" "}
                {team.shares.youthShare === null ? t("venture.reporting.notApplicable") : `${team.shares.youthShare}%`}
              </span>
            </div>
          )}
          <AppButton onClick={saveTeam} disabled={saving}>
            {t("venture.reporting.action.save")}
          </AppButton>
        </AppCard>
      )}

      {tab === "monthly" && <VentureMonthlyReport ventureId={ventureId} />}

      {tab === "quarterly" && <VentureQuarterlyReport ventureId={ventureId} />}

      {tab === "events" && <VentureEvents ventureId={ventureId} />}

      {tab === "stage" && <VentureStageCard ventureId={ventureId} />}

      {tab === "glossary" && <VentureGlossary ventureId={ventureId} />}

      {tab === "baseline" && (
        <AppCard padding="normal" className="space-y-4">
          {baseline ? (
            <>
              <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                {t("venture.reporting.baseline.locked")}
              </p>
              <div className="grid gap-3 md:grid-cols-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                <span>{t("venture.reporting.baseline.fte")}: {baseline.fte ?? "—"}</span>
                <span>{t("venture.reporting.baseline.payingCustomers")}: {baseline.payingCustomers ?? "—"}</span>
                <span>{t("venture.reporting.baseline.cash")}: {baseline.cashMode === "band" ? baseline.cashBand : baseline.cashValue ?? "—"}</span>
                <span>{t("venture.reporting.baseline.outsideFinancing")}: {baseline.outsideFinancingMode === "band" ? baseline.outsideFinancingBand : baseline.outsideFinancingValue ?? "—"}</span>
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
                  <AppInput type="number" label={t("venture.reporting.baseline.cash")} value={baselineForm.cashValue} onChange={(event) => setBaselineForm((c) => ({ ...c, cashValue: event.target.value }))} />
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
                  <AppInput type="number" label={t("venture.reporting.baseline.outsideFinancing")} value={baselineForm.outsideFinancingValue} onChange={(event) => setBaselineForm((c) => ({ ...c, outsideFinancingValue: event.target.value }))} />
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
      )}
    </div>
  );
}
