"use client";

import { UserPlus, Building2, Users, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";

/**
 * The list view: the pending introductions and the active workspaces.
 * Extracted verbatim from AdminRelationshipsPage.
 */
export default function WorkspaceListView({
  pendingIntros,
  workspaces,
  loading,
  expandedIntros,
  onToggleIntro,
  onApproveIntro,
  onSelectWorkspace,
}) {
  const { t } = useI18n();
  return (
    <>
      {/* Pending introductions */}
      {pendingIntros.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-400" /> {t("investorAdmin.relationships.pendingIntroductions")} ({pendingIntros.length})
          </h3>
          {pendingIntros.map(pendingIntro => {
            const alreadyHas = workspaces.some(workspace => workspace.venture_id === pendingIntro.venture_id && workspace.investor_id === pendingIntro.investor_id);
            return (
              <AppCard key={pendingIntro.id} padding="md">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{pendingIntro.venture_name || t("investorAdmin.relationships.venture")}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {pendingIntro.investor_name || t("investorAdmin.relationships.investor")}{pendingIntro.organization_name ? ` · ${pendingIntro.organization_name}` : ""} · {t("investorAdmin.relationships.meetingRequested")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onToggleIntro(pendingIntro.id)}
                        className="text-[10px] font-bold text-[var(--brand-orange)] hover:underline">
                        {expandedIntros[pendingIntro.id] ? t("investorAdmin.relationships.hideProfile") : t("investorAdmin.relationships.viewInvestorProfile")}
                      </button>
                      {!alreadyHas ? (
                        <AppButton variant="primary" size="sm" icon={CheckCircle2}
                          onClick={() => onApproveIntro(pendingIntro.id)}>
                          {t("investorAdmin.relationships.approveCreateWorkspace")}
                        </AppButton>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold">{t("investorAdmin.relationships.workspaceExists")}</span>
                      )}
                    </div>
                  </div>
                  {expandedIntros[pendingIntro.id] && (
                    <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] grid grid-cols-2 md:grid-cols-4 gap-2">
                      {pendingIntro.industries?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.industries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.industries||[]).join(", ")}</p></div>}
                      {pendingIntro.countries?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.countries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.countries||[]).join(", ")}</p></div>}
                      {pendingIntro.startup_stages?.length > 0 && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.stages")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(pendingIntro.startup_stages||[]).join(", ")}</p></div>}
                      {(pendingIntro.ticket_size_min || pendingIntro.ticket_size_max) && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.ticket")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">${pendingIntro.ticket_size_min||"0"}–${pendingIntro.ticket_size_max||"∞"}</p></div>}
                      {pendingIntro.email && <div><p className="text-[10px] text-[var(--text-tertiary)] uppercase">{t("investorAdmin.relationships.email")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{pendingIntro.email}</p></div>}
                    </div>
                  )}
                </div>
              </AppCard>
            );
          })}
        </div>
      )}

      {/* Active workspaces */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">
          {t("investorAdmin.relationships.activeWorkspaces")} ({workspaces.filter(workspace => workspace.status === "active").length})
        </h3>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
        ) : workspaces.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] py-8 text-center">{t("investorAdmin.relationships.noWorkspacesYet")}</p>
        ) : (
          <div className="space-y-2">
            {workspaces.map(workspace => (
              <AppCard key={workspace.id} padding="md" hover onClick={() => onSelectWorkspace(workspace)}>
                <div className="cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-[var(--brand-orange)]" />
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{workspace.venture_name || t("investorAdmin.relationships.venture")}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {workspace.investor_name}{workspace.organization_name ? ` · ${workspace.organization_name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {workspace.relationship_manager_name && (
                      <span className="text-[10px] text-[var(--text-tertiary)] flex items-center gap-1">
                        <Users className="w-3 h-3" /> {workspace.relationship_manager_name}
                      </span>
                    )}
                    {workspace.upcoming_meetings > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400">
                        {t("investorAdmin.relationships.upcomingMeetings", { count: workspace.upcoming_meetings })}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${workspace.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}`}>
                      {workspace.status}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
