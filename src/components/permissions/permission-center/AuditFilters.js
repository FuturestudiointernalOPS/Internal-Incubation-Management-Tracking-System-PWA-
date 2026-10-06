"use client";

import AuditPersonFilter from "@/components/permissions/AuditPersonFilter";
import { useI18n } from "@/lib/i18n";

/**
 * The audit reader's filter panel, extracted verbatim from AuditView.js. It owns
 * no state and runs no read: the screen passes the typing state (`filters`), the
 * sent state (`applied`), the options and the three handlers. Every field is a
 * controlled input, so the panel never keeps a copy of its own.
 */
export default function AuditFilters({
  filters,
  applied,
  moduleOptions,
  actions,
  updateFilter,
  applyFilters,
  clearFilters,
}) {
  const { t } = useI18n();
  return (
    <>
      {/* Filters: the free-text box searches everything at once; the fields next
          to it answer the narrower, more common questions — who made the change,
          who it was about, which capability, and one person's whole history. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <input
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && applyFilters()}
            placeholder={t("engineering.permissions.auditSearch")}
            aria-label={t("engineering.permissions.auditSearch")}
            className="w-full bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40 transition-all"
          />
        </div>
        <input
          value={filters.actor}
          onChange={(event) => updateFilter("actor", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterActor")}
          aria-label={t("engineering.permissions.auditFilterActor")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.target}
          onChange={(event) => updateFilter("target", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterTarget")}
          aria-label={t("engineering.permissions.auditFilterTarget")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <input
          value={filters.capability}
          onChange={(event) => updateFilter("capability", event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applyFilters()}
          placeholder={t("engineering.permissions.auditFilterCapability")}
          aria-label={t("engineering.permissions.auditFilterCapability")}
          className="w-40 bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/50 focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        />
        <select
          value={filters.action}
          onChange={(event) => updateFilter("action", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterActionAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllActions")}</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <select
          value={filters.module}
          onChange={(event) => updateFilter("module", event.target.value)}
          aria-label={t("engineering.permissions.auditFilterModuleAria")}
          className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
        >
          <option value="">{t("engineering.permissions.auditAllModules")}</option>
          {moduleOptions.map((module) => (
            <option key={module} value={module}>
              {module}
            </option>
          ))}
        </select>
        <AuditPersonFilter
          value={filters.target_cid}
          onChange={(cid) => updateFilter("target_cid", cid)}
        />
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterFrom")}
          </span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => updateFilter("from", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("engineering.permissions.auditFilterTo")}
          </span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => updateFilter("to", event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-3 py-2.5 text-[10px] font-bold text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40"
          />
        </label>
        <button
          onClick={applyFilters}
          className="px-4 py-2.5 rounded-xl bg-[var(--brand-orange)] text-black text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditApplyFilters")}
        </button>
        <button
          onClick={clearFilters}
          className="px-4 py-2.5 rounded-xl bg-secondary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
        >
          {t("engineering.permissions.auditClearFilters")}
        </button>
      </div>

      {applied.target_cid && (
        <p className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-3 py-2 text-[10px] font-bold text-[var(--text-primary)]">
          {t("engineering.permissions.auditFilterPersonActive")}
        </p>
      )}
    </>
  );
}
