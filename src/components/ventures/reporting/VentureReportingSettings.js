"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppInput from "@/components/ui/AppInput";
import AppSelect from "@/components/ui/AppSelect";
import AppButton from "@/components/ui/AppButton";
import SectionHead from "@/components/ui/SectionHead";

/**
 * STUDIO — the reporting configuration (spec §4.5 and §11).
 *
 * One screen for every number the engine reads: stage thresholds, the
 * traffic-light bands, and WHEN a report is due.
 *
 * `default` is the single global baseline every venture uses. A BUSINESS MODEL
 * may override any key; anything it does not override keeps inheriting the
 * baseline, so changing a default later still reaches every model that never
 * asked for its own number. That distinction — override vs inherited — is the
 * whole design of this screen.
 *
 * The fields are rendered FROM the server's `definitions`, so adding a
 * threshold never means editing this file.
 */

const MINUTE_SUFFIX = "_minute";

const minutesToTime = (minutes) => {
  const value = Number(minutes);
  if (!Number.isFinite(value)) return "";
  const hours = Math.floor(value / 60) % 24;
  const mins = Math.abs(value % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const timeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  return Number(match[1]) * 60 + Number(match[2]);
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

export default function VentureReportingSettings() {
  const { t } = useI18n();
  const [payload, setPayload] = useState(null);
  const [model, setModel] = useState("default");
  const [values, setValues] = useState({});
  const [glossary, setGlossary] = useState([]);
  const [clear, setClear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await api("/api/reporting/settings");
    if (result.ok) setPayload(result.payload);
    else setErrors([result.payload.error || "errors.insufficientPermissions"]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Switching model loads that model's own overrides — never the baseline,
  // otherwise saving would silently copy every default into an override.
  useEffect(() => {
    if (!payload) return;
    setValues(
      model === "default" ? { ...(payload.defaults || {}) } : { ...(payload.overrides?.[model] || {}) },
    );
    setClear([]);
    setSaved(false);
  }, [payload, model]);

  // The glossary is GLOBAL, so it is loaded once and never re-loaded when the
  // business model changes.
  useEffect(() => {
    if (!payload?.glossary) return;
    setGlossary(payload.glossary.map((entry) => ({ ...entry })));
  }, [payload]);

  const defaults = payload?.defaults || {};
  // Only a Super Admin may change the shared vocabulary; everyone else reads it.
  const canEditGlossary = payload?.canEditGlossary === true;

  const groups = useMemo(() => {
    // The server sends the groups; the screen never assembles a key list.
    return (payload?.groups || [])
      .map((group) => ({
        key: group.key,
        title: t(group.labelKey),
        items: group.items || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [payload, t]);

  const isOverridden = (key) => values[key] !== undefined && values[key] !== "";

  // Not `useDefault`: a `use*` name is treated as a React hook by lint, and
  // this is a plain event handler.
  const inheritFromDefault = (key) => {
    setValues((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setClear((current) => (current.includes(key) ? current : [...current, key]));
  };

  const save = async () => {
    setSaving(true);
    setErrors([]);
    setSaved(false);
    const result = await api("/api/reporting/settings", {
      method: "PUT",
      body: JSON.stringify({
        businessModel: model,
        settings: values,
        clear,
        glossary: canEditGlossary ? glossary : [],
      }),
    });
    setSaving(false);
    if (!result.ok) {
      const list = result.payload.errors;
      setErrors(
        Array.isArray(list) ? list.map((entry) => entry.error || entry) : ["errors.somethingWrong"],
      );
      return;
    }
    setPayload((current) => ({ ...current, ...result.payload }));
    setSaved(true);
  };

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.settings.title")}
        subtitle={t("venture.reporting.settings.subtitle")}
      />

      {errors.length > 0 && (
        <AppCard padding="normal">
          <ul className="space-y-1 text-xs text-rose-500">
            {errors.map((key, index) => (
              <li key={`${key}-${index}`}>{t(key)}</li>
            ))}
          </ul>
        </AppCard>
      )}
      {saved && (
        <p className="text-xs font-bold text-emerald-600">{t("venture.reporting.settings.saved")}</p>
      )}

      <AppCard padding="normal" className="space-y-3">
        <AppSelect
          label={t("venture.reporting.settings.businessModel")}
          value={model}
          onChange={(event) => {
            setErrors([]);
            setModel(event.target.value);
          }}
          options={(payload?.businessModels || ["default"]).map((value) => ({
            value,
            label:
              value === "default"
                ? t("venture.reporting.settings.modelDefault")
                : t(`venture.reporting.model.${value}`),
          }))}
        />
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {model === "default"
            ? t("venture.reporting.settings.defaultHint")
            : t("venture.reporting.settings.overrideHint")}
        </p>
      </AppCard>

      {groups.map((group) => (
        <AppCard key={group.key} padding="normal" className="space-y-4">
          <p
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {group.title}
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((definition) => {
              const isTime = definition.key.endsWith(MINUTE_SUFFIX);
              const current = values[definition.key];
              const inherited = defaults[definition.key];
              // The same value is a number on the wire and a clock in the form.
              const show = (value) =>
                value === undefined || value === null || value === ""
                  ? ""
                  : isTime
                    ? minutesToTime(value)
                    : String(value);
              return (
                <div key={definition.key} className="space-y-1">
                  <AppInput
                    type={isTime ? "time" : "number"}
                    label={t(definition.labelKey)}
                    placeholder={model === "default" ? "" : show(inherited)}
                    value={show(current)}
                    onChange={(event) =>
                      setValues((state) => ({
                        ...state,
                        [definition.key]: isTime
                          ? timeToMinutes(event.target.value)
                          : event.target.value,
                      }))
                    }
                  />
                  {model !== "default" && (
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span style={{ color: "var(--text-tertiary)" }}>
                        {isOverridden(definition.key)
                          ? t("venture.reporting.settings.overridden")
                          : `${t("venture.reporting.settings.inherited")}: ${show(inherited) || "—"}`}
                      </span>
                      {isOverridden(definition.key) && (
                        <button
                          type="button"
                          className="stf-link-btn"
                          onClick={() => inheritFromDefault(definition.key)}
                        >
                          {t("venture.reporting.settings.inherit")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </AppCard>
      ))}

      <AppCard padding="normal" className="space-y-4">
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("venture.reporting.settings.groupGlossary")}
        </p>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {t("venture.reporting.settings.glossaryHint")}
        </p>
        {!canEditGlossary && (
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {t("venture.reporting.settings.glossaryReadOnly")}
          </p>
        )}
        {glossary.map((entry, index) => (
          <div
            key={entry.term}
            className="rounded-xl border p-3 space-y-2"
            style={{ borderColor: "var(--border-primary)" }}
          >
            <p className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>
              {t(`venture.reporting.glossary.term.${entry.term}`)}
              <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                {entry.term}
              </span>
            </p>
            <AppInput
              label={t("venture.reporting.settings.definitionEn")}
              value={entry.definition_en || ""}
              disabled={!canEditGlossary}
              onChange={(event) =>
                setGlossary((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, definition_en: event.target.value } : row,
                  ),
                )
              }
            />
            <AppInput
              label={t("venture.reporting.settings.definitionFr")}
              value={entry.definition_fr || ""}
              disabled={!canEditGlossary}
              onChange={(event) =>
                setGlossary((current) =>
                  current.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, definition_fr: event.target.value } : row,
                  ),
                )
              }
            />
          </div>
        ))}
      </AppCard>

      <AppCard padding="normal" className="space-y-3">
        <div className="flex flex-wrap gap-6 text-xs" style={{ color: "var(--text-secondary)" }}>
          <span>
            {t("venture.reporting.settings.nextMonthly")}:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{payload?.nextMonthlyDue || "—"}</strong>
          </span>
          <span>
            {t("venture.reporting.settings.nextQuarterly")}:{" "}
            <strong style={{ color: "var(--text-primary)" }}>{payload?.nextQuarterlyDue || "—"}</strong>
          </span>
        </div>
        <AppButton onClick={save} disabled={saving}>
          {t("venture.reporting.settings.save")}
        </AppButton>
      </AppCard>
    </div>
  );
}
