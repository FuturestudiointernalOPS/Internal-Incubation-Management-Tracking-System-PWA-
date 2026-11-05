"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import CountrySelect from "@/components/ventures/CountrySelect";
import { STANDARD_CURRENCIES } from "@/lib/currencies";

/** Matches the inputs around it, for the country picker's own chrome. */
const INPUT_STYLE = {
  background: "var(--surface-1)",
  borderColor: "var(--border-primary)",
  color: "var(--text-primary)",
};

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

/**
 * The profile row → the form.
 *
 * `legalName` is AUTOMATED: a stored value always wins, but an empty profile (or
 * a profile that never answered it) is seeded with the Venture's own name — most
 * Ventures are registered under the name they go by. It stays editable, because
 * the registered form ("… SARL", "… Ltd") is the founder's to correct.
 */
const profileToForm = (profile, ventureName = "") =>
  profile
    ? {
        legalName: profile.legalName || ventureName || "",
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
    : { ...EMPTY_PROFILE, legalName: ventureName || "" };

/**
 * `registerSave` lets the PROFILE PAGE's single Save button drive this section.
 * The section owns its own draft and its own endpoint; it hands the caller a
 * function instead of rendering a second button, so "Save" on the profile page
 * means everything on the page — not one section at a time.
 */
export default function VentureBusinessProfileSection({ ventureId, registerSave }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [status, setStatus] = useState("");
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(EMPTY_PROFILE);
  // What is already stored, so an untouched section does not create a new
  // version every time the page's Save is pressed.
  const [baseline, setBaseline] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/profile`;

  const load = useCallback(async () => {
    if (!ventureId) return;
    setLoading(true);
    setErrors([]);
    try {
      const res = await fetch(base);
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setProfile(payload.profile || null);
        setHistory(payload.history || []);
        const nextForm = profileToForm(payload.profile, payload.venture_name || "");
        setForm(nextForm);
        setBaseline(JSON.stringify(nextForm));
      }
    } catch {
      // silent fallback
    } finally {
      setLoading(false);
    }
  }, [base, ventureId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const saveProfile = async () => {
    // Nothing typed here since the last save → nothing to write. This is what
    // keeps the page's Save from minting a new profile version on every click.
    // `baseline === null` means the section has not finished loading (or the
    // read failed): saving an empty form over a stored profile would be worse
    // than not saving at all.
    if (baseline === null) return { skipped: true };
    if (JSON.stringify(form) === baseline) return { skipped: true };
    setSaving(true);
    setErrors([]);
    setStatus("");
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(payload.errors || [payload.error || "errors.somethingWrong"]);
        return { ok: false };
      }
      setProfile(payload.profile);
      setStatus(t("venture.reporting.message.saved"));
      setBaseline(JSON.stringify(form));
      await load();
      return { ok: true };
    } catch {
      setErrors(["errors.somethingWrong"]);
      return { ok: false };
    } finally {
      setSaving(false);
    }
  };

  // Hand the CURRENT saver up after every render, so the page's Save always
  // calls the closure holding the latest draft.
  useEffect(() => {
    if (registerSave) registerSave(saveProfile);
  });

  if (loading) return null;

  return (
    <div className="rounded-xl p-6 space-y-6 border bg-[var(--surface-1)]" style={{ borderColor: "var(--border-primary)" }}>
      <div>
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--brand-orange)]">
          Business & Legal Identity
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Detailed business model, legal registration status, and north-star definition used in portfolio reporting.
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 text-xs text-rose-500">
          {errors.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}
      {status && <p className="text-xs font-bold text-emerald-600">{status}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <AppInput label={t("venture.reporting.field.legalName")} value={form.legalName} onChange={set("legalName")} />
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("venture.reporting.field.legalNameHint")}
          </p>
        </div>
        <AppInput label={t("venture.reporting.field.tradeName")} value={form.tradeName} onChange={set("tradeName")} />
        <AppInput type="date" label={t("venture.reporting.field.foundingDate")} value={form.foundingDate} onChange={set("foundingDate")} />
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {t("venture.reporting.field.registrationCountry")}
          </label>
          <CountrySelect
            value={form.registrationCountry}
            inputStyle={INPUT_STYLE}
            onSelect={(code, name) =>
              setForm((current) => ({ ...current, registrationCountry: code || name || "" }))
            }
          />
        </div>
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
          hint={t("venture.reporting.hint.socialProtection")}
          value={form.socialProtection}
          onChange={set("socialProtection")}
          options={[
            { value: "yes", label: t("common.yes") },
            { value: "no", label: t("common.no") },
          ]}
        />
        <AppSelect
          label={t("venture.reporting.field.accountingBasis")}
          hint={t("venture.reporting.hint.accountingBasis")}
          value={form.accountingBasis}
          onChange={set("accountingBasis")}
          options={[
            { value: "cash", label: t("venture.reporting.accounting.cash") },
            { value: "accrual", label: t("venture.reporting.accounting.accrual") },
          ]}
        />
        <AppSelect
          label={t("venture.reporting.field.currency")}
          value={form.reportingCurrency || "XOF"}
          onChange={set("reportingCurrency")}
          options={STANDARD_CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
        />
        <AppInput label={t("venture.reporting.field.countries")} value={form.countriesOfOperation} onChange={set("countriesOfOperation")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-[var(--border-primary)]">
        <AppInput
          label={t("venture.reporting.field.northStarName")}
          hint={t("venture.reporting.hint.northStarName")}
          value={form.northStarName}
          onChange={set("northStarName")}
        />
        <AppInput label={t("venture.reporting.field.northStarUnit")} value={form.northStarUnit} onChange={set("northStarUnit")} />
      </div>
      <div>
        <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.field.problemStatement")}
        </label>
        <textarea
          value={form.problemStatement}
          onChange={set("problemStatement")}
          rows={2}
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
          rows={2}
          className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-primary)" }}
        />
      </div>

      <div className="flex items-center justify-between gap-4 pt-3 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {profile
            ? `${t("venture.reporting.version.current")}: v${profile.version}`
            : t("venture.reporting.version.none")}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {saving ? t("venture.saving") : ""}
        </p>
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
    </div>
  );
}
