"use client";

/**
 * Section 4 — Journal: "what changed, who changed it, and why?"
 *
 * The health numbers head the log, the three warnings open the door that
 * answers them, and the log itself is the same append-only audit the API
 * serves. Nothing here can be edited — the only write offered is the
 * portfolio-wide re-derivation, behind its own preview.
 */

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import AppButton from "@/components/ui/AppButton";
import RederiveDrawer from "../drawers/RederiveDrawer";
import {
  Cell,
  EmptyRow,
  HeadCell,
  Kpi,
  KpiRow,
  Note,
  Pill,
  PrototypeTable,
  Toolbar,
} from "../prototypeUi";

const TONE = { warn: "warn", crit: "crit", ok: "ok" };

export default function JournalSection({ data, onGoTo, refresh }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [rederive, setRederive] = useState(false);

  const kpis = data.kpis || {};
  const alerts = data.alerts || [];

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = data.audit || [];
    if (!needle) return rows;
    return rows.filter((entry) =>
      `${entry.action || ""} ${entry.actor_name || ""} ${entry.target_name || ""} ${entry.details || ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [data.audit, query]);

  const exportCsv = () => {
    const cell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["date", "actor", "target", "action", "details"].map((column) =>
      t(`engineering.permissions.prototype.${column}`),
    );
    const rows = entries.map((entry) =>
      [
        entry.created_at ? new Date(entry.created_at).toLocaleString() : "",
        entry.actor_name || "",
        entry.target_name || "",
        entry.action || "",
        entry.details || entry.reason || "",
      ]
        .map(cell)
        .join(","),
    );
    const csv = [header.map(cell).join(","), ...rows].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "permission-journal.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };


  return (
    <>
      <KpiRow>
        <Kpi value={kpis.superAdmins ?? 0} label={t("engineering.permissions.prototype.kpiSuperAdmins")} />
        <Kpi value={kpis.profiles ?? 0} label={t("engineering.permissions.prototype.kpiProfiles")} />
        <Kpi value={kpis.changes ?? 0} label={t("engineering.permissions.prototype.kpiChanges")} />
        <Kpi value={kpis.expiring ?? 0} label={t("engineering.permissions.prototype.kpiExpiring")} />
      </KpiRow>

      <Toolbar>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("engineering.permissions.prototype.searchJournal")}
          aria-label={t("engineering.permissions.prototype.searchJournal")}
          className="min-w-56 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        />
        <AppButton variant="secondary" onClick={() => refresh("audit")}>
          {t("common.refresh")}
        </AppButton>
        <AppButton variant="secondary" onClick={exportCsv}>
          {t("engineering.permissions.prototype.exportCsv")}
        </AppButton>
        <AppButton variant="secondary" onClick={() => setRederive(true)}>
          {t("engineering.permissions.prototype.rederiveOpen")}
        </AppButton>
      </Toolbar>

      {alerts.length > 0 ? (
        <div className="mb-3 space-y-1.5">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onGoTo(alert.section, alert.tab)}
              className="flex w-full items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--border-primary)] bg-surface-1 px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
            >
              <Pill tone={TONE[alert.tone] || "warn"}>{t("engineering.permissions.prototype.alert")}</Pill>
              <span>{t(alert.key, alert.params)}</span>
            </button>
          ))}
        </div>
      ) : (
        <Note>{t("engineering.permissions.prototype.allClear")}</Note>
      )}

      <PrototypeTable minWidth="44rem">
        <thead>
          <tr>
            <HeadCell>{t("engineering.permissions.prototype.date")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.actor")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.target")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.action")}</HeadCell>
            <HeadCell>{t("engineering.permissions.prototype.details")}</HeadCell>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && <EmptyRow colSpan={5} label={t("common.noResults")} />}
          {entries.map((entry, index) => (
            <tr key={entry.id || index} className="hover:bg-surface-2">
              <Cell className="whitespace-nowrap text-xs">
                {entry.created_at ? new Date(entry.created_at).toLocaleString() : t("engineering.permissions.prototype.emptyValue")}
              </Cell>
              <Cell>{entry.actor_name || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell>{entry.target_name || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell className="font-bold">{entry.action || t("engineering.permissions.prototype.emptyValue")}</Cell>
              <Cell className="text-xs">{entry.details || entry.reason || t("engineering.permissions.prototype.emptyValue")}</Cell>
            </tr>
          ))}
        </tbody>
      </PrototypeTable>

      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {t("engineering.permissions.prototype.journalCount", {
          shown: entries.length,
          total: data.auditTotal ?? entries.length,
        })}
      </p>

      {rederive && <RederiveDrawer onClose={() => setRederive(false)} onDone={() => refresh("all")} />}
    </>
  );
}
