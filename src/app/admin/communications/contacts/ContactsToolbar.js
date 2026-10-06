"use client";

import { Search, X } from "lucide-react";
import { STATUS_FILTER_LABELS } from "./contactsConstants";

export function ContactsToolbar({
  t,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  filteredCount,
}) {
  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("crm.contacts.filterIdentities")}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-xl py-3 pl-10 pr-10 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              title={t("common.clearFilter")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-rose-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="shrink-0">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] uppercase tracking-widest"
          >
            {["All", "Active", "Approved", "Pending", "Inactive", "Archived"].map((status) => (
              <option key={status} value={status}>
                {t(STATUS_FILTER_LABELS[status] || "") || status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-primary)] pt-3">
        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
          {t("crm.contacts.showingCount", { count: filteredCount })}
        </p>
      </div>
    </div>
  );
}
