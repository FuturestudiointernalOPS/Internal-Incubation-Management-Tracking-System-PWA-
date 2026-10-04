"use client";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Crown,
  Edit3,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Mail,
  Phone,
  Rocket,
  Route,
  Shield,
  Target,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import { activityLabel, activityDetails } from "@/lib/ventureActivity";
import VentureDashboard from "@/components/ventures/VentureDashboard";
import VentureWizardTab from "./VentureWizardTab";

const memberStatusColor = (status) =>
  status === "suspended"
    ? "bg-amber-500/10 text-amber-400"
    : status === "removed"
      ? "bg-slate-500/10 text-slate-400"
      : "bg-emerald-500/10 text-emerald-400";

/** A generic relation is translated; a job title ("CEO") is a datum, shown as-is. */
const MEMBER_ROLE_KEYS = {
  founder: "vadmin.detail.roleFounder",
  "co-founder": "vadmin.detail.roleCoFounder",
  member: "vadmin.detail.roleMember",
  team_member: "vadmin.detail.roleMember",
};

const memberRoleLabel = (member, t) => {
  const key = MEMBER_ROLE_KEYS[String(member.role || "").toLowerCase()];
  return key ? t(key) : String(member.role || "");
};

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
    getStageConfig,
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

  const stage = getStageConfig(venture.business_stage);

  const TABS = [
    { id: "dashboard", label: "vadmin.detail.dashboard", icon: Rocket },
    { id: "journey", label: "vadmin.detail.journey", icon: Route },
    { id: "investment", label: "vadmin.detail.investmentReadiness", icon: TrendingUp },
    { id: "timeline", label: "vadmin.detail.timeline", icon: BarChart3 },
    { id: "reports", label: "vadmin.detail.reports", icon: FileText },
    { id: "verification", label: "vadmin.detail.verification", icon: Shield },
    { id: "activity", label: "vadmin.detail.activity", icon: Activity },
    { id: "profile", label: "vadmin.detail.profile", icon: Building2 },
    { id: "team", label: "vadmin.detail.team", icon: Users },
  ];

  // Operational sections live on their own pages; the hub tab opens them.
  const HUB_NAV_ROUTES = {
    journey: `/admin/ventures/${id}/journey`,
    investment: `/admin/ventures/${id}/investment`,
    timeline: `/admin/ventures/${id}/timeline`,
    reports: `/admin/ventures/${id}/reports`,
    verification: `/admin/ventures/${id}/verification`,
  };

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Back button */}
        <button
          onClick={() => router.push("/admin/ventures")}
          className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
        >
          <ArrowLeft className="w-3 h-3" /> {t("vadmin.detail.backToVentures")}
        </button>

        {/* Venture Header */}
        <div className="card">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                <Rocket className="w-8 h-8 text-[var(--brand-orange)]" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-black text-[var(--text-primary)]">
                    {venture.company_name}
                  </h1>
                  <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${stage.color}`}>
                    {t(stage.label)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                  <span className="font-mono">{venture.venture_id}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {t("vadmin.detail.registered", { date: new Date(venture.created_at).toLocaleDateString(lang) })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => router.push(`/admin/ventures/${id}/edit`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <Edit3 className="w-3 h-3" /> {t("vadmin.detail.edit")}
              </button>
              <button
                onClick={() => router.push(`/admin/ventures/permissions`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
                title={t("vadmin.detail.permissionsTitle")}
              >
                <Shield className="w-3 h-3" /> {t("vadmin.detail.permissions")}
              </button>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/permissions`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
                title={t("vadmin.detail.staffTitle")}
              >
                <Users className="w-3 h-3" /> {t("vadmin.detail.staff")}
              </button>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/notes`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <FileText className="w-3 h-3" /> {t("vadmin.detail.notes")}
              </button>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/operating-plan`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <Target className="w-3 h-3" /> {t("vadmin.detail.operatingPlan")}
              </button>
              <button
                onClick={() => router.push(`/admin/ventures/${id}/journey`)}
                className="px-4 py-2 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary transition-all flex items-center gap-2"
              >
                <Route className="w-3 h-3" /> {t("vadmin.detail.journey")}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-8 border-b border-[var(--border-primary)] overflow-x-auto scrollbar-thin">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    const target = HUB_NAV_ROUTES[tab.id];
                    if (target) router.push(target);
                    else setActiveTab(tab.id);
                  }}
                  className={`px-5 py-3 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${
                    isActive
                      ? "border-[var(--brand-orange)] text-[var(--brand-orange)]"
                      : "border-transparent text-slate-500 hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {t(tab.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "dashboard" && (
          /* Full Dashboard is the first view when opening a Venture (merged
             with the former standalone dashboard page content). */
          <VentureDashboard id={id} embedded />
        )}

        {(activeTab === "profile" || activeTab === "overview") && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Company Details */}
              <div className="card">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                  {t("vadmin.detail.companyDetails")}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-tertiary rounded-xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t("vadmin.detail.industry")}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{venture.industry}</p>
                  </div>
                  <div className="p-3 bg-tertiary rounded-xl">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t("vadmin.detail.businessStage")}</p>
                    <p className={`text-sm font-bold ${stage.color}`}>{t(stage.label)}</p>
                  </div>
                  {venture.registration_number && (
                    <div className="p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t("vadmin.detail.registrationNumber")}</p>
                      <p className="text-sm font-bold text-[var(--text-primary)]">{venture.registration_number}</p>
                    </div>
                  )}
                  {venture.website && (
                    <div className="p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t("vadmin.detail.website")}</p>
                      <a
                        href={venture.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-[var(--brand-orange)] hover:underline flex items-center gap-1"
                      >
                        {new URL(venture.website).hostname}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {venture.description && (
                    <div className="col-span-2 p-3 bg-tertiary rounded-xl">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{t("vadmin.detail.description")}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{venture.description}</p>
                    </div>
                  )}
                </div>
              </div>

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
          <div className="space-y-6">
            {/* Who is in this Venture, counted from the MEMBERSHIP list — the
                founder included. The founder invitation ledger is managed on its
                own screen, reached from the button below. */}
            <div className="card">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-[var(--brand-orange)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.detail.teamMembers")}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {t("vadmin.detail.teamManagementDesc")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/admin/ventures/${id}/founders`)}
                  className="px-5 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5" /> {t("vadmin.detail.manageInvitations")}
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.totalMembers")}</p>
                  <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.total}</p>
                </div>
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.founders")}</p>
                  <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.founders}</p>
                </div>
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.team")}</p>
                  <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{memberSummary.team}</p>
                </div>
                <div className="p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.detail.suspendedMembers")}</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{memberSummary.suspended}</p>
                </div>
              </div>
            </div>

            {/* The member record itself: who they are, how to reach them, what
                they are, and since when. */}
            <div className="card">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                {t("vadmin.detail.memberList")}
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t("vadmin.detail.noMembers")}</p>
              ) : (
                <div className="space-y-3">
                  {members.map((member, index) => (
                    <div
                      key={member.id || index}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 bg-tertiary rounded-xl border border-[var(--border-primary)]"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black shrink-0">
                          {(member.name || member.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                              {member.name || member.email || t("vadmin.detail.unnamedMember")}
                            </p>
                            {member.is_owner ? (
                              <span className="flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-brand-orange/10 text-[var(--brand-orange)]">
                                <Crown className="w-3 h-3" /> {t("vadmin.detail.owner")}
                              </span>
                            ) : member.is_founder ? (
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                {t("vadmin.detail.founderBadge")}
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                                {t("vadmin.detail.teamMemberBadge")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-slate-500">
                            {member.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {member.email}
                              </span>
                            )}
                            {member.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {member.phone}
                              </span>
                            )}
                            <span>{memberRoleLabel(member, t)}</span>
                            {member.joined_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {t("vadmin.detail.memberSince", { date: new Date(member.joined_at).toLocaleDateString(lang) })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded shrink-0 ${memberStatusColor(member.status)}`}>
                        {t(`vadmin.detail.memberStatus.${["active", "suspended", "removed"].includes(member.status) ? member.status : "active"}`)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="card">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              {t("vadmin.detail.activityLog")}
            </h3>
            {(venture.activity || []).length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-6 text-center">{t("vadmin.detail.noActivityRecorded")}</p>
            ) : (
              <div className="space-y-1">
                {(venture.activity || []).map((activityEntry, index) => {
                  const Icon = getActivityIcon(activityEntry.action);
                  const color = getActivityColor(activityEntry.action);
                  const details = activityDetails(activityEntry.details, t);
                  return (
                    <div key={activityEntry.id || index} className="flex items-start gap-4 p-3 rounded-lg hover:bg-tertiary transition-all">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">{activityLabel(activityEntry.action, t)}</p>
                          <span className="text-[8px] text-slate-500">{actorText(activityEntry.actor_name)}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {new Date(activityEntry.created_at).toLocaleString(lang)}
                        </p>
                        {/* What actually changed — in words, never a raw payload. */}
                        {details.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {details.map((line, detailIndex) => (
                              <li key={detailIndex} className="text-[10px] text-[var(--text-secondary)]">
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
