"use client";

/**
 * Section 3 — Rules: "what is the maximum that can ever be granted?"
 *
 * Three tabs: the eligibility ceiling (a role × feature matrix that can only
 * be written by someone who may configure it), the responsibility catalogue
 * with the roles each one allows, and the scope policies that bound where a
 * right operates.
 *
 * Narrowing a ceiling is the one change that can strand capabilities a
 * role-default profile still grants, so the SERVER decides when that happens:
 * it answers 409 with the exact templates affected, and the drawer names them
 * before anything is written. Nothing is guessed client-side.
 */

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { notify } from "@/lib/notify";
import { SCOPE_POLICIES } from "@/models/authorization/scope-catalog";
import ImpactPreviewDrawer from "../drawers/ImpactPreviewDrawer";
import { nextEligibilityState } from "../personAccess";
import {
  Cell,
  EmptyRow,
  HeadCell,
  Kpi,
  KpiRow,
  Note,
  Pill,
  PrototypeTable,
} from "../prototypeUi";

export default function RulesSection({ data, tab, refresh }) {
  if (tab === "responsibilities") return <ResponsibilitiesTab data={data} />;
  if (tab === "scope") return <ScopeTab />;
  return <EligibilityTab data={data} refresh={refresh} />;
}

/* ----------------------------------------------------------- eligibility -- */

function EligibilityTab({ data, refresh }) {
  const { t } = useI18n();
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const eligibility = data.eligibility;
  const features = eligibility?.features || [];
  const empty = t("engineering.permissions.prototype.emptyValue");

  // The ceiling covers BOTH identity kinds the resolver understands: the
  // baseline ROLE on the account (super_admin / staff / member) and the
  // contextual PROFILE a person holds (program_manager, participant…). Writing
  // a profile ceiling is what opens a feature to a profile at all — without it
  // the profile editor can never grant that feature (the server refuses an
  // ineligible capability), so both kinds must be configurable here.
  const identities = [
    ...[...new Set([...(eligibility?.roles || []), ...(eligibility?.extraRoles || [])])].map(
      (value) => ({ kind: "role", value }),
    ),
    ...(eligibility?.profiles || []).map((value) => ({ kind: "profile", value })),
  ];

  /** The server's impact report, flattened into one line per template. */
  const impactLines = (impacts = []) =>
    impacts.flatMap((impact) =>
      (impact.templates || []).map((template) =>
        t("engineering.permissions.prototype.impactTemplate", {
          name: template.name,
          role: impact.role,
          feature: impact.feature,
          capabilities: (template.capabilities || []).join(", "),
        }),
      ),
    );

  const stateOf = (kind, value, feature) => {
    const row = (eligibility?.rows || []).find(
      (item) =>
        item.identity_type === kind &&
        item.identity_value === value &&
        item.feature_key === feature,
    );
    return row ? Number(row.eligible) : null;
  };

  const put = async (kind, value, feature, next, confirm = false) => {
    setBusy(true);
    try {
      const response = await fetch("/api/engineering/permissions/eligibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              feature_key: feature,
              identity_type: kind,
              identity_value: value,
              eligible: next,
            },
          ],
          confirm: confirm || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409 && result?.requiresConfirmation) {
        // C2 — the downgrade would strand capabilities a role-default profile
        // still grants. Nothing was persisted: name them, then ask.
        setPending({ kind, value, feature, next, impacts: result.impacts || [] });
        return;
      }
      if (!response.ok || result?.success === false) throw new Error(result?.error || "save failed");
      notify("success", t("engineering.permissions.prototype.changeApplied"));
      await refresh("eligibility");
    } catch (caught) {
      notify("error", caught?.message || t("engineering.permissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const onCell = (identity, feature) => {
    put(
      identity.kind,
      identity.value,
      feature,
      nextEligibilityState(stateOf(identity.kind, identity.value, feature)),
    );
  };

  return (
    <>
      <KpiRow>
        <Kpi value={identities.length} label={t("engineering.permissions.prototype.identities")} />
        <Kpi value={features.length} label={t("engineering.permissions.prototype.features")} />
        <Kpi value={data.alerts?.length ?? 0} label={t("engineering.permissions.prototype.alertsTitle")} />
      </KpiRow>

      <Note>{t("engineering.permissions.prototype.eligibilityNote")}</Note>

      {!data.canConfigure && (
        <Pill tone="warn">{t("engineering.permissions.prototype.readOnly")}</Pill>
      )}

      <PrototypeTable minWidth="52rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.identity")}</HeadCell>
            {features.map((feature) => (
              <HeadCell key={feature}>{feature}</HeadCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {identities.length === 0 && <EmptyRow colSpan={features.length + 1} label={t("common.noResults")} />}
          {identities.map((identity) => (
            <tr key={`${identity.kind}:${identity.value}`}>
              <Cell className="font-bold">
                <span className="flex items-center gap-1.5">
                  {identity.value}
                  {identity.kind === "profile" && (
                    <Pill tone="accent">
                      {t("engineering.permissions.eligibilityProfileTag")}
                    </Pill>
                  )}
                </span>
              </Cell>
              {features.map((feature) => {
                const state = stateOf(identity.kind, identity.value, feature);
                const tone =
                  state === 1
                    ? "bg-emerald-500/10 text-emerald-500"
                    : state === 0
                      ? "bg-rose-500/10 text-rose-500"
                      : "bg-surface-3 text-[var(--text-secondary)]";
                const label =
                  state === 1
                    ? t("engineering.permissions.prototype.allowed")
                    : state === 0
                      ? t("engineering.permissions.prototype.denied")
                      : empty;
                return (
                  <Cell key={feature} className="text-center">
                    <button
                      type="button"
                      disabled={!data.canConfigure || busy}
                      onClick={() => onCell(identity, feature)}
                      title={t("engineering.permissions.prototype.cellCycle")}
                      className={`min-w-10 rounded-[var(--radius-sm)] px-2 py-1 text-[10px] font-bold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60 ${tone} ${
                        data.canConfigure ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-60"
                      }`}
                    >
                      {label}
                    </button>
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </PrototypeTable>

      {pending && (
        <ImpactPreviewDrawer
          title={t("engineering.permissions.prototype.impactTitle")}
          hint={t("engineering.permissions.prototype.impactHint", {
            role: pending.value,
            feature: pending.feature,
          })}
          lines={impactLines(pending.impacts)}
          confirmLabel={t("engineering.permissions.prototype.impactConfirm")}
          onConfirm={() => put(pending.kind, pending.value, pending.feature, pending.next, true)}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------- responsibilities -- */

function ResponsibilitiesTab({ data }) {
  const { t } = useI18n();
  const rows = data.responsibilities || [];
  const empty = t("engineering.permissions.prototype.emptyValue");

  return (
    <>
      <Note>{t("engineering.permissions.prototype.responsibilitiesHint")}</Note>
      <PrototypeTable minWidth="40rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.description")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.allowedRoles")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={3} label={t("common.noResults")} />}
          {rows.map((row) => (
            <tr key={row.id || row.key} className="hover:bg-surface-2">
              <Cell className="font-bold">{row.name || row.key}</Cell>
              <Cell>{row.description || empty}</Cell>
              <Cell>
                <span className="flex flex-wrap gap-1">
                  {(row.allowed_roles || []).map((role) => (
                    <Pill key={role}>{role}</Pill>
                  ))}
                  {(row.allowed_roles || []).length === 0 && <Pill tone="neutral">{empty}</Pill>}
                </span>
              </Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>
    </>
  );
}

/* ----------------------------------------------------------------- scope -- */

function ScopeTab() {
  const { t } = useI18n();
  const policies = Object.values(SCOPE_POLICIES || {});

  return (
    <>
      <Note>{t("engineering.permissions.prototype.scopeHint")}</Note>
      <PrototypeTable minWidth="40rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.policy")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.resource")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.status")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.sourceLabel")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {policies.length === 0 && <EmptyRow colSpan={4} label={t("common.noResults")} />}
          {policies.map((policy) => (
            <tr key={policy.key} className="hover:bg-surface-2">
              <Cell className="font-bold">{policy.key}</Cell>
              <Cell>{policy.resource}</Cell>
              <Cell>
                <Pill tone={policy.implemented ? "ok" : "warn"}>
                  {policy.implemented
                    ? t("engineering.permissions.prototype.policyImplemented")
                    : t("engineering.permissions.prototype.policyDeclared")}
                </Pill>
              </Cell>
              <Cell className="text-xs text-[var(--text-secondary)]">{policy.source || "—"}</Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>
    </>
  );
}
