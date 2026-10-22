"use client";

import { ExternalLink } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { countryName } from "@/lib/countries";
import { ventureToForm } from "@/components/participant/ventures/ventureScreenModel";

const REGISTRATION_KEYS = {
  "Not registered": "notRegistered",
  Registered: "registered",
  "Pending registration": "pendingRegistration",
};

const SOCIALS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X" },
  { key: "facebook", label: "Facebook" },
];

/** A stored link is shown as a link only when it really is an http(s) address. */
const asHref = (value) => (/^https?:\/\//i.test(String(value || "")) ? value : null);

function Field({ label, children, wide = false }) {
  return (
    <div className={`p-3 rounded-xl bg-tertiary ${wide ? "col-span-2" : ""}`}>
      <p className="jy-lbl">{label}</p>
      <div className="mt-1 text-[14px] font-semibold text-[var(--text-primary)] whitespace-pre-line break-words">
        {children || <span className="text-[var(--text-tertiary)]">—</span>}
      </div>
    </div>
  );
}

function Link({ value }) {
  const href = asHref(value);
  if (!value) return null;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-orange)] hover:underline inline-flex items-center gap-1">
      {value} <ExternalLink className="w-3 h-3" />
    </a>
  ) : (
    value
  );
}

/**
 * The Venture's profile exactly as its founders fill it in — name, description,
 * mission, vision, industry, sector, stage, website, country, registration and
 * social links — READ-ONLY, for the people who follow the Venture without owning
 * it (Super Admin, Lead Manager). Same fields, same labels, same order as the
 * founder's form; there is no input and no save here by design.
 */
export default function VentureProfileReadOnly({ venture }) {
  const { t } = useI18n();
  if (!venture) return null;

  const form = ventureToForm(venture);
  const country = venture.country_code || venture.country ? countryName(venture.country || venture.country_code) : "";
  const registrationKey = registrationKeyFor(venture.registration_status);
  const registration = registrationKey ? t(`venture.registrationOptions.${registrationKey}`) : venture.registration_status || "";
  const stageLabel = form.business_stage ? t(`venture.stages.${form.business_stage}`) || form.business_stage : "";

  return (
    <div className="card space-y-4" data-testid="venture-profile-readonly">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t("venture.namePlaceholder")} wide>{form.name}</Field>
        <Field label={t("venture.description")} wide>{form.description}</Field>
        <Field label={t("venture.mission")}>{form.mission}</Field>
        <Field label={t("venture.vision")}>{form.vision}</Field>
        <Field label={t("venture.industry")}>{form.industry}</Field>
        <Field label={t("venture.sector")}>{form.sector}</Field>
        <Field label={t("venture.businessStage")}>{stageLabel}</Field>
        <Field label={t("venture.website")}><Link value={form.website} /></Field>
        <Field label={t("venture.country")}>{country}</Field>
        <Field label={t("venture.registrationStatus")}>{registration}</Field>
      </div>
      <div>
        <p className="jy-lbl mb-2">{t("venture.socialMedia")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOCIALS.map((social) => (
            <Field key={social.key} label={social.label}><Link value={form[social.key]} /></Field>
          ))}
        </div>
      </div>
    </div>
  );
}

function registrationKeyFor(status) {
  return REGISTRATION_KEYS[String(status || "")] || null;
}
