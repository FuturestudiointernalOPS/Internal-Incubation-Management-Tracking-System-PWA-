"use client";

import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";

/**
 * The workspace header card: the venture/investor identity, the status pill and
 * the four summary cells, including the inline staff-assignment popover.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function WorkspaceSummaryCard({
  selected,
  staffList,
  assignField,
  assignSearch,
  onAssignStart,
  onAssignCancel,
  onAssignSearchChange,
  onAssign,
}) {
  const { t } = useI18n();
  return (
    <AppCard padding="lg">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--text-primary)]">{selected.venture_name || t("investorAdmin.relationships.venture")}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{selected.investor_name || t("investorAdmin.relationships.investor")} · {selected.organization_name || t("investorAdmin.relationships.individual")}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${selected.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
          {selected.status}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {[
          ["relationshipManager", selected.relationship_manager_name || "Unassigned", "rm"],
          ["investmentManager", selected.investment_manager_name || "Unassigned", "im"],
          ["pipelineStage", selected.pipeline_stage || "—", null],
          ["nextAction", selected.next_action || "—", null],
        ].map(([l, v, field], i) => (
          <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)]">
            <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{t(`investorAdmin.relationships.${l}`)}</p>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs font-bold text-[var(--text-primary)]">{v === "Unassigned" ? t("investorAdmin.relationships.unassigned") : v}</p>
              {field && v === "Unassigned" && (
                <div className="relative">
                  <button onClick={() => onAssignStart(field === "rm" ? "relationship_manager" : "investment_manager")}
                    className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">{t("investorAdmin.relationships.assign")}</button>
                  {assignField === (field === "rm" ? "relationship_manager" : "investment_manager") && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-xl shadow-2xl z-50">
                      <input value={assignSearch} onChange={event => onAssignSearchChange(event.target.value)}
                        placeholder={t("investorAdmin.relationships.searchStaffPlaceholder")} autoFocus
                        className="w-full px-3 py-2 bg-transparent border-b border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                      <div className="max-h-36 overflow-y-auto">
                        {staffList.filter(staff => !assignSearch || staff.name?.toLowerCase().includes(assignSearch.toLowerCase()) || staff.email?.toLowerCase().includes(assignSearch.toLowerCase())).slice(0, 10).map(staff => (
                          <button key={staff.cid} onClick={() => onAssign(field === "rm" ? "relationship_manager" : "investment_manager", staff.cid, staff.name)}
                            className="w-full text-left px-3 py-2 hover:bg-[var(--surface-3)] text-[10px] font-bold text-[var(--text-primary)]">
                            {staff.name}<br/><span className="text-[10px] text-[var(--text-tertiary)]">{staff.email} · {staff.role}</span>
                          </button>
                        ))}
                        {staffList.filter(staff => !assignSearch || staff.name?.toLowerCase().includes(assignSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-4 text-[10px] text-[var(--text-tertiary)] text-center">{t("investorAdmin.relationships.noStaffFound")}</p>
                        )}
                      </div>
                      <button onClick={onAssignCancel}
                        className="w-full px-3 py-2 border-t border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("investorAdmin.relationships.cancel")}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppCard>
  );
}
