"use client";

/**
 * "Vérifier un accès" — the prototype's bench: pick a person, a capability and
 * a level, and the three gates answer Autorisé / Refusé.
 *
 * It never invents a verdict: gate 1 and 2 read the SAME resolver output the
 * People screen shows (`user-context`), and gate 3 is what the scope engine
 * actually resolves for that person (`scope-check` on every implemented
 * policy). A failing read stays "no result", never a green tick.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppDrawer from "@/components/ui/AppDrawer";
import AppButton from "@/components/ui/AppButton";
import { CONTROL_CLASS, Field, Gate, Pill, levelLabel } from "../prototypeUi";
import { buildRightRows, gatesForRow } from "../personAccess";

/** Every capability of the catalog, as one flat list of options. */
function capabilityOptions(catalog = {}) {
  return Object.entries(catalog).flatMap(([module, definition]) =>
    Object.keys(definition?.capabilities || {}).map((capability) => ({
      value: `${module}.${capability}`,
      label: `${module} ▸ ${capability}`,
    })),
  );
}

async function readPerson(cid) {
  const [contextRes, scopeRes] = await Promise.all([
    fetch(`/api/engineering/permissions/user-context?cid=${encodeURIComponent(cid)}`).then((r) => r.json()),
    fetch(`/api/engineering/permissions/scope-check?policy=program_assigned&cid=${encodeURIComponent(cid)}`).then((r) => r.json()),
  ]);
  return { context: contextRes?.success ? contextRes : null, scopeRecords: scopeRes?.success ? scopeRes.resolved_count || 0 : 0 };
}

export default function AccessCheckDrawer({ data, onClose }) {
  const { t } = useI18n();
  const { contacts = [], catalog = {}, moduleToFeature = {} } = data;
  const [personCid, setPersonCid] = useState(contacts[0]?.cid || "");
  const [capabilityKey, setCapabilityKey] = useState("");
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const capabilities = capabilityOptions(catalog);
  const selectedCapability = capabilityKey.split(".");

  const verify = async () => {
    if (!personCid || !capabilityKey) return;
    setBusy(true);
    setResult(null);
    try {
      const { context, scopeRecords } = await readPerson(personCid);
      if (!context) {
        setResult({ error: t("engineering.permissions.prototype.checkFailed") });
        return;
      }
      const [module, capability] = selectedCapability;
      const row = buildRightRows({ ctx: context, catalog, moduleToFeature }).find(
        (item) => item.module === module && item.capability === capability,
      ) || {
        eligible: false,
        effective: false,
        level: 0,
        restricted: false,
        origin: "none",
      };
      const authorized = row.eligible && row.effective && row.level >= Number(level);
      setResult({ row, scopeRecords, authorized, requestedLevel: Number(level) });
    } finally {
      setBusy(false);
    }
  };

  const gateDetails = result?.row
    ? [
        result.row.eligible
          ? t("engineering.permissions.prototype.gateOpen")
          : t("engineering.permissions.prototype.gateClosed"),
        result.row.effective
          ? `${levelLabel(result.row.level, t)} (${t(`engineering.permissions.prototype.source.${result.row.origin}`)})`
          : t("engineering.permissions.prototype.gateNoRight"),
        result.scopeRecords > 0
          ? t("engineering.permissions.prototype.gateScope", { count: result.scopeRecords })
          : t("engineering.permissions.prototype.gateScopeEmpty"),
      ]
    : ["", "", ""];

  const gateStates = result?.row ? gatesForRow(result.row, result.scopeRecords) : ["pending", "pending", "pending"];

  return (
    <AppDrawer
      isOpen
      onClose={onClose}
      title={t("engineering.permissions.prototype.checkTitle")}
      footer={
        <>
          <AppButton onClick={verify} disabled={busy || !personCid || !capabilityKey} loading={busy}>
            {t("engineering.permissions.prototype.checkRun")}
          </AppButton>
          <AppButton variant="secondary" onClick={onClose}>
            {t("common.close")}
          </AppButton>
        </>
      }
    >
      <Field label={t("engineering.permissions.prototype.person")}>
        <select className={CONTROL_CLASS} value={personCid} onChange={(event) => setPersonCid(event.target.value)}>
          {contacts.map((contact) => (
            <option key={contact.cid} value={contact.cid}>
              {contact.name || contact.email || contact.cid}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("engineering.permissions.prototype.capability")}>
        <select className={CONTROL_CLASS} value={capabilityKey} onChange={(event) => setCapabilityKey(event.target.value)}>
          <option value="">{t("engineering.permissions.prototype.selectCapability")}</option>
          {capabilities.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t("engineering.permissions.prototype.level")}>
        <select className={CONTROL_CLASS} value={level} onChange={(event) => setLevel(event.target.value)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {levelLabel(value, t)}
            </option>
          ))}
        </select>
      </Field>

      {result?.error && <p className="text-xs text-rose-500">{result.error}</p>}

      {result?.row && (
        <div className="space-y-3">
          <p className="text-sm font-black">
            <span className={result.authorized ? "text-emerald-500" : "text-rose-500"}>
              {result.authorized
                ? `✓ ${t("engineering.permissions.prototype.allowed")}`
                : `✕ ${t("engineering.permissions.prototype.refused")}`}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            <Gate index="1" title={t("engineering.permissions.prototype.gateEligibility")} state={gateStates[0]} detail={gateDetails[0]} />
            <Gate index="2" title={t("engineering.permissions.prototype.gateCapacity")} state={gateStates[1]} detail={gateDetails[1]} />
            <Gate index="3" title={t("engineering.permissions.prototype.gateScope")} state={gateStates[2]} detail={gateDetails[2]} />
          </div>
          {result.requestedLevel > result.row.level && (
            <Pill tone="warn">
              {t("engineering.permissions.prototype.holdsLevel", { level: levelLabel(result.row.level, t) })}
            </Pill>
          )}
        </div>
      )}
    </AppDrawer>
  );
}
