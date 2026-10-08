"use client";

import { Clock } from "lucide-react";
import { formatLocaleDate } from "@/lib/constants";
import { MODULE_COLORS, MODULE_LABELS } from "./constants";

/**
 * Timeline tab — the quick module panels, the module filter pills and the
 * year-grouped event list. Reading and filtering stay in the page.
 */
export default function TimelineTab({
  panelCounts,
  moduleFilter,
  onModuleFilter,
  events,
  eventsByYear,
  sortedYears,
  contact,
  t,
  lang,
}) {
  return (
    <div className="space-y-4">
      {/* Quick panels */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { key: "forms", label: t("crm.people.panelForms"), count: panelCounts.forms, color: "border-purple-500/30" },
          { key: "programs", label: t("crm.people.panelPrograms"), count: panelCounts.programs, color: "border-blue-500/30" },
          { key: "ventures", label: t("crm.people.panelVentures"), count: panelCounts.ventures, color: "border-emerald-500/30" },
          { key: "investors", label: t("crm.people.panelInvestors"), count: panelCounts.investors, color: "border-amber-500/30" },
          { key: "communications", label: t("crm.people.panelComms"), count: panelCounts.comms, color: "border-cyan-500/30" },
        ].map(panel => (
          <button
            key={panel.key}
            onClick={() => onModuleFilter(moduleFilter === panel.key ? "" : panel.key)}
            className={`p-3 rounded-xl border text-center transition-all ${
              moduleFilter === panel.key
                ? "border-[var(--brand-orange)] bg-brand-orange/5"
                : "border-[var(--border-primary)] hover:border-brand-orange/50"
            }`}
          >
            <p className="text-lg font-black">{panel.count}</p>
            <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">{panel.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {["", "forms", "programs", "ventures", "investors", "communications", "system"].map(module => (
          <button
            key={module}
            onClick={() => onModuleFilter(module)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              moduleFilter === module ? "bg-[var(--brand-orange)] text-black border-orange-600" : "bg-primary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--brand-orange)]"
            }`}
          >
            {t(MODULE_LABELS[module] || "") || module || t("crm.people.all")}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="bg-primary border border-[var(--border-primary)] rounded-2xl p-8 text-center">
          <Clock className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
          <p className="text-sm font-bold">{t("crm.people.noEvents")}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            {t("crm.people.noEventsHint", { name: contact.name })}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedYears.map(year => (
            <div key={year}>
              <div className="flex items-center gap-3 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-orange)]" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--brand-orange)]">{year}</h3>
              </div>
              <div className="space-y-1.5 pl-5 border-l-2 border-[var(--border-primary)]">
                {eventsByYear[year].map(event => (
                  <div key={event.id} className="relative pl-5 pb-3">
                    <div className="absolute left-[-23px] top-1.5 w-2 h-2 rounded-full bg-[var(--border-primary)] border-2 border-primary" />
                    <div className="bg-primary border border-[var(--border-primary)] rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold">{event.description}</p>
                        {event.context_module && (
                          <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${MODULE_COLORS[event.context_module] || MODULE_COLORS.system}`}>
                            {t(MODULE_LABELS[event.context_module] || "") || event.context_module}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                        {formatLocaleDate(event.created_at, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }, lang)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
