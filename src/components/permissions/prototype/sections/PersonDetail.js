"use client";

/**
 * A person's detail — the prototype's own view, opened by clicking any row.
 *
 * Five tabs: the rights they hold (with the four counts), WHY each right is
 * there (the three gates), WHERE it applies (the contextual records the scope
 * engine resolves), their responsibilities, and their slice of the log.
 *
 * Everything is read from the same endpoints the rest of the centre uses —
 * `user-context` is the resolver's own answer, never a client-side guess.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import { defer } from "../../effectUtils";
import { buildRightRows, countRights, gatesForRow } from "../personAccess";
import { PERSON_TABS } from "../prototypeNav";
import {
  Cell,
  EmptyRow,
  Gate,
  HeadCell,
  Kpi,
  KpiRow,
  levelLabel,
  Note,
  Pill,
  PrototypeTable,
  Tabs,
} from "../prototypeUi";



const ORIGIN_TONE = { direct: "accent", restriction: "crit", profile: "ok", group: "neutral", none: "neutral" };
const GATE_GLYPH = { yes: "✓", no: "✕", pending: "—" };
const GATE_TONE = { yes: "text-emerald-500", no: "text-rose-500", pending: "text-[var(--text-secondary)]" };

async function getJson(url) {
  const response = await fetch(url);
  return response.json();
}

export default function PersonDetail({ person, data, revision = 0, onBack, openDrawer }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("rights");
  const [context, setContext] = useState(null);
  const [audit, setAudit] = useState([]);
  const [responsibilities, setResponsibilities] = useState([]);
  const [scopeRecords, setScopeRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  const cid = person.cid;

  useEffect(() => {
    let active = true;
    defer(() => setLoading(true));
    Promise.all([
      getJson(`/api/engineering/permissions/user-context?cid=${encodeURIComponent(cid)}`),
      getJson(`/api/engineering/permissions/audit?target_cid=${encodeURIComponent(cid)}&page=1&pageSize=50`),
      getJson(`/api/responsibilities?user_cid=${encodeURIComponent(cid)}`),
      getJson(`/api/engineering/permissions/scope-check?policy=program_assigned&cid=${encodeURIComponent(cid)}`),
    ])
      .then(([ctx, log, resp, scope]) => {
        if (!active) return;
        setContext(ctx?.success ? ctx : null);
        setAudit(log?.success ? log.entries || [] : []);
        setResponsibilities(resp?.success ? resp.responsibilities || [] : []);
        setScopeRecords(scope?.success ? scope.resolved_count || 0 : 0);
      })
      .catch(() => active && setContext(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [cid, revision]);

  const rows = context
    ? buildRightRows({
        ctx: context,
        catalog: data.catalog || {},
        moduleToFeature: data.moduleToFeature || {},
      })
    : [];
  const counts = countRights(rows);

  const empty = t("engineering.permissions.prototype.emptyValue");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <AppButton variant="secondary" onClick={onBack}>
            {t("common.back")}
          </AppButton>
          <span className="ml-3 text-lg font-black text-[var(--text-primary)]">
            {person.name || person.email || person.cid}
          </span>
          <span className="ml-2 text-sm text-[var(--text-secondary)]">
            {person.role || empty} · {person.cid}
          </span>
        </div>
        <Pill tone={context?.isSuperAdmin ? "crit" : "neutral"}>
          {context?.isSuperAdmin ? t("engineering.permissions.prototype.superAdmin") : person.status || empty}
        </Pill>
      </div>

      <KpiRow>
        <Kpi value={counts.effective} label={t("engineering.permissions.prototype.kpiEffective")} />
        <Kpi value={counts.inherited} label={t("engineering.permissions.prototype.kpiInherited")} />
        <Kpi value={counts.direct} label={t("engineering.permissions.prototype.kpiDirect")} />
        <Kpi value={counts.restricted} label={t("engineering.permissions.prototype.kpiRestricted")} />
      </KpiRow>

      <Tabs
        items={PERSON_TABS.map((item) => ({
          key: item,
          label: t(`engineering.permissions.prototype.tabs.${item}`),
        }))}
        value={tab}
        onChange={setTab}
      />

      {loading && <Note>{t("common.loading")}</Note>}
      {!loading && !context && <Note>{t("engineering.permissions.prototype.personLoadFailed")}</Note>}

      {context && tab === "rights" && (
        <PrototypeTable minWidth="46rem">
          <thead>
            <tr>
              <HeadCell>{t("engineering.permissions.prototype.feature")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.capability")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.level")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.sourceLabel")}</HeadCell>
              <HeadCell />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={5} label={t("common.noResults")} />}
            {rows.map((row) => (
              <tr key={row.key} className="transition-colors hover:bg-surface-2">
                <Cell>{row.feature || empty}</Cell>
                <Cell className="font-bold">
                  {row.module} ▸ {row.capability}
                  {row.restricted && (
                    <span className="ml-2">
                      <Pill tone="crit">{t("engineering.permissions.prototype.blocked")}</Pill>
                    </span>
                  )}
                </Cell>
                <Cell>{row.effective ? levelLabel(row.level, t) : empty}</Cell>
                <Cell>
                  <Pill tone={ORIGIN_TONE[row.origin] || "neutral"}>
                    {row.origin === "none"
                      ? empty
                      : t(`engineering.permissions.prototype.source.${row.origin}`)}
                  </Pill>
                </Cell>
                <Cell className="text-right">
                  <AppButton
                    variant="secondary"
                    onClick={() => openDrawer({ kind: "edit", person, row })}
                  >
                    {t("engineering.permissions.prototype.editRight")}
                  </AppButton>
                </Cell>
              </tr>
            ))}
          </tbody>
        </PrototypeTable>
      )}

      {context && tab === "why" && (
        <>
          <Note>{t("engineering.permissions.prototype.whyNote")}</Note>
          <div className="mb-3 flex flex-col gap-2">
            <Gate
              index="1"
              title={t("engineering.permissions.prototype.gateEligibility")}
              state="yes"
              detail={context.isSuperAdmin ? t("engineering.permissions.prototype.gateSuperAdmin") : t("engineering.permissions.prototype.gateEligibilityDetail")}
            />
            <Gate
              index="2"
              title={t("engineering.permissions.prototype.gateCapacity")}
              state={counts.effective > 0 ? "yes" : "no"}
              detail={t("engineering.permissions.prototype.holdsRights", { count: counts.effective })}
            />
            <Gate
              index="3"
              title={t("engineering.permissions.prototype.gateScope")}
              state={scopeRecords > 0 ? "yes" : "pending"}
              detail={
                scopeRecords > 0
                  ? t("engineering.permissions.prototype.gateScope", { count: scopeRecords })
                  : t("engineering.permissions.prototype.gateScopeEmpty")
              }
            />
          </div>
          <PrototypeTable minWidth="44rem">
            <thead>
              <tr>
                <HeadCell>{t("engineering.permissions.prototype.capability")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.gateEligibility")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.gateCapacity")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.gateScope")}</HeadCell>
              </tr>
            </thead>
            <tbody>
              {rows.filter((row) => row.level > 0 || row.restricted).length === 0 && (
                <EmptyRow colSpan={4} label={t("common.noResults")} />
              )}
              {rows
                .filter((row) => row.level > 0 || row.restricted)
                .map((row) => {
                  const gates = gatesForRow(row, scopeRecords);
                  return (
                    <tr key={row.key}>
                      <Cell className="font-bold">
                        {row.module} ▸ {row.capability}
                      </Cell>
                      {gates.map((state, index) => (
                        <Cell key={index}>
                          <span className={`text-sm font-bold ${GATE_TONE[state]}`}>
                            {GATE_GLYPH[state]}
                          </span>
                        </Cell>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </PrototypeTable>
        </>
      )}

      {context && tab === "scope" && (
        <>
          <Note>{t("engineering.permissions.prototype.scopeNote")}</Note>
          <PrototypeTable minWidth="36rem">
            <thead>
              <tr>
                <HeadCell>{t("engineering.permissions.prototype.context")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.role")}</HeadCell>
                <HeadCell>{t("engineering.permissions.prototype.scopePolicy")}</HeadCell>
              </tr>
            </thead>
            <tbody>
              {(context.contexts || []).length === 0 && (
                <EmptyRow colSpan={4} label={t("engineering.permissions.prototype.noContexts")} />
              )}
              {(context.contexts || []).map((item) => (
                <tr key={`${item.type}:${item.id}`}>
                  <Cell>{item.type}</Cell>
                  <Cell className="font-bold">{item.label || empty}</Cell>
                  <Cell>{item.role || empty}</Cell>
                  <Cell>
                    <Pill tone={item.scopeImplemented === false ? "warn" : "ok"}>
                      {item.scopePolicy || empty}
                    </Pill>
                  </Cell>
                </tr>
              ))}
            </tbody>
          </PrototypeTable>
        </>
      )}

      {context && tab === "responsibilities" && (
        <PrototypeTable minWidth="36rem">
          <thead>
            <tr>
              <HeadCell>{t("engineering.permissions.prototype.name")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.description")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {responsibilities.length === 0 && <EmptyRow colSpan={2} label={t("engineering.permissions.prototype.responsibilitiesHint")} />}
            {responsibilities.map((item) => (
              <tr key={item.id || item.key}>
                <Cell className="font-bold">{item.name || item.key}</Cell>
                <Cell>{item.description || empty}</Cell>
              </tr>
            ))}
          </tbody>
        </PrototypeTable>
      )}

      {context && tab === "history" && (
        <PrototypeTable minWidth="36rem">
          <thead>
            <tr>
              <HeadCell>{t("engineering.permissions.prototype.date")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.actor")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.action")}</HeadCell>
              <HeadCell>{t("engineering.permissions.prototype.details")}</HeadCell>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && <EmptyRow colSpan={4} label={t("common.noResults")} />}
            {audit.map((entry, index) => (
              <tr key={entry.id || index}>
                <Cell>{entry.created_at ? new Date(entry.created_at).toLocaleString() : empty}</Cell>
                <Cell>{entry.actor_name || empty}</Cell>
                <Cell>{entry.action || empty}</Cell>
                <Cell>{entry.details || entry.reason || empty}</Cell>
              </tr>
            ))}
          </tbody>
        </PrototypeTable>
      )}
    </div>
  );
}
