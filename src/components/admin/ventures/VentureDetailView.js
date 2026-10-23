"use client";

import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  CheckCircle2,
  Crown,
  FileText,
  Layers,
  Loader2,
  User,
  Users,
} from "lucide-react";
import { activityLabel, activityDetails } from "@/lib/ventureActivity";
import VentureDashboard from "@/components/ventures/VentureDashboard";
import VentureWizardTab from "./VentureWizardTab";
import VentureTeamTab from "./VentureTeamTab";
import VentureActivityTab from "./VentureActivityTab";
import VentureProfileReadOnly from "@/components/ventures/VentureProfileReadOnly";

const WIZARD_STEPS = [
  { step: 1, name: "vadmin.detail.startupIdentity", icon: Building2 },
  { step: 2, name: "vadmin.detail.businessInformation", icon: Briefcase },
  { step: 3, name: "vadmin.detail.founderInformation", icon: User },
  { step: 4, name: "vadmin.detail.teamInformation", icon: Users },
  { step: 5, name: "vadmin.detail.supportingDocuments", icon: FileText },
  { step: 6, name: "vadmin.detail.reviewAndSubmit", icon: CheckCircle2 },
];

export default function VentureDetailView({ ctx }) {
  const {
    loading,
    activeTab,
    actorText,
    error,
    getActivityColor,
    getActivityIcon,
    id,
    lang,
    memberSummary,
    members,
    router,
    setActiveTab,
    t,
    venture,
  } = ctx;

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" />
        </div>
      </>
    );
  }

  if (error || !venture) {
    return (
      <>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            {t("vadmin.detail.ventureNotFound")}
          </h2>
          <p className="text-slate-500 mb-6">{error || t("vadmin.detail.ventureLoadError")}</p>
          <button
            onClick={() => router.push("/admin/ventures")}
            className="btn btn-primary"
          >
            {t("vadmin.detail.backToVentures")}
          </button>
        </div>
      </>
    );
  }


  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Tab Content */}
        {activeTab === "dashboard" && (
          /* Full Dashboard is the first view when opening a Venture (merged
             with the former standalone dashboard page content). */
          <VentureDashboard id={id} embedded onOpenProfile={() => setActiveTab("profile")} />
        )}

        {(activeTab === "profile" || activeTab === "overview") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* The profile as the founders fill it in — read-only here. */}
              <VentureProfileReadOnly venture={venture} />

              {/* Wizard Progress */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                  {t("vadmin.detail.startupProfileWizard")}
                </h3>
                <div className="space-y-3">
                  {WIZARD_STEPS.map((ws) => {
                    const completed = (venture.history || []).some(
                      (historyEntry) => historyEntry.event_type === "PROFILE_WIZARD_INIT" && historyEntry.metadata?.step === ws.step && historyEntry.metadata?.completed
                    );
                    const Icon = ws.icon;
                    return (
                      <div
                        key={ws.step}
                        className={`flex items-center gap-4 p-3 rounded-xl ${
                          completed ? "bg-emerald-500/[0.03] border border-emerald-500/10" : "bg-tertiary border border-[var(--border-primary)]"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          completed ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-500/10 text-slate-500"
                        }`}>
                          {completed ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-[11px] font-bold ${
                            completed ? "text-emerald-500" : "text-slate-500"
                          }`}>
                            {t("vadmin.detail.stepName", { step: ws.step, name: t(ws.name) })}
                          </p>
                        </div>
                        {completed && (
                          <span className="text-[8px] font-black text-emerald-500 uppercase">{t("vadmin.detail.completed")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.detail.quickStats")}</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-500">{t("vadmin.detail.members")}</span>
                    </div>
                    <span className="text-sm font-black">{memberSummary.total}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[10px] font-bold text-slate-500">{t("vadmin.detail.founders")}</span>
                    </div>
                    <span className="text-sm font-black">{memberSummary.founders}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-500">{t("vadmin.detail.activityEvents")}</span>
                    </div>
                    <span className="text-sm font-black">{(venture.activity || []).length}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-tertiary rounded-xl">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-[10px] font-bold text-slate-500">{t("vadmin.detail.wizardProgress")}</span>
                    </div>
                    <span className="text-sm font-black">
                      {(venture.history || []).filter((historyEntry) => historyEntry.event_type === "PROFILE_WIZARD_INIT" && historyEntry.metadata?.completed).length}/{WIZARD_STEPS.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity (sidebar) */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">{t("vadmin.detail.recentActivity")}</h3>
                <div className="space-y-2">
                  {(venture.activity || []).slice(0, 5).map((activityEntry, index) => {
                    const Icon = getActivityIcon(activityEntry.action);
                    const color = getActivityColor(activityEntry.action);
                    const details = activityDetails(activityEntry.details, t);
                    return (
                      <div key={activityEntry.id || index} className="flex items-start gap-3 p-2 rounded-lg hover:bg-tertiary transition-all">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-[var(--text-primary)]">{activityLabel(activityEntry.action, t)}</p>
                          <p className="text-[8px] text-slate-500">
                            {actorText(activityEntry.actor_name)} · {new Date(activityEntry.created_at).toLocaleDateString(lang)}
                          </p>
                          {details.length > 0 && (
                            <p className="text-[8px] text-[var(--text-secondary)] mt-0.5">{details[0]}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(venture.activity || []).length === 0 && (
                    <p className="text-sm text-[var(--text-secondary)] py-3 text-center">{t("vadmin.detail.noActivityYet")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

{(activeTab === "founders" || activeTab === "team") && (
          <VentureTeamTab
            t={t}
            memberSummary={memberSummary}
            members={members}
            id={id}
            router={router}
            lang={lang}
          />
        )}

{activeTab === "activity" && (
          <VentureActivityTab
            t={t}
            venture={venture}
            actorText={actorText}
            getActivityIcon={getActivityIcon}
            getActivityColor={getActivityColor}
            lang={lang}
          />
        )}

        {activeTab === "wizard" && (
          <VentureWizardTab
            t={t}
            venture={venture}
            id={id}
            router={router}
            lang={lang}
            wizardSteps={WIZARD_STEPS}
          />
        )}

      </div>

    </>
  );
}
