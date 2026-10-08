"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { defer } from "./effectUtils";
import { ACCESS_LEVEL_KEYS, GRANT_LEVELS } from "./levelChips";
import Badge from "./ui/Badge";
import DecisionGates from "./DecisionGates";

/**
 * ACCESS CHECKER — the prototype's "Vérifier un accès", made real.
 *
 * Pick a person, a right and a required level; see whether the engine would
 * ALLOW it, and which of the three gates decides. This is a read-only
 * simulation on live data — it grants nothing.
 *
 * The verdict mirrors `authorize()` exactly:
 *   • Super Admin is denied only by an explicit restriction, or downgraded by an
 *     explicit grant below the level; eligibility is bypassed.
 *   • Everyone else must be eligible for the feature AND hold the level.
 * Scope is deliberately NOT guessed here: the checker reports it as not
 * evaluated, because inventing a green scope gate is a lie the engine would
 * contradict.
 */

const CONTACTS_URL = "/api/contacts";
const CATALOG_URL = "/api/engineering/permissions";

const FIELD_CLASS =
  "rounded-lg border border-[var(--border-primary)] bg-secondary px-3 py-2 text-xs font-bold text-[var(--text-primary)] outline-none transition-colors focus:border-brand-orange/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60";

export default function AccessChecker() {
  const { t } = useI18n();
  const [people, setPeople] = useState([]);
  const [modules, setModules] = useState({});
  const [cid, setCid] = useState("");
  const [module, setModule] = useState("");
  const [capability, setCapability] = useState("");
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    defer(async () => {
      try {
        const cached = cacheGet(CONTACTS_URL);
        if (cached?.success) setPeople(cached.contacts || []);
        const [contactsRes, catalogRes] = await Promise.all([
          fetch(CONTACTS_URL).then((response) => response.json()),
          fetch(CATALOG_URL).then((response) => response.json()),
        ]);
        if (contactsRes?.success) {
          cacheSet(CONTACTS_URL, contactsRes);
          setPeople(contactsRes.contacts || []);
        }
        if (catalogRes?.success) setModules(catalogRes.modules || {});
      } catch {
        /* catalog optional — the screen simply stays empty */
      }
    });
  }, []);

  const moduleList = useMemo(() => Object.keys(modules).sort(), [modules]);
  const capabilityList = useMemo(
    () => (modules[module]?.capabilities || []).slice().sort(),
    [modules, module],
  );

  useEffect(() => {
    defer(() => {
      if (!module && moduleList.length > 0) setModule(moduleList[0]);
    });
  }, [module, moduleList]);

  useEffect(() => {
    defer(() => {
      if (!capabilityList.includes(capability)) {
        setCapability(capabilityList[0] || "");
      }
    });
  }, [capability, capabilityList]);

  const run = useCallback(async () => {
    if (!cid) {
      setErr(t("engineering.permissions.checkerNeedPerson"));
      return;
    }
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const data = await fetch(
        `/api/engineering/permissions?user_cid=${encodeURIComponent(cid)}`,
      ).then((response) => response.json());
      if (!data?.success) throw new Error(data?.error || t("engineering.permissions.checkerFailed"));

      const isSuperAdmin = data.user?.role === "super_admin";
      const feature = data.moduleToFeature?.[module] || module;
      const eligible =
        isSuperAdmin || data.explanation?.eligibility?.[feature]?.eligible === true;
      const restriction = (data.individualRestrictions || []).find(
        (row) => row.module === module && row.capability === capability,
      );
      const grant = (data.individualGrants || []).find(
        (row) => row.module === module && row.capability === capability,
      );
      const effectiveLevel = Number(data.effectivePermissions?.[module]?.[capability] ?? 0);

      // The level the engine would actually weigh, per the authorize() rules.
      let heldLevel;
      if (isSuperAdmin) {
        heldLevel = restriction ? 0 : grant ? Number(grant.access_level) : 5;
      } else {
        heldLevel = restriction ? 0 : effectiveLevel;
      }
      const allowed = eligible && heldLevel >= level;

      setResult({
        isSuperAdmin,
        feature,
        eligible,
        heldLevel,
        restricted: Boolean(restriction),
        allowed,
      });
    } catch (error) {
      setErr(error.message || t("engineering.permissions.checkerFailed"));
    } finally {
      setBusy(false);
    }
  }, [cid, module, capability, level, t]);

  const levelLabel = (value) =>
    t(ACCESS_LEVEL_KEYS[value] || "engineering.permissions.accessLevelNone");

  const gates = result
    ? [
        {
          key: "eligibility",
          titleKey: "engineering.permissions.gateEligibility",
          labelKey: result.eligible
            ? "engineering.permissions.gateOpen"
            : "engineering.permissions.gateClosed",
          tone: result.eligible ? "open" : "closed",
          detail: result.isSuperAdmin
            ? t("engineering.permissions.gateSuperAdminBypass")
            : result.feature,
        },
        {
          key: "capability",
          titleKey: "engineering.permissions.gateCapability",
          labelKey: result.restricted
            ? "engineering.permissions.gateRestricted"
            : result.heldLevel > 0
              ? "engineering.permissions.gateHeld"
              : "engineering.permissions.gateNotHeld",
          tone: result.restricted ? "closed" : result.heldLevel > 0 ? "open" : "closed",
          detail:
            result.heldLevel > 0
              ? `${capability} · ${levelLabel(result.heldLevel)}`
              : capability,
        },
        {
          key: "scope",
          titleKey: "engineering.permissions.gateScope",
          labelKey: "engineering.permissions.gateNotEvaluated",
          tone: "neutral",
        },
      ]
    : [];

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border-primary)] bg-[var(--surface-1)] p-4">
      <div>
        <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
          {t("engineering.permissions.checkerTitle")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          {t("engineering.permissions.checkerIntro")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.checkerPerson")}
          </span>
          <select value={cid} onChange={(event) => setCid(event.target.value)} className={FIELD_CLASS}>
            <option value="">—</option>
            {[...people]
              .sort((first, second) => (first.name || "").localeCompare(second.name || ""))
              .map((person) => (
                <option key={person.cid} value={person.cid}>
                  {person.name || person.email || person.cid}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.checkerModule")}
          </span>
          <select
            value={module}
            onChange={(event) => setModule(event.target.value)}
            className={FIELD_CLASS}
          >
            {moduleList.map((moduleKey) => (
              <option key={moduleKey} value={moduleKey}>
                {modules[moduleKey]?.name || moduleKey}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.checkerRight")}
          </span>
          <select
            value={capability}
            onChange={(event) => setCapability(event.target.value)}
            className={FIELD_CLASS}
          >
            {capabilityList.map((capabilityKey) => (
              <option key={capabilityKey} value={capabilityKey}>
                {capabilityKey}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.checkerLevel")}
          </span>
          <select
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            className={FIELD_CLASS}
          >
            {GRANT_LEVELS.map((value) => (
              <option key={value} value={value}>
                {levelLabel(value)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={run}
          disabled={busy || !cid}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-orange)] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black transition-all hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t("engineering.permissions.checkerRun")}
        </button>
      </div>

      {err && <p className="text-xs font-bold text-red-500">{err}</p>}

      {result && (
        <div className="space-y-3 rounded-lg border border-[var(--border-primary)] bg-secondary/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.allowed ? "allowed" : "denied"}>
              {t(
                result.allowed
                  ? "engineering.permissions.checkerAllowed"
                  : "engineering.permissions.checkerDenied",
              )}
            </Badge>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {module} · {capability} · {levelLabel(level)}
            </span>
          </div>
          <DecisionGates t={t} gates={gates} />
        </div>
      )}
    </section>
  );
}
